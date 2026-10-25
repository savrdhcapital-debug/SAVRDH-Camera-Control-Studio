"use client";

import PanelMotion from "@/components/PanelMotion";
import Link from "next/link";
import { useState } from "react";
import Controls from "@/components/Controls";
import { useCamera } from "@/components/CameraProvider";
import Icon from "@/components/Icon";
import LiveView from "@/components/LiveView";
import { usePrefs } from "@/components/PrefsProvider";

/** Main control screen (mockup 2): live view, 5 setting cards, big record + photo buttons. */
export default function LivePage() {
  const cam = useCamera();
  const { prefs } = usePrefs();
  const [box, setBox] = useState(true);
  const connected = cam.status === "connected";
  const af = cam.settings.afoperation;

  const cycleAf = () => {
    if (!af || af.ability.length < 2) return;
    const next = af.ability[(af.ability.indexOf(af.value) + 1) % af.ability.length];
    void cam.setSetting("afoperation", next);
  };

  return (
    <div className="live-workspace">
      <LiveView overlay={prefs.liveOverlay} interactive focusBox={box} sideTools />

      <aside className="live-control-panel studio-card p-d">
      <PanelMotion />
      <div><p className="eyebrow">CAMERA CONTROLS</p><h1 className="text-lg font-semibold">Live View</h1></div>
      <Controls names={prefs.photoControls} className="live-settings grid-cols-2" />

      <div className="live-capture-actions flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-line/10 bg-panel p-3">
        <div className="flex items-center gap-2">
          <Link
            href="/library"
            className="h-14 w-20 overflow-hidden rounded-lg border border-line/10 bg-panel2"
            aria-label="Open media library"
          >
            {cam.lastThumb && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cam.lastThumb} alt="Last shot" className="h-full w-full object-cover" />
            )}
          </Link>
          <button className="hidden h-12 w-12 rounded-xl bg-panel2 text-sm font-bold text-muted hover:text-fg sm:block" disabled={!connected} onClick={() => void cam.af()}>
            AF
          </button>
          <button
            className={`hidden h-12 w-12 place-items-center rounded-xl bg-panel2 sm:grid ${box ? "text-accent" : "text-muted"}`}
            onClick={() => setBox((b) => !b)}
            aria-label="Toggle focus frame"
          >
            <Icon name="focus" />
          </button>
          <button
            className="hidden h-12 min-w-12 rounded-xl bg-panel2 px-2 text-xs font-bold text-muted hover:text-fg sm:block"
            disabled={!connected || !af}
            onClick={cycleAf}
            title="Cycle AF operation"
          >
            {af ? (af.value === "servo" ? "AF-C" : af.value === "oneshot" ? "AF-S" : af.value) : "AF-S"}
          </button>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => void cam.toggleRec()}
            disabled={!connected}
            aria-label={cam.recording ? "Stop recording" : "Start recording"}
            className="grid h-16 w-16 place-items-center rounded-full border-4 border-white bg-transparent disabled:opacity-40"
          >
            {cam.recording ? <span className="h-6 w-6 rounded-sm bg-rec" /> : <span className="h-12 w-12 rounded-full bg-rec" />}
          </button>
          <button
            onClick={() => void cam.shutter()}
            disabled={!connected || cam.recording}
            aria-label="Take photo"
            className="grid h-14 w-14 place-items-center rounded-full border border-line/20 bg-panel2 disabled:opacity-40"
          >
            <Icon name="camera" className="h-6 w-6" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => void cam.setLiveView(!cam.liveView)}
            disabled={!connected}
            className={`h-12 rounded-xl px-3 text-xs font-bold disabled:opacity-40 ${cam.liveView ? "bg-accent text-white" : "bg-panel2 text-muted"}`}
            title="Toggle live view"
          >
            LV
          </button>
          <Link href="/monitor" className="grid h-12 w-12 place-items-center rounded-xl bg-panel2 text-muted hover:text-fg" aria-label="Multi-screen">
            <Icon name="monitor" />
          </Link>
        </div>
      </div>

      {!connected && (
        <p className="text-center text-sm text-muted">
          Camera is not connected: <Link href="/connection" className="text-accent underline">Connection</Link> to connect, or choose Demo Camera.
        </p>
      )}
      </aside>
    </div>
  );
}
