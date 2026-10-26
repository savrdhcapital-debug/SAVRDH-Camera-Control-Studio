"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PanelMotion from "@/components/PanelMotion";
import { Btn } from "@/components/ui";
export default function Login() {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode,setAuthMode]=useState<"email"|"key"|null>(null);
  useEffect(()=>{fetch("/api/admin/session").then(r=>r.json()).then(d=>setAuthMode(d.authMode)).catch(()=>setError("Could not load sign-in settings. Please reload."));},[]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="admin-login">
      <div className="ambient-scene" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <section className="studio-card w-full max-w-md p-8">
        <PanelMotion />
        <div className="text-2xl font-extrabold mb-8">
          SAVRDH
          <span className="block text-xs font-normal text-muted mt-1">
            Camera Control Studio
          </span>
        </div>
        <p className="eyebrow">SUPER ADMIN</p>
        <h1 className="animated-title">
          Your studio.
          <br />
          Under control.
        </h1>
        <p className="text-sm text-muted mt-4 mb-6">
          Sign in with your Camera Studio administrator account.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const r = await fetch("/api/admin/session", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(authMode === "email" ? {email,password} : {key}),
              });
              const d = await r.json();
              if (!r.ok) throw new Error(d.error);
              setKey("");
              setPassword("");
              router.replace("/admin");
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Could not sign in.");
            } finally {
              setBusy(false);
            }
          }}
        >
          {authMode === "email" ? <>
            <label className="setting-label">Email address
              <input required type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Your administrator email" className="admin-input" />
            </label>
            <label className="setting-label">Password
              <input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password" className="admin-input" />
            </label>
          </> : authMode === "key" ? <>          <label className="setting-label">
            Administrator access key
            <input
              required
              autoFocus
              type="password"
              autoComplete="current-password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="Enter your private access key"
              className="admin-input"
            />
          </label>
</> : <p className="text-sm text-muted">Loading sign-in settings…</p>}
          {error && (
            <p role="alert" className="text-rec text-sm mb-4">
              {error}
            </p>
          )}
          <Btn variant="primary" className="w-full" disabled={busy || !authMode}>
            {busy ? "Signing in…" : "Sign in to Super Admin"}
          </Btn>
        </form>
        <p className="text-xs text-muted mt-5">
          {authMode === "email" ? "Only approved Camera Studio administrators can sign in. Sign in again after one hour." : "Use the private access file created during local setup. Sessions expire after eight hours."}
        </p>
        <Link href="/live" className="text-xs text-accent inline-block mt-6">
          Back to Camera Studio →
        </Link>
      </section>
    </main>
  );
}
