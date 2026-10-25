"use client";

import { useEffect } from "react";
import Controls from "@/components/Controls";
import { useCamera } from "@/components/CameraProvider";
import Icon from "@/components/Icon";
import LiveView from "@/components/LiveView";
import { usePrefs } from "@/components/PrefsProvider";
import { Btn, Card, NotConnected } from "@/components/ui";

/** Photo Studio: live view, tap-to-focus, shutter, exposure controls, drive/AF/metering. */
export default function PhotoStudio() {
  const cam = useCamera();
  const { prefs } = usePrefs();
  const connected = cam.status === "connected";
  const side = prefs.photoLayout === "side";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (["INPUT", "SELECT", "TEXTAREA"].includes(t.tagName)) return;
      if (e.code === "Space" && connected && !cam.recording) {
        e.preventDefault();
        void cam.shutter();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [connected, cam]);

  if (!connected) return <NotConnected what="Photo Studio" />;

  const extra = (["drive", "afoperation", "metering"] as const).filter((n) => !prefs.photoControls.includes(n));

  return (
    <div className={`grid gap-d ${side ? "lg:grid-cols-[1fr_280px]" : ""}`}>
      <div className="flex flex-col gap-d">
        <LiveView overlay={prefs.liveOverlay} interactive focusBox />
        {!side && <Controls names={prefs.photoControls} className="grid-cols-2 md:grid-cols-5" />}
        <div className="flex items-center justify-center gap-4">
          <Btn onClick={() => void cam.af()}>
            <Icon name="focus" className="h-4 w-4" /> Autofocus
          </Btn>
          <button
            onClick={() => void cam.shutter()}
            disabled={cam.recording}
            aria-label="Shutter"
            className="grid h-20 w-20 place-items-center rounded-full border-4 border-white disabled:opacity-40"
          >
            <span className="h-14 w-14 rounded-full bg-white" />
          </button>
          <div className="w-28 text-sm text-muted">
            <div className="text-2xl font-bold text-fg">{cam.shots}</div>
            shots this session
            <div className="text-xs">Space = shutter</div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-d">
        {side && (
          <Card title="Exposure">
            <Controls names={prefs.photoControls} className="grid-cols-2" />
          </Card>
        )}
        {extra.length > 0 && (
          <Card title="Focus & Drive">
            <Controls names={[...extra]} className="grid-cols-1" />
          </Card>
        )}
        <Card title="Tips">
          <ul className="list-disc space-y-1 pl-4 text-sm text-muted">
            <li>Tap the live view to focus.</li>
            <li>Customize your controls in Appearance Studio.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
