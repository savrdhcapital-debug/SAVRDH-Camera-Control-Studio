"use client";

import { useEffect, useRef, useState } from "react";
import { camera } from "@/lib/camera";
import type { Overlay } from "@/lib/prefs";
import { useCamera } from "./CameraProvider";
import { usePrefs } from "./PrefsProvider";
import Icon from "./Icon";

type Props = {
  overlay: Overlay;
  fill?: boolean; // full-window (monitor screen)
  interactive?: boolean; // tap-to-focus
  focusBox?: boolean; // static centre focus brackets
  sideTools?: boolean; // AF / face / frame buttons on the right
  timer?: boolean; // centred timer pill (video)
  className?: string;
};

const fmt = (s: number) =>
  [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, "0")).join(":");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const BINS = 64;

export default function LiveView({ overlay, fill, interactive, focusBox, sideTools, timer, className = "" }: Props) {
  const cam = useCamera();
  const { prefs } = usePrefs();
  const active = cam.status === "connected" && cam.liveView;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useState(3 / 2);
  const [hist, setHist] = useState<number[]>([]);
  const [tap, setTap] = useState<{ x: number; y: number; id: number } | null>(null);
  const [face, setFace] = useState(false);

  const histOn = useRef(overlay.histogram);
  histOn.current = overlay.histogram;
  const report = useRef(cam.reportFrameStats);
  report.current = cam.reportFrameStats;
  const fpsRef = useRef(prefs.fps);
  fpsRef.current = prefs.fps;

  // Frame loop: sequential fetch → draw. Never overlaps requests.
  useEffect(() => {
    if (!active) return;
    let stop = false;
    const img = new Image();
    const small = document.createElement("canvas");
    small.width = 96;
    small.height = 64;
    let frames = 0;
    let bytes = 0;
    let lat = 0;
    let dropped = 0;
    let lastReport = performance.now();
    let n = 0;

    (async () => {
      while (!stop) {
        const t0 = performance.now();
        try {
          const blob = await camera.getFrame();
          const u = URL.createObjectURL(blob);
          await new Promise<void>((ok, bad) => {
            img.onload = () => ok();
            img.onerror = () => bad(new Error("decode"));
            img.src = u;
          });
          URL.revokeObjectURL(u);
          const c = canvasRef.current;
          if (c && !stop) {
            if (c.width !== img.naturalWidth || c.height !== img.naturalHeight) {
              c.width = img.naturalWidth;
              c.height = img.naturalHeight;
              setRatio(img.naturalWidth / img.naturalHeight);
            }
            c.getContext("2d")?.drawImage(img, 0, 0);
            if (histOn.current && n % 4 === 0) {
              const sctx = small.getContext("2d", { willReadFrequently: true });
              if (sctx) {
                sctx.drawImage(img, 0, 0, 96, 64);
                const d = sctx.getImageData(0, 0, 96, 64).data;
                const bins = new Array<number>(BINS).fill(0);
                for (let i = 0; i < d.length; i += 4) {
                  const y = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
                  bins[Math.min(BINS - 1, Math.floor((y / 256) * BINS))]++;
                }
                const max = Math.max(...bins, 1);
                setHist(bins.map((b) => b / max));
              }
            }
          }
          n++;
          frames++;
          bytes += blob.size;
          lat += performance.now() - t0;
        } catch {
          dropped++;
          await sleep(300);
        }
        const now = performance.now();
        if (now - lastReport >= 1000) {
          report.current({
            fps: (frames * 1000) / (now - lastReport),
            latencyMs: frames ? lat / frames : 0,
            kbPerFrame: frames ? bytes / frames / 1024 : 0,
            dropped,
            width: img.naturalWidth,
            height: img.naturalHeight,
          });
          frames = 0;
          bytes = 0;
          lat = 0;
          lastReport = now;
        }
        const wait = 1000 / fpsRef.current - (performance.now() - t0);
        if (wait > 0) await sleep(wait);
      }
    })();

    return () => {
      stop = true;
    };
  }, [active]);

  // Snapshot thumbnail for the "last shot" tile.
  useEffect(() => {
    if (!cam.lastShotAt || !canvasRef.current || !canvasRef.current.width) return;
    const c = canvasRef.current;
    const t = document.createElement("canvas");
    t.width = 160;
    t.height = Math.round((160 * c.height) / c.width);
    t.getContext("2d")?.drawImage(c, 0, 0, t.width, t.height);
    cam.setLastThumb(t.toDataURL("image/jpeg", 0.7));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cam.lastShotAt]);

  const onTap = (e: React.MouseEvent) => {
    if (!interactive || !active || !boxRef.current || !canvasRef.current) return;
    const r = boxRef.current.getBoundingClientRect();
    let fx = (e.clientX - r.left) / r.width;
    const fy = (e.clientY - r.top) / r.height;
    if (overlay.mirror) fx = 1 - fx;
    if (fx < 0 || fx > 1 || fy < 0 || fy > 1) return;
    setTap({ x: fx, y: fy, id: Date.now() });
    void cam.af(Math.round(fx * canvasRef.current.width), Math.round(fy * canvasRef.current.height));
  };

  useEffect(() => {
    if (!tap) return;
    const id = setTimeout(() => setTap(null), 1500);
    return () => clearTimeout(id);
  }, [tap]);

  const s = cam.settings;
  const wb = s.wb?.value ?? "";
  const mode = (s.shootingmodedial?.value ?? "").toUpperCase();
  const movie = s.moviequality?.value ?? "";
  const mirrorX = (x: number) => (overlay.mirror ? 1 - x : x);

  return (
    <div
      className={`relative flex items-center justify-center bg-black ${fill ? "h-screen w-screen" : "live-view-viewport w-full overflow-hidden rounded-2xl"} ${className}`}
    >
      <div
        ref={boxRef}
        onClick={onTap}
        className={`relative ${interactive && active ? "cursor-crosshair" : ""}`}
        style={
          fill
            ? { width: `min(100vw, calc(100vh * ${ratio}))`, aspectRatio: `${ratio}` }
            : { width: `min(100%, calc(var(--preview-height, 60dvh) * ${ratio}))`, aspectRatio: `${ratio}` }
        }
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          style={{ transform: overlay.mirror ? "scaleX(-1)" : undefined }}
        />

        {!active && (
          <div className="absolute inset-0 grid place-items-center text-center text-sm text-white/50">
            {cam.status !== "connected" ? "Camera not connected" : "Live view is off"}
          </div>
        )}

        {/* Grid */}
        {overlay.grid === "thirds" && (
          <div className="pointer-events-none absolute inset-0">
            {[33.33, 66.66].map((p) => (
              <div key={`v${p}`} className="absolute inset-y-0 w-px bg-white/30" style={{ left: `${p}%` }} />
            ))}
            {[33.33, 66.66].map((p) => (
              <div key={`h${p}`} className="absolute inset-x-0 h-px bg-white/30" style={{ top: `${p}%` }} />
            ))}
          </div>
        )}
        {overlay.grid === "cross" && (
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-y-0 left-1/2 w-px bg-white/30" />
            <div className="absolute inset-x-0 top-1/2 h-px bg-white/30" />
          </div>
        )}
        {overlay.safeZone && (
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-[5%] border border-yellow-300/60" />
            <div className="absolute inset-[10%] border border-yellow-300/40" />
          </div>
        )}

        {/* Focus brackets (centre) */}
        {focusBox && active && !tap && (
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2">
            <span className="absolute left-0 top-0 h-5 w-5 border-l-2 border-t-2 border-white/80" />
            <span className="absolute right-0 top-0 h-5 w-5 border-r-2 border-t-2 border-white/80" />
            <span className="absolute bottom-0 left-0 h-5 w-5 border-b-2 border-l-2 border-white/80" />
            <span className="absolute bottom-0 right-0 h-5 w-5 border-b-2 border-r-2 border-white/80" />
          </div>
        )}
        {tap && (
          <div
            key={tap.id}
            className="focus-box pointer-events-none absolute h-20 w-20 border-2 border-yellow-300"
            style={{ left: `${mirrorX(tap.x) * 100}%`, top: `${tap.y * 100}%` }}
          />
        )}

        {/* Info: top-left badges */}
        {overlay.info && active && (
          <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2">
            {mode && <span className="rounded-md bg-white px-2 py-0.5 text-lg font-extrabold text-black">{mode}</span>}
            {movie && <span className="pill">{movie}</span>}
          </div>
        )}

        {/* Timer pill (video) */}
        {timer && active && (
          <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2">
            <span className="pill tabular-nums">{fmt(cam.elapsed)}</span>
          </div>
        )}

        {/* REC */}
        {cam.recording && (
          <div className="pointer-events-none absolute right-3 top-3 flex items-center gap-2 rounded-lg bg-black/60 px-2.5 py-1 text-sm font-bold text-rec">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rec" />
            REC {fmt(cam.elapsed)}
          </div>
        )}

        {/* Side tools */}
        {sideTools && active && (
          <div className="absolute right-3 top-16 flex flex-col gap-2">
            <button className="tool-btn" title="Focus frame" onClick={(e) => { e.stopPropagation(); void cam.af(); }}>
              <Icon name="focus" />
            </button>
            <button className="tool-btn text-sm font-bold" title="Autofocus" onClick={(e) => { e.stopPropagation(); void cam.af(); }}>
              AF
            </button>
            <button
              className={`tool-btn ${face ? "!bg-accent" : ""}`}
              title="Face / subject (display marker only)"
              onClick={(e) => { e.stopPropagation(); setFace((f) => !f); }}
            >
              <Icon name="user" />
            </button>
          </div>
        )}

        {/* Histogram */}
        {overlay.histogram && active && hist.length > 0 && (
          <svg viewBox={`0 0 ${BINS} 30`} className="pointer-events-none absolute bottom-14 left-3 h-16 w-28 rounded-md bg-black/50 p-1">
            <polygon
              fill="white"
              fillOpacity="0.85"
              points={`0,30 ${hist.map((h, i) => `${i},${30 - h * 28}`).join(" ")} ${BINS - 1},30`}
            />
          </svg>
        )}

        {/* Exposure pills + AWB */}
        {overlay.info && active && (
          <>
            <div className="pointer-events-none absolute bottom-3 left-3 flex gap-2 text-base">
              {s.tv && <span className="pill">{s.tv.value}</span>}
              {s.av && <span className="pill">{s.av.value}</span>}
              {s.iso && <span className="pill">ISO {s.iso.value}</span>}
            </div>
            <div className="pointer-events-none absolute bottom-3 right-3 flex gap-2">
              {wb && <span className="pill">{wb === "awb" ? "AWB" : wb.toUpperCase()}</span>}
            </div>
          </>
        )}

        {cam.lastShotAt > 0 && <div key={cam.lastShotAt} className="shot-flash pointer-events-none absolute inset-0 bg-white" />}
      </div>
    </div>
  );
}
