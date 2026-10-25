"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import Icon, { type IconName } from "../Icon";
import { SECTIONS } from "@/lib/admin-types";
export default function AdminShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [error, setError] = useState("");
  return (
    <div className="studio-shell admin-shell mx-auto flex min-h-screen p-0 md:p-4">
      <div className="ambient-scene" aria-hidden="true">
        <i />
        <i />
        <i />
        <div className="ambient-grid" />
      </div>
      <div className="studio-frame flex w-full overflow-hidden border border-line/10 rounded-3xl bg-panel/60">
        <aside className="studio-sidebar motion-chrome admin-sidebar flex flex-col shrink-0 border-r border-line/10 p-4">
          <div className="mb-5 px-2">
            <div className="text-2xl font-extrabold">SAVRDH</div>
            <p className="text-xs text-muted">Camera Control Studio</p>
            <span className="admin-role">Super Admin</span>
          </div>
          <nav className="flex flex-1 flex-col gap-1">
            {SECTIONS.map((s) => (
              <Link
                href={`/admin${s.id ? `/${s.id}` : ""}`}
                key={s.id}
                aria-label={s.label}
                aria-current={
                  path === `/admin${s.id ? `/${s.id}` : ""}`
                    ? "page"
                    : undefined
                }
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${path === `/admin${s.id ? `/${s.id}` : ""}` ? "bg-accent text-white" : "text-fg/80 hover:bg-line/10"}`}
              >
                <Icon name={s.icon as IconName} />
                <span>{s.label}</span>
              </Link>
            ))}
          </nav>
          <Link href="/live" aria-label="Open Camera Studio" className="admin-return">
            <Icon name="external" />
            <span>Open Camera Studio</span>
          </Link>
          <div className="admin-account">
            <span className="admin-avatar">S</span>
            <div>
              <b>Studio owner</b>
              <p>Local administrator</p>
            </div>
          </div>
        </aside>
        <div className="studio-main-column flex flex-1 flex-col min-w-0">
          <header className="studio-topbar motion-chrome flex items-center justify-between gap-3 border-b border-line/10 px-5 py-3">
            <div>
              <p className="eyebrow mb-1">PLATFORM CONTROL CENTER</p>
              <p className="text-sm font-semibold">
                {SECTIONS.find(
                  (s) => path === `/admin${s.id ? `/${s.id}` : ""}`,
                )?.label ?? "Super Admin"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="studio-badge">Local workspace</span>
              <button
                className="admin-signout"
                onClick={async () => {
                  try {
                    const r = await fetch("/api/admin/session", {
                      method: "DELETE",
                    });
                    if (!r.ok) throw new Error();
                    router.replace("/admin/login");
                    router.refresh();
                  } catch {
                    setError("Could not sign out. Please try again.");
                  }
                }}
              >
                Sign out
              </button>
            </div>
          </header>
          <main className="flex-1 min-h-0 overflow-auto p-d">
            {error && (
              <p role="alert" className="text-rec text-sm mb-3">
                {error}
              </p>
            )}
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
