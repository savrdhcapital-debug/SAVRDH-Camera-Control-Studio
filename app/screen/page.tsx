"use client";

import { useEffect, useRef } from "react";
import { useCamera } from "@/components/CameraProvider";
import LiveView from "@/components/LiveView";
import { usePrefs } from "@/components/PrefsProvider";

/** Chromeless full-window preview for an external display. Press F or double-click for fullscreen. */
export default function ScreenPage() {
  const cam = useCamera();
  const { prefs, loaded } = usePrefs();
  const tried = useRef(false);

  // This window has its own session: reconnect to the last camera if needed.
  useEffect(() => {
    if (tried.current || !loaded || cam.status !== "disconnected") return;
    tried.current = true;
    const t = setTimeout(() => {
      if (cam.status === "disconnected") void cam.reconnect();
    }, 800); // give the auto-reconnect a moment first
    return () => clearTimeout(t);
  }, [loaded, cam]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "f") {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const clean = prefs.monitorMode === "extended";
  const overlay = clean ? { ...prefs.monitorOverlay, info: false, histogram: false } : prefs.monitorOverlay;

  return (
    <div className="fixed inset-0 bg-black" onDoubleClick={() => void document.documentElement.requestFullscreen?.()}>
      <LiveView overlay={overlay} fill />
      {cam.status !== "connected" && (
        <div className="absolute inset-x-0 bottom-6 text-center text-sm text-white/60">
          {cam.status === "connecting" ? "Connecting…" : "Camera not connected. Connect from the main window."}
        </div>
      )}
    </div>
  );
}
