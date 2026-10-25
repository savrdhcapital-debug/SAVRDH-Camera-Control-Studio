"use client";

import AppearanceStudio from "@/components/AppearanceStudio";
import { CONTROL_SETTINGS, SETTING_LABELS, type SettingName } from "@/lib/camera";
import { type Prefs } from "@/lib/prefs";
import Icon from "@/components/Icon";
import { usePrefs } from "@/components/PrefsProvider";
import { Btn, Card, Radio, Toggle } from "@/components/ui";

function ControlList({
  title,
  list,
  onChange,
}: {
  title: string;
  list: SettingName[];
  onChange: (l: SettingName[]) => void;
}) {
  const hidden = CONTROL_SETTINGS.filter((n) => !list.includes(n));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    const n = [...list];
    [n[i], n[j]] = [n[j], n[i]];
    onChange(n);
  };
  return (
    <Card title={title}>
      <ul className="space-y-1.5">
        {list.map((n, i) => (
          <li key={n} className="flex items-center justify-between rounded-xl bg-panel2 px-3 py-2 text-sm">
            <span>{SETTING_LABELS[n]}</span>
            <span className="flex items-center gap-1">
              <button className="rounded p-1 hover:bg-line/10 disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"><Icon name="up" className="h-4 w-4" /></button>
              <button className="rounded p-1 hover:bg-line/10 disabled:opacity-30" disabled={i === list.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><Icon name="down" className="h-4 w-4" /></button>
              <button className="rounded px-2 py-1 text-xs text-rec hover:bg-line/10" onClick={() => onChange(list.filter((x) => x !== n))}>Hide</button>
            </span>
          </li>
        ))}
      </ul>
      {hidden.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {hidden.map((n) => (
            <button key={n} onClick={() => onChange([...list, n])} className="rounded-lg border border-dashed border-line/25 px-2.5 py-1 text-xs text-muted hover:text-fg">
              + {SETTING_LABELS[n]}
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

/** Appearance Studio: theme, accent, density, layouts, customizable control bars. */
export default function AppearancePage() {
  const { prefs, update, reset } = usePrefs();


  return (
    <div className="space-y-5">
      <AppearanceStudio />
      <details className="studio-card p-5"><summary className="cursor-pointer font-semibold">Camera controls & advanced preferences</summary>
      <div className="mt-5 grid gap-d lg:grid-cols-2">
      <Card title="Layout">
        <div className="flex flex-col gap-2">
          <Radio checked={prefs.density === "comfortable"} label="Comfortable" hint="Roomier spacing" onSelect={() => update({ density: "comfortable" })} />
          <Radio checked={prefs.density === "compact"} label="Compact" hint="More on screen" onSelect={() => update({ density: "compact" })} />
        </div>
        <div className="mt-4 text-xs text-muted">Photo Studio controls</div>
        <div className="mt-2 flex flex-col gap-2">
          <Radio checked={prefs.photoLayout === "bottom"} label="Below live view" onSelect={() => update({ photoLayout: "bottom" })} />
          <Radio checked={prefs.photoLayout === "side"} label="Side panel" onSelect={() => update({ photoLayout: "side" })} />
        </div>
      </Card>

      <ControlList title="Photo / Live View controls" list={prefs.photoControls} onChange={(l) => update({ photoControls: l })} />
      <ControlList title="Video controls" list={prefs.videoControls} onChange={(l) => update({ videoControls: l })} />

      <Card title="Live view overlays">
        <label className="mb-2 block text-xs text-muted">
          Grid
          <select
            value={prefs.liveOverlay.grid}
            onChange={(e) => update({ liveOverlay: { ...prefs.liveOverlay, grid: e.target.value as Prefs["liveOverlay"]["grid"] } })}
            className="mt-1 w-full rounded-xl border border-line/10 bg-panel2 px-3 py-2 text-sm text-fg"
          >
            <option value="off">Off</option>
            <option value="thirds">Rule of thirds</option>
            <option value="cross">Center cross</option>
          </select>
        </label>
        <Toggle label="Exposure info" checked={prefs.liveOverlay.info} onChange={(v) => update({ liveOverlay: { ...prefs.liveOverlay, info: v } })} />
        <Toggle label="Histogram" checked={prefs.liveOverlay.histogram} onChange={(v) => update({ liveOverlay: { ...prefs.liveOverlay, histogram: v } })} />
        <Toggle label="Safe zone" checked={prefs.liveOverlay.safeZone} onChange={(v) => update({ liveOverlay: { ...prefs.liveOverlay, safeZone: v } })} />
        <Toggle label="Mirror" checked={prefs.liveOverlay.mirror} onChange={(v) => update({ liveOverlay: { ...prefs.liveOverlay, mirror: v } })} />
      </Card>

      <Card title="Behaviour">
        <Toggle label="Auto-reconnect" hint="Reconnect when the app opens or the connection drops" checked={prefs.autoReconnect} onChange={(v) => update({ autoReconnect: v })} />
        <label className="mt-2 block text-xs text-muted">
          Live view frame rate: {prefs.fps} fps
          <input type="range" min={4} max={30} value={prefs.fps} onChange={(e) => update({ fps: Number(e.target.value) })} className="mt-1 w-full" />
        </label>
        <Btn className="mt-4" onClick={reset}>Reset all appearance settings</Btn>
      </Card>
    </div></details></div>
  );
}
