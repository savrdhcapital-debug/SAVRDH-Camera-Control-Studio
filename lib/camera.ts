import { webcam } from "./webcam";

// Canon CCAPI client. Everything goes through the local Next.js proxy (/api/ccapi).
// Endpoint names/values vary by model + firmware: verify against your R50's CCAPI.
export const ALL_SETTINGS = [
  "tv",
  "av",
  "iso",
  "exposure",
  "wb",
  "drive",
  "afoperation",
  "metering",
  "moviequality",
  "shootingmodedial",
] as const;
export type SettingName = (typeof ALL_SETTINGS)[number];

/** Settings a user can place on control bars (shootingmodedial is display-only). */
export const CONTROL_SETTINGS: SettingName[] = [
  "tv",
  "av",
  "iso",
  "exposure",
  "wb",
  "drive",
  "afoperation",
  "metering",
  "moviequality",
];

export const SETTING_LABELS: Record<SettingName, string> = {
  tv: "Shutter",
  av: "Aperture",
  iso: "ISO",
  exposure: "Exposure",
  wb: "White Balance",
  drive: "Drive Mode",
  afoperation: "AF Operation",
  metering: "Metering",
  moviequality: "Movie Quality",
  shootingmodedial: "Mode",
};

export type Setting = { value: string; ability: string[] };
export type MediaItem = { id: string; path: string; name: string; kind: "photo" | "video"; raw: boolean };
type Level = "info" | "warn" | "error";

const ROOT = "/api/ccapi/ccapi/ver100";
let base = "";
let logger: ((l: Level, m: string) => void) | null = null;

export function setCameraBase(b: string) {
  base = b;
}
export function setCameraLogger(fn: ((l: Level, m: string) => void) | null) {
  logger = fn;
}

const rel = (p: string) => p.replace(/^\/?ccapi\/ver\d+\//, "");

function url(path: string, params: Record<string, string> = {}) {
  const q = new URLSearchParams(params);
  if (base) q.set("__base", base);
  const s = q.toString();
  return `${ROOT}/${path}${s ? `?${s}` : ""}`;
}

async function call<T>(
  method: string,
  path: string,
  body?: unknown,
  params?: Record<string, string>,
  quiet = false,
): Promise<T> {
  const t0 = performance.now();
  let res: Response;
  try {
    res = await fetch(url(path, params), {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch {
    logger?.("error", `${method} ${path} network error`);
    throw new Error("Network error: is the dev server running?");
  }
  const ms = Math.round(performance.now() - t0);
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string };
    const msg = err.message ?? `Camera error ${res.status}`;
    logger?.(res.status === 404 ? "warn" : "error", `${method} ${path} → ${res.status} (${ms}ms)${res.status === 404 ? " not supported" : " " + msg}`);
    throw new Error(msg);
  }
  if (!quiet) logger?.("info", `${method} ${path} → ${res.status} (${ms}ms)`);
  const text = await res.text();
  return (text ? JSON.parse(text) : {}) as T;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const isWebcam = () => base === "webcam";

export const camera = {
  info: (): Promise<{ productname: string; serialnumber: string; firmwareversion: string }> =>
    isWebcam() ? webcam.info() : call("GET", "deviceinformation"),

  ping: async () => {
    if (isWebcam()) return 1;
    const t = performance.now();
    await call("GET", "deviceinformation", undefined, undefined, true);
    return Math.round(performance.now() - t);
  },

  async getSetting(n: SettingName): Promise<Setting> {
    if (isWebcam()) throw new Error("Not supported by webcam");
    const r = await call<{ value?: unknown; ability?: unknown }>("GET", `shooting/settings/${n}`, undefined, undefined, true);
    return {
      value: String(r.value ?? "-"),
      ability: Array.isArray(r.ability) ? r.ability.map(String) : [],
    };
  },
  setSetting: (n: SettingName, value: string): Promise<unknown> =>
    isWebcam() ? Promise.reject(new Error("Not supported by webcam")) : call("PUT", `shooting/settings/${n}`, { value }),

  startLiveView: (size: "small" | "medium" = "medium"): Promise<unknown> =>
    isWebcam() ? webcam.start() : call("POST", "shooting/liveview", { liveviewsize: size, cameradisplay: "off" }),
  stopLiveView: async (): Promise<unknown> => (isWebcam() ? webcam.stop() : call("DELETE", "shooting/liveview")),
  /** One live-view frame as a JPEG/image blob. */
  async getFrame(): Promise<Blob> {
    if (isWebcam()) return webcam.frame();
    const res = await fetch(url("shooting/liveview/flip", { t: String(Date.now()) }), { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    return res.blob();
  },

  shutter: (): Promise<unknown> => (isWebcam() ? webcam.shutter() : call("POST", "shooting/control/shutterbutton", { af: true })),
  af: (x?: number, y?: number): Promise<unknown> =>
    isWebcam()
      ? Promise.resolve()
      : call("POST", "shooting/control/af", x !== undefined && y !== undefined ? { positionx: x, positiony: y } : {}),
  recStart: (): Promise<unknown> => (isWebcam() ? webcam.recStart() : call("POST", "shooting/control/recbutton", { action: "start" })),
  recStop: (): Promise<unknown> => (isWebcam() ? webcam.recStop() : call("POST", "shooting/control/recbutton", { action: "stop" })),

  async battery() {
    if (isWebcam()) return { percent: null as number | null, label: "AC / built-in", name: "" };
    const b = await call<{ level?: string | number; name?: string }>("GET", "devicestatus/battery", undefined, undefined, true);
    const lv = String(b.level ?? "");
    const n = Number(lv);
    const words: Record<string, number> = { full: 100, high: 75, half: 50, quarter: 25, low: 10 };
    const percent = lv !== "" && Number.isFinite(n) ? n : (words[lv] ?? null);
    return { percent, label: lv || "unknown", name: b.name ?? "" };
  },
  async storage() {
    if (isWebcam()) return { total: 0, free: 0 };
    const s = await call<{ storagelist?: { maxsize?: number | string; spacesize?: number | string }[] }>(
      "GET",
      "devicestatus/storage",
      undefined,
      undefined,
      true,
    );
    const first = s.storagelist?.[0];
    return { total: num(first?.maxsize), free: num(first?.spacesize) };
  },

  // ---- Media (storage → folder → files). Real cameras page long listings; this reads page 1. ----
  async listMedia(): Promise<MediaItem[]> {
    if (isWebcam()) return webcam.list();
    const out: MediaItem[] = [];
    const storages = (await call<{ path?: string[] }>("GET", "contents")).path ?? [];
    for (const s of storages) {
      const dirs = (await call<{ path?: string[] }>("GET", rel(s))).path ?? [];
      for (const d of dirs) {
        const files = (await call<{ path?: string[] }>("GET", rel(d))).path ?? [];
        for (const f of files) {
          const name = f.split("/").pop() ?? f;
          const ext = name.split(".").pop()?.toLowerCase() ?? "";
          if (!["jpg", "jpeg", "heic", "cr3", "mp4", "mov"].includes(ext)) continue;
          out.push({
            id: f,
            path: f,
            name,
            kind: ext === "mp4" || ext === "mov" ? "video" : "photo",
            raw: ext === "cr3",
          });
        }
      }
    }
    return out.reverse();
  },
  thumbUrl: (m: MediaItem) => (isWebcam() ? webcam.url(m, "thumb") : url(rel(m.path), { kind: "thumbnail" })),
  displayUrl: (m: MediaItem) => (isWebcam() ? webcam.url(m, "main") : url(rel(m.path), { kind: "display" })),
  mainUrl: (m: MediaItem) => (isWebcam() ? webcam.url(m, "main") : url(rel(m.path), { kind: "main" })),
  deleteMedia: async (m: MediaItem): Promise<unknown> => {
    if (isWebcam()) return webcam.remove(m);
    return call("DELETE", rel(m.path));
  },
};
