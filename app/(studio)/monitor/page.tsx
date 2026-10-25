"use client";

import { useEffect, useRef, useState } from "react";
import { useCamera } from "@/components/CameraProvider";
import Icon from "@/components/Icon";
import LiveView from "@/components/LiveView";
import { usePrefs } from "@/components/PrefsProvider";
import { Btn, Card, NotConnected, Radio, Toggle } from "@/components/ui";
import type { Grid, Prefs } from "@/lib/prefs";

const MODES: { id: Prefs["monitorMode"]; label: string; hint: string }[] = [
  { id: "ipad", label: "This device only", hint: "Show the preview on this screen only" },
  { id: "duplicate", label: "Duplicate to External Monitor", hint: "Mirror the preview with overlays" },
  { id: "extended", label: "Extended Monitor (Full Screen)", hint: "Show a clean fullscreen preview on an external display" },
];

/** External Monitor: full-screen preview window + overlay settings. */
export default function MonitorPage() {
  const cam = useCamera();
  const { prefs, update } = usePrefs();
  const connected = cam.status === "connected";
  const previewRef = useRef<HTMLDivElement>(null);
  const [extended, setExtended] = useState<boolean | null>(null);

  useEffect(() => {
    // Chromium exposes whether more than one display is attached.
    setExtended(typeof window !== "undefined" && "isExtended" in window.screen ? Boolean((window.screen as Screen & { isExtended?: boolean }).isExtended) : null);
  }, []);

  const ov = prefs.monitorOverlay;
  const setOv = (p: Partial<typeof ov>) => update({ monitorOverlay: { ...ov, ...p } });

  const openScreen = () => {
    const w = window.open("/screen", "savrdh-monitor", "popup,width=1280,height=720");
    if (!w) cam.notify("Popup blocked. Allow popups in your browser.", "error");
  };

  const fullscreenHere = () => {
    void previewRef.current?.requestFullscreen?.().catch(() => cam.notify("Fullscreen is unavailable", "error"));
  };

  if (!connected) return <NotConnected what="External Monitor" />;

  return (
    <div className="grid gap-d lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-d">
        <div ref={previewRef} className="overflow-hidden rounded-2xl bg-black">
          <LiveView overlay={prefs.monitorMode === "extended" ? { ...ov, info: false, histogram: false } : ov} />
        </div>

        <div className="grid gap-d md:grid-cols-3">
          {[
            { t: "Duplicate Live View", d: "Mirror the preview on this device and the external monitor", i: "monitor" as const },
            { t: "Extended Mode", d: "Show a clean fullscreen preview on the external monitor", i: "multi" as const },
            { t: "Output Options", d: "AirPlay, USB-C/HDMI or wireless display through your operating system", i: "wifi" as const },
          ].map((c) => (
            <div key={c.t} className="flex gap-3 rounded-2xl border border-line/10 bg-panel p-3">
              <Icon name={c.i} className="mt-0.5 h-6 w-6 shrink-0 text-muted" />
              <div>
                <div className="text-sm font-semibold">{c.t}</div>
                <div className="text-xs text-muted">{c.d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-d">
        <Card title="Display Mode">
          <div className="flex flex-col gap-2">
            {MODES.map((m) => (
              <Radio key={m.id} checked={prefs.monitorMode === m.id} label={m.label} hint={m.hint} onSelect={() => update({ monitorMode: m.id })} />
            ))}
          </div>
        </Card>

        <Card title="Connected Display">
          <div className="flex items-center justify-between rounded-xl bg-panel2 px-3 py-2 text-sm">
            <span>External display</span>
            <span className={extended ? "text-ok" : "text-muted"}>
              {extended === null ? "unknown" : extended ? "Active" : "Not detected"}
            </span>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            <Btn variant="primary" onClick={openScreen}>
              <Icon name="external" className="h-4 w-4" /> Open monitor window
            </Btn>
            <Btn onClick={fullscreenHere}>
              <Icon name="expand" className="h-4 w-4" /> Fullscreen here
            </Btn>
          </div>
          <p className="mt-2 text-xs text-muted">Move the monitor window to your external display, then enter fullscreen.</p>
        </Card>

        <Card title="Overlays">
          <label className="mb-2 block text-xs text-muted">
            Grid
            <select
              value={ov.grid}
              onChange={(e) => setOv({ grid: e.target.value as Grid })}
              className="mt-1 w-full rounded-xl border border-line/10 bg-panel2 px-3 py-2 text-sm text-fg"
            >
              <option value="off">Off</option>
              <option value="thirds">Rule of thirds</option>
              <option value="cross">Center cross</option>
            </select>
          </label>
          <Toggle label="Exposure info" checked={ov.info} onChange={(v) => setOv({ info: v })} />
          <Toggle label="Histogram" checked={ov.histogram} onChange={(v) => setOv({ histogram: v })} />
          <Toggle label="Safe zone" checked={ov.safeZone} onChange={(v) => setOv({ safeZone: v })} />
          <Toggle label="Mirror" checked={ov.mirror} onChange={(v) => setOv({ mirror: v })} />
        </Card>

        <Card title="Preview quality">
          <select
            value={prefs.lvSize}
            onChange={(e) => {
              update({ lvSize: e.target.value as Prefs["lvSize"] });
              setTimeout(() => void cam.restartLiveView(), 0);
            }}
            className="w-full rounded-xl border border-line/10 bg-panel2 px-3 py-2 text-sm text-fg"
          >
            <option value="small">Small (faster)</option>
            <option value="medium">Medium (recommended)</option>
          </select>
          <label className="mt-3 block text-xs text-muted">
            Target frame rate: {prefs.fps} fps
            <input type="range" min={4} max={30} value={prefs.fps} onChange={(e) => update({ fps: Number(e.target.value) })} className="mt-1 w-full" />
          </label>
        </Card>
      </div>
    </div>
  );
}
