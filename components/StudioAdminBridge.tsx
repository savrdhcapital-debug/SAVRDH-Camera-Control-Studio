"use client";
import { useEffect } from "react";
import { useCamera } from "./CameraProvider";
export default function StudioAdminBridge() {
  const cam = useCamera();
  useEffect(() => {
    let id: string;
    try {
      id = localStorage.getItem("savrdh.device-id") ?? crypto.randomUUID();
      localStorage.setItem("savrdh.device-id", id);
    } catch {
      return;
    }
    const send = () => {
      void fetch("/api/studio-status", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          name: cam.conn?.name ?? "Camera Studio",
          mode: cam.conn?.mode ?? "",
          status: cam.status,
          recording: cam.recording,
          liveView: cam.liveView,
          shots: cam.shots,
        }),
      }).catch(() => {});
    };
    send();
    const timer = setInterval(send, 12000);
    return () => clearInterval(timer);
  }, [
    cam.status,
    cam.conn?.name,
    cam.conn?.mode,
    cam.recording,
    cam.liveView,
    cam.shots,
  ]);
  return null;
}
