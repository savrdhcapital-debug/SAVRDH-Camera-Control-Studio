// Simulated Canon EOS R50 so every module works without hardware.
type MockState = { values: Record<string, string>; recording: boolean; shots: number; deleted: string[] };

export const MOCK_DEFAULTS: Record<string, string> = {
  tv: "1/50",
  av: "F2.8",
  iso: "100",
  exposure: "+0.0",
  wb: "awb",
  drive: "single",
  afoperation: "oneshot",
  metering: "evaluative",
  moviequality: "4K 25p",
  shootingmodedial: "m",
};

export const MOCK_ABILITY: Record<string, string[]> = {
  tv: ["1/4000", "1/2000", "1/1000", "1/500", "1/250", "1/125", "1/60", "1/50", "1/30", "1/15", "1/8"],
  av: ["F1.8", "F2.8", "F4.0", "F5.6", "F8.0", "F11"],
  iso: ["auto", "100", "200", "400", "800", "1600", "3200", "6400", "12800"],
  exposure: ["-2.0", "-1.0", "+0.0", "+1.0", "+2.0"],
  wb: ["awb", "daylight", "shade", "cloudy", "tungsten", "fluorescent", "flash"],
  drive: ["single", "cont_high", "cont_low", "self_10s"],
  afoperation: ["oneshot", "servo"],
  metering: ["evaluative", "center_weighted", "spot"],
  moviequality: ["4K 25p", "4K 24p", "FHD 50p", "FHD 25p", "FHD 24p"],
  shootingmodedial: ["m"],
};

const g = globalThis as unknown as { __mockCam?: MockState };
const state: MockState =
  g.__mockCam ?? (g.__mockCam = { values: { ...MOCK_DEFAULTS }, recording: false, shots: 0, deleted: [] });

const BASE_FILES = 14;
const DIR = "/ccapi/ver100/contents/sd/100CANON";

function fileNames(): string[] {
  const out: string[] = [];
  for (let i = 1; i <= BASE_FILES + state.shots; i++) {
    const n = String(i).padStart(4, "0");
    const name = i % 5 === 0 ? `MVI_${n}.MP4` : `IMG_${n}.JPG`;
    if (!state.deleted.includes(name)) out.push(`${DIR}/${name}`);
  }
  return out;
}

function mediaSvg(name: string, thumb: boolean): string {
  const n = parseInt(name.replace(/\D/g, ""), 10) || 1;
  const hue = (n * 47) % 360;
  const video = /\.MP4$/i.test(name);
  const w = thumb ? 320 : 1200;
  const h = thumb ? 213 : 800;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 1200 800">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},55%,38%)"/><stop offset="1" stop-color="hsl(${(hue + 60) % 360},45%,12%)"/></linearGradient></defs>
<rect width="1200" height="800" fill="url(#g)"/>
<circle cx="${300 + (n % 5) * 120}" cy="260" r="110" fill="#ffd9a0" opacity="0.5"/>
<ellipse cx="640" cy="520" rx="170" ry="210" fill="#d9a07e" opacity="0.8"/>
<rect x="470" y="640" width="340" height="200" rx="60" fill="#efe2d3" opacity="0.85"/>
${video ? '<circle cx="600" cy="400" r="80" fill="#000" opacity="0.55"/><path d="M575 355l80 45-80 45z" fill="#fff"/>' : ""}
<text x="36" y="770" fill="#ffffffaa" font-family="monospace" font-size="42">${name}</text>
</svg>`;
}

export function mockLiveViewSvg(): string {
  const t = Date.now() / 1000;
  const x = 50 + Math.sin(t) * 12;
  const y = 50 + Math.cos(t * 0.7) * 8;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640" viewBox="0 0 960 640">
<defs><radialGradient id="bg" cx="${x}%" cy="${y}%" r="80%"><stop offset="0" stop-color="#6b4a2b"/><stop offset="0.5" stop-color="#2a1d14"/><stop offset="1" stop-color="#0b0806"/></radialGradient></defs>
<rect width="960" height="640" fill="url(#bg)"/>
<circle cx="${200 + Math.sin(t) * 6}" cy="190" r="60" fill="#ffcf8a" opacity="0.55"/>
<ellipse cx="560" cy="360" rx="120" ry="150" fill="#c58f6b" opacity="0.8"/>
<rect x="440" y="470" width="260" height="170" rx="40" fill="#e8d9c8" opacity="0.85"/>
<text x="24" y="620" fill="#ffffff66" font-family="monospace" font-size="16">DEMO LIVE VIEW</text>
</svg>`;
}

type MockResult = { status: number; json?: unknown; svg?: string };

export function handleMock(
  method: string,
  path: string,
  body: Record<string, unknown> | null,
  query: URLSearchParams,
): MockResult {
  const key = path.replace(/^ccapi\/ver\d+\//, "");

  if (key === "deviceinformation") {
    return {
      status: 200,
      json: { manufacturer: "Canon Inc.", productname: "Canon EOS R50 (Demo)", serialnumber: "DEMO0001", firmwareversion: "1.0.0" },
    };
  }
  if (key === "devicestatus/battery") return { status: 200, json: { name: "LP-E17", kind: "battery", level: "85", quality: "good" } };
  if (key === "devicestatus/storage") {
    const total = 64_000_000_000;
    return { status: 200, json: { storagelist: [{ name: "sd", maxsize: total, spacesize: total * 0.72 - state.shots * 25_000_000 }] } };
  }

  if (key === "shooting/liveview/flip") return { status: 200, svg: mockLiveViewSvg() };
  if (key === "shooting/liveview") return { status: 200, json: {} };

  if (key === "shooting/control/shutterbutton") {
    if (method === "POST") state.shots += 1;
    return { status: 200, json: {} };
  }
  if (key === "shooting/control/af") return { status: 200, json: {} };
  if (key === "shooting/control/recbutton") {
    if (body?.action === "start") state.recording = true;
    if (body?.action === "stop") {
      state.recording = false;
      state.shots += 1; // a new clip file appears
    }
    return { status: 200, json: {} };
  }

  const s = key.match(/^shooting\/settings\/([a-z]+)$/);
  if (s && s[1] in MOCK_ABILITY) {
    const name = s[1];
    if (method === "PUT" && typeof body?.value === "string") state.values[name] = body.value;
    return { status: 200, json: { value: state.values[name], ability: MOCK_ABILITY[name] } };
  }

  if (key === "contents") return { status: 200, json: { path: ["/ccapi/ver100/contents/sd"] } };
  if (key === "contents/sd") return { status: 200, json: { path: [DIR] } };
  if (key === "contents/sd/100CANON") return { status: 200, json: { path: fileNames() } };
  const f = key.match(/^contents\/sd\/100CANON\/([\w.]+)$/);
  if (f) {
    if (method === "DELETE") {
      state.deleted.push(f[1]);
      return { status: 200, json: {} };
    }
    return { status: 200, svg: mediaSvg(f[1], query.get("kind") === "thumbnail") };
  }

  return { status: 404, json: { message: "Not found (demo)" } };
}
