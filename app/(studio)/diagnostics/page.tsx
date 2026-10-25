"use client";

import { useEffect, useMemo, useState } from "react";
import { camera } from "@/lib/camera";
import { useCamera, type LogEntry } from "@/components/CameraProvider";
import LiveView from "@/components/LiveView";
import { usePrefs } from "@/components/PrefsProvider";
import { Btn, Card } from "@/components/ui";

const gb = (n: number) => `${(n / 1e9).toFixed(1)} GB`;

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function Spark({ data }: { data: (number | null)[] }) {
  const max = Math.max(50, ...data.map((d) => d ?? 0));
  const W = 300;
  const H = 60;
  const step = W / Math.max(data.length - 1, 1);
  const pts = data.map((d, i) => (d === null ? null : `${i * step},${H - (d / max) * (H - 4) - 2}`));
  const path = pts.filter(Boolean).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-16 w-full">
      {path && <polyline points={path} fill="none" stroke="rgb(var(--accent))" strokeWidth="2" />}
      {data.map((d, i) => d === null && <line key={i} x1={i * step} x2={i * step} y1="0" y2={H} stroke="#ff2d2d" strokeWidth="2" />)}
    </svg>
  );
}

const LEVEL_CLASS: Record<LogEntry["level"], string> = { info: "text-muted", warn: "text-yellow-400", error: "text-rec" };

/** Diagnostics: connectivity/latency, frame statistics, camera info, logs, export. */
export default function DiagnosticsPage() {
  const cam = useCamera();
  const { prefs } = usePrefs();
  const connected = cam.status === "connected";
  const [pings, setPings] = useState<(number | null)[]>([]);
  const [levels, setLevels] = useState<Record<LogEntry["level"], boolean>>({ info: true, warn: true, error: true });

  useEffect(() => {
    if (!connected) return;
    let alive = true;
    const tick = async () => {
      try {
        const ms = await camera.ping();
        if (alive) setPings((p) => [...p.slice(-59), ms]);
      } catch {
        if (alive) setPings((p) => [...p.slice(-59), null]);
      }
    };
    void tick();
    const id = setInterval(tick, 2000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [connected]);

  const stats = useMemo(() => {
    const ok = pings.filter((p): p is number => p !== null);
    return {
      min: ok.length ? Math.min(...ok) : 0,
      max: ok.length ? Math.max(...ok) : 0,
      avg: ok.length ? Math.round(ok.reduce((a, b) => a + b, 0) / ok.length) : 0,
      loss: pings.length ? Math.round(((pings.length - ok.length) / pings.length) * 100) : 0,
    };
  }, [pings]);

  const logs = [...cam.logs].filter((l) => levels[l.level]).reverse();
  const fs = cam.frameStats;

  const exportReport = () =>
    download(
      `savrdh-diagnostics-${Date.now()}.json`,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          status: cam.status,
          connection: cam.conn,
          info: cam.info,
          battery: cam.battery,
          storage: cam.storage,
          frameStats: fs,
          latency: { samples: pings, ...stats },
          settings: cam.settings,
          logs: cam.logs,
        },
        null,
        2,
      ),
      "application/json",
    );

  const row = (k: string, v: string) => (
    <div className="flex justify-between gap-3 py-1 text-sm">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  );

  return (
    <div className="grid gap-d lg:grid-cols-2">
      <Card title="Connection">
        <dl>
          {row("Status", cam.status)}
          {row("Camera", cam.info?.productname ?? "—")}
          {row("Serial", cam.info?.serialnumber ?? "—")}
          {row("Firmware", cam.info?.firmwareversion ?? "—")}
          {row("Address", cam.conn ? (cam.conn.mode === "demo" ? "demo" : cam.conn.baseUrl) : "—")}
          {row("Battery", cam.battery ? (cam.battery.percent !== null ? `${cam.battery.percent}%` : cam.battery.label) : "—")}
          {row("Card", cam.storage && cam.storage.total ? `${gb(cam.storage.free)} free of ${gb(cam.storage.total)}` : "—")}
          {row("Supported settings", `${Object.keys(cam.settings).length}`)}
        </dl>
        {cam.error && <p className="mt-2 text-sm text-rec">{cam.error}</p>}
      </Card>

      <Card title="Latency (ping every 2 s)">
        {connected ? (
          <>
            <Spark data={pings} />
            <div className="mt-2 grid grid-cols-4 gap-2 text-center text-sm">
              {[["Min", `${stats.min} ms`], ["Avg", `${stats.avg} ms`], ["Max", `${stats.max} ms`], ["Loss", `${stats.loss}%`]].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-panel2 py-2">
                  <div className="text-xs text-muted">{k}</div>
                  <div className="font-semibold">{v}</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted">Available when a camera is connected.</p>
        )}
      </Card>

      <Card title="Frame statistics">
        {connected && cam.liveView ? (
          <div className="grid gap-d md:grid-cols-[1fr_180px]">
            <dl>
              {row("Frame rate", fs ? `${fs.fps.toFixed(1)} fps (target ${prefs.fps})` : "measuring…")}
              {row("Frame latency", fs ? `${Math.round(fs.latencyMs)} ms` : "—")}
              {row("Frame size", fs ? `${fs.kbPerFrame.toFixed(0)} KB` : "—")}
              {row("Resolution", fs && fs.width ? `${fs.width}×${fs.height}` : "—")}
              {row("Dropped frames", fs ? String(fs.dropped) : "—")}
            </dl>
            <div className="overflow-hidden rounded-xl">
              <LiveView overlay={{ grid: "off", histogram: false, info: false, safeZone: false, mirror: false }} />
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">Frame statistics appear while live view is active.</p>
        )}
      </Card>

      <Card
        title="Logs"
        right={
          <div className="flex gap-2">
            <Btn variant="ghost" onClick={() => cam.clearLogs()}>Clear</Btn>
            <Btn
              variant="ghost"
              onClick={() => download("savrdh-log.txt", cam.logs.map((l) => `${new Date(l.t).toISOString()} [${l.level}] ${l.msg}`).join("\n"), "text/plain")}
            >
              Save .txt
            </Btn>
            <Btn onClick={exportReport}>Export report</Btn>
          </div>
        }
      >
        <div className="mb-2 flex gap-2 text-xs">
          {(["info", "warn", "error"] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLevels((s) => ({ ...s, [l]: !s[l] }))}
              className={`rounded-lg border px-2.5 py-1 ${levels[l] ? "border-accent/60 bg-accent/10" : "border-line/10 text-muted"}`}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="h-64 overflow-y-auto rounded-xl bg-bg p-2 font-mono text-xs">
          {logs.length === 0 ? (
            <p className="text-muted">No log entries.</p>
          ) : (
            logs.map((l, i) => (
              <div key={`${l.t}-${i}`} className={LEVEL_CLASS[l.level]}>
                {new Date(l.t).toLocaleTimeString()} {l.msg}
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
