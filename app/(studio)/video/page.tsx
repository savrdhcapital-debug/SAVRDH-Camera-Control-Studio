"use client";

import Controls from "@/components/Controls";
import { useCamera } from "@/components/CameraProvider";
import Icon from "@/components/Icon";
import LiveView from "@/components/LiveView";
import { usePrefs } from "@/components/PrefsProvider";
import { Card, NotConnected } from "@/components/ui";

const fmt = (s: number) =>
  [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, "0")).join(":");
const gb = (n: number) => `${(n / 1e9).toFixed(1)} GB`;

/** Video Studio: record start/stop, timer, quality chips, camera + card status. */
export default function VideoStudio() {
  const cam = useCamera();
  const { prefs } = usePrefs();
  const connected = cam.status === "connected";
  if (!connected) return <NotConnected what="Video Studio" />;

  const mq = cam.settings.moviequality;
  // Quality values look like "4K 25p": split into resolution + frame-rate chips.
  const parts = (mq?.value ?? "").split(" ");
  const res = parts[0];
  const fps = parts[1];
  const resOptions = [...new Set((mq?.ability ?? []).map((v) => v.split(" ")[0]))];
  const fpsOptions = [...new Set((mq?.ability ?? []).filter((v) => v.startsWith(res + " ")).map((v) => v.split(" ")[1]))];
  const pick = (r: string, f: string) => {
    const wanted = `${r} ${f}`;
    const fallback = (mq?.ability ?? []).find((v) => v.startsWith(r + " "));
    const target = mq?.ability.includes(wanted) ? wanted : fallback;
    if (target) void cam.setSetting("moviequality", target);
  };

  const chip = (active: boolean) =>
    `rounded-xl border px-4 py-2 text-sm font-semibold transition disabled:opacity-40 ${
      active ? "border-accent bg-accent/15 text-fg" : "border-line/10 bg-panel2 text-muted hover:text-fg"
    }`;

  return (
    <div className="grid gap-d lg:grid-cols-[1fr_300px]">
      <div className="flex flex-col gap-d">
        <LiveView overlay={prefs.liveOverlay} timer />

        <div className="flex items-center justify-center gap-6 rounded-2xl border border-line/10 bg-panel p-3">
          <button
            onClick={() => void cam.shutter()}
            disabled={cam.recording}
            className="grid h-12 w-12 place-items-center rounded-full bg-panel2 disabled:opacity-40"
            aria-label="Take photo"
          >
            <Icon name="camera" />
          </button>
          <button
            onClick={() => void cam.toggleRec()}
            aria-label={cam.recording ? "Stop" : "Record"}
            className="grid h-20 w-20 place-items-center rounded-full border-4 border-white"
          >
            {cam.recording ? <span className="h-7 w-7 rounded-sm bg-rec" /> : <span className="h-14 w-14 rounded-full bg-rec" />}
          </button>
          <div className="w-24 text-center">
            <div className="text-2xl font-bold tabular-nums">{fmt(cam.elapsed)}</div>
            <div className="text-xs text-muted">{cam.recording ? "recording" : "ready"}</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {resOptions.map((r) => (
            <button key={r} disabled={cam.recording} onClick={() => pick(r, fps ?? "")} className={chip(r === res)}>
              {r}
            </button>
          ))}
          {fpsOptions.map((f) => (
            <button key={f} disabled={cam.recording} onClick={() => pick(res ?? "", f)} className={chip(f === fps)}>
              {f}
            </button>
          ))}
          <span className="rounded-xl border border-line/10 px-4 py-2 text-sm text-muted">MOV/MP4 · camera menu</span>
        </div>

        <Controls names={prefs.videoControls} className="grid-cols-2 md:grid-cols-5" />
      </div>

      <div className="flex flex-col gap-d">
        <Card title="Camera status">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Battery</dt><dd>{cam.battery ? (cam.battery.percent !== null ? `${cam.battery.percent}%` : cam.battery.label) : "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Card free</dt><dd>{cam.storage && cam.storage.total ? `${gb(cam.storage.free)} / ${gb(cam.storage.total)}` : "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Quality</dt><dd>{mq?.value ?? "—"}</dd></div>
          </dl>
          <p className="mt-3 text-xs text-muted">Set audio levels and clip format in the camera menu; CCAPI does not expose these controls.</p>
        </Card>
        <Card title="Takes this session">
          {cam.takes.length === 0 ? (
            <p className="text-sm text-muted">No recordings in this session.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {[...cam.takes].reverse().map((t) => (
                <li key={t.n} className="flex justify-between">
                  <span>Take {t.n}</span>
                  <span className="tabular-nums text-muted">{fmt(t.duration)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
