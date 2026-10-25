"use client";

import PanelMotion from "./PanelMotion";
import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Card({
  title,
  right,
  children,
  className = "",
}: {
  title?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`studio-card rounded-2xl border border-line/10 bg-panel p-d ${className}`}>
      <PanelMotion />
      {(title || right) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-fg">{title}</h2>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "primary" | "danger" | "ghost" };

export function Btn({ variant = "default", className = "", ...p }: BtnProps) {
  const v = {
    default: "bg-panel2 border border-line/10 hover:border-line/25",
    primary: "bg-accent text-white hover:brightness-110",
    danger: "bg-rec text-white hover:brightness-110",
    ghost: "hover:bg-line/10",
  }[variant];
  return (
    <button
      {...p}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${v} ${className}`}
    />
  );
}

export function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div>
        <div className="text-sm">{label}</div>
        {hint && <div className="text-xs text-muted">{hint}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-accent" : "bg-line/20"}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </div>
  );
}

export function Radio({ checked, label, hint, onSelect }: { checked: boolean; label: string; hint?: string; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={checked}
      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
        checked ? "border-accent/60 bg-accent/10" : "border-line/10 hover:border-line/25"
      }`}
    >
      <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border ${checked ? "border-accent" : "border-line/40"}`}>
        {checked && <span className="h-2 w-2 rounded-full bg-accent" />}
      </span>
      <span>
        <span className="block text-sm">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </button>
  );
}

export function NotConnected({ what }: { what: string }) {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-line/20 p-10 text-center text-muted">
      <p className="mb-3">Connect a camera to use {what}.</p>
      <Link href="/connection" className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white">
        Go to Connection
      </Link>
    </div>
  );
}
