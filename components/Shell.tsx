"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useCamera } from "./CameraProvider";
import Icon, { type IconName } from "./Icon";

const NAV: { href: string; label: string; icon: IconName }[] = [
  { href: "/live", label: "Live View", icon: "home" },
  { href: "/photo", label: "Photo", icon: "camera" },
  { href: "/video", label: "Video", icon: "video" },
  { href: "/connection", label: "Connection", icon: "plug" },
  { href: "/cctv", label: "CCTV Cameras", icon: "video" },
  { href: "/library", label: "Media Library", icon: "library" },
  { href: "/monitor", label: "Multi-Screen", icon: "multi" },
  { href: "/streaming", label: "Live Streaming", icon: "video" },
  { href: "/appearance", label: "Appearance Studio", icon: "palette" },
  { href: "/diagnostics", label: "Diagnostics", icon: "pulse" },
  { href: "/admin", label: "Super Admin", icon: "user" },
];

export default function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const cam = useCamera();
  const connected = cam.status === "connected";
  const statusText =
    cam.status === "connected" ? "Connected" : cam.status === "connecting" ? "Connecting…" : cam.status === "error" ? "Connection error" : "Not connected";
  const statusColor = connected ? "text-ok" : cam.status === "error" ? "text-rec" : "text-muted";

  return (
    <div className="studio-shell mx-auto flex min-h-screen max-w-[1800px] p-0 md:p-4">
      <div className="ambient-scene" aria-hidden="true"><i /><i /><i /><div className="ambient-grid" /></div>
      <div className="studio-frame flex w-full overflow-hidden border-line/10 bg-panel/60 md:rounded-3xl md:border md:shadow-2xl">
        {/* Sidebar */}
        <aside className="studio-sidebar motion-chrome hidden w-60 shrink-0 flex-col border-r border-line/10 bg-panel p-4 md:flex">
          <div className="mb-6 px-2">
            <div className="text-2xl font-extrabold tracking-wide">SAVRDH</div>
            <div className="text-xs text-muted">Camera Control Studio</div>
          </div>
          <nav className="flex flex-1 flex-col gap-1">
            {NAV.map((n) => {
              const active = path === n.href;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                    active ? "bg-accent text-white" : "text-fg/80 hover:bg-line/10"
                  }`}
                >
                  <Icon name={n.icon} />
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <Link
            href="/about"
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${
              path === "/about" ? "bg-accent text-white" : "text-fg/80 hover:bg-line/10"
            }`}
          >
            <Icon name="info" />
            About
          </Link>
        </aside>

        {/* Main */}
        <div className="studio-main-column flex min-w-0 flex-1 flex-col">
          <header className="studio-topbar motion-chrome flex items-center justify-between gap-3 border-b border-line/10 px-4 py-3">
            <div className="flex items-center gap-3">
              <span className={connected ? "text-ok" : "text-muted"}>
                <Icon name="wifi" className="h-6 w-6" />
              </span>
              <div className="leading-tight">
                <div className="font-semibold tracking-tight">{cam.conn?.name ?? "Canon EOS R50"}</div>
                <div className={`text-xs ${statusColor}`}>● {statusText}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {cam.battery && (
                <div className="flex items-center gap-1.5 text-sm text-muted">
                  <Icon name="battery" className="h-5 w-5" />
                  {cam.battery.percent !== null ? `${cam.battery.percent}%` : cam.battery.label}
                </div>
              )}
              <Link href="/appearance" className="grid h-10 w-10 place-items-center rounded-xl bg-panel2 hover:bg-line/10" aria-label="Settings">
                <Icon name="gear" />
              </Link>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-d pb-24 md:pb-d">{children}</main>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex gap-1 overflow-x-auto border-t border-line/10 bg-panel/95 p-2 backdrop-blur md:hidden">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`flex min-w-[68px] flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[11px] ${
              path === n.href ? "bg-accent text-white" : "text-muted"
            }`}
          >
            <Icon name={n.icon} className="h-5 w-5" />
            {n.label.split(" ")[0]}
          </Link>
        ))}
      </nav>

      {cam.toast && (
        <div
          key={cam.toast.id}
          className={`fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-xl px-4 py-2.5 text-sm font-medium shadow-xl md:bottom-6 ${
            cam.toast.kind === "error" ? "bg-rec text-white" : "bg-fg text-bg"
          }`}
        >
          {cam.toast.msg}
        </div>
      )}
    </div>
  );
}
