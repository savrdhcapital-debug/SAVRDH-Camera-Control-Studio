"use client";

import { createContext, useCallback, useContext, useEffect, type ReactNode } from "react";
import { STUDIO_THEMES } from "@/lib/themes";
import { CONTROL_SETTINGS } from "@/lib/camera";
import { DEFAULT_PREFS, hexToChannels, type Prefs } from "@/lib/prefs";
import { useLocalStorage } from "@/lib/useLocalStorage";

type PrefsCtx = {
  prefs: Prefs;
  loaded: boolean;
  update: (p: Partial<Prefs>) => void;
  reset: () => void;
};

const Ctx = createContext<PrefsCtx | null>(null);

export function usePrefs() {
  const c = useContext(Ctx);
  if (!c) throw new Error("usePrefs outside PrefsProvider");
  return c;
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [raw, setRaw, loaded] = useLocalStorage<Prefs>("savrdh.prefs", DEFAULT_PREFS);

  // Sanitise anything read from storage.
  const prefs: Prefs = {
    ...raw,
    photoControls: raw.photoControls.filter((n) => CONTROL_SETTINGS.includes(n)),
    videoControls: raw.videoControls.filter((n) => CONTROL_SETTINGS.includes(n)),
    fps: Math.min(30, Math.max(2, Number(raw.fps) || 12)),
  };

  useEffect(() => {
    const r = document.documentElement;
    const t = STUDIO_THEMES.find(t => t.id === prefs.template) ?? STUDIO_THEMES[0];
    r.dataset.theme = prefs.theme;
    r.dataset.pattern = t.pattern;
    r.dataset.motionStyle = prefs.motionStyle;
    r.dataset.motion = String(prefs.motion);
    r.dataset.textMotion = String(prefs.textMotion);
    r.dataset.cardEffects = String(prefs.cardEffects);
    r.dataset.font = prefs.font;
    r.style.setProperty("--bg", t.bg);
    r.style.setProperty("--panel", t.panel);
    r.style.setProperty("--secondary", hexToChannels(t.secondary));
    r.style.setProperty("--motion-speed", `${Math.max(8, prefs.motionSpeed)}s`);
    r.style.setProperty("--glass", `${prefs.glass / 100}`);
    r.style.setProperty("--radius", `${prefs.radius}px`);
    r.dataset.density = prefs.density;
    r.style.setProperty("--accent", hexToChannels(prefs.accent));
  }, [prefs.theme, prefs.density, prefs.accent, prefs.template, prefs.motion, prefs.textMotion, prefs.cardEffects, prefs.font, prefs.motionStyle, prefs.motionSpeed, prefs.glass, prefs.radius]);

  const update = useCallback((p: Partial<Prefs>) => setRaw((prev) => ({ ...prev, ...p })), [setRaw]);
  const reset = useCallback(() => setRaw(DEFAULT_PREFS), [setRaw]);

  return <Ctx.Provider value={{ prefs, loaded, update, reset }}>{children}</Ctx.Provider>;
}
