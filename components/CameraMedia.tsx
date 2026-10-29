"use client";
import { useEffect, useState } from "react";
import { nativeCameraAvailable } from "@/lib/native";
export default function CameraMedia({ src, alt = "", video = false, className }: { src: string; alt?: string; video?: boolean; className?: string }) {
  const [resolved, setResolved] = useState<string | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!nativeCameraAvailable() || !src.startsWith("/api/ccapi/")) { setResolved(src); return; }
    let alive = true, objectURL = "";
    setResolved(null); setError("");
    void fetch(src).then(async response => {
      if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.message || "Could not load camera media."); }
      return response.blob();
    }).then(blob => { if (alive) { objectURL = URL.createObjectURL(blob); setResolved(objectURL); } }).catch(error => { if (alive) setError(error instanceof Error ? error.message : "Preview unavailable."); });
    return () => { alive = false; if (objectURL) URL.revokeObjectURL(objectURL); };
  }, [src]);
  if (!resolved) return <span role="status" className="p-3 text-xs text-muted">{error || "Loading camera preview…"}</span>;
  return video ? <video src={resolved} controls className={className} /> : <img src={resolved} alt={alt} loading="lazy" className={className} />;
}
