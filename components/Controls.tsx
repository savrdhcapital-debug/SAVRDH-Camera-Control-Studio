"use client";

import { SETTING_LABELS, type SettingName } from "@/lib/camera";
import { useCamera } from "./CameraProvider";
import SettingSelect from "./SettingSelect";

/** Renders the chosen settings, skipping any the connected camera doesn't expose. */
export default function Controls({ names, className = "" }: { names: SettingName[]; className?: string }) {
  const cam = useCamera();
  const connected = cam.status === "connected";
  const shown = names.filter((n) => cam.settings[n]);
  if (connected && shown.length === 0) {
    return <p className="text-sm text-muted">The selected settings are not available on this camera or firmware.</p>;
  }
  return (
    <div className={`grid gap-d ${className}`}>
      {(connected ? shown : names.slice(0, 5)).map((n) => (
        <SettingSelect
          key={n}
          label={SETTING_LABELS[n]}
          value={cam.settings[n]?.value ?? "-"}
          options={cam.settings[n]?.ability ?? []}
          disabled={!connected || cam.recording}
          onChange={(v) => void cam.setSetting(n, v)}
        />
      ))}
    </div>
  );
}
