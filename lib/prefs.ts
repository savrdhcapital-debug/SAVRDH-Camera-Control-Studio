import type { SettingName } from "./camera";

export type Grid = "off" | "thirds" | "cross";
export type Overlay = { grid: Grid; histogram: boolean; info: boolean; safeZone: boolean; mirror: boolean };

export type Prefs = {
  template: string;
  motionStyle: string;
  motion: boolean;
  motionSpeed: number;
  textMotion: boolean;
  cardEffects: boolean;
  glass: number;
  radius: number;
  font: "system" | "rounded" | "editorial";
  theme: "dark" | "oled" | "light";
  accent: string;
  density: "comfortable" | "compact";
  photoControls: SettingName[];
  videoControls: SettingName[];
  photoLayout: "bottom" | "side";
  liveOverlay: Overlay;
  monitorOverlay: Overlay;
  monitorMode: "ipad" | "duplicate" | "extended";
  lvSize: "small" | "medium";
  fps: number;
  autoReconnect: boolean;
};

export const DEFAULT_PREFS: Prefs = {
  template: "aurora",
  motionStyle: "aurora",
  motion: true,
  motionSpeed: 20,
  textMotion: true,
  cardEffects: true,
  glass: 80,
  radius: 22,
  font: "system",
  theme: "dark",
  accent: "#9164ff",
  density: "comfortable",
  photoControls: ["tv", "av", "iso", "exposure", "wb"],
  videoControls: ["tv", "av", "iso", "wb", "moviequality"],
  photoLayout: "bottom",
  liveOverlay: { grid: "off", histogram: true, info: true, safeZone: false, mirror: false },
  monitorOverlay: { grid: "thirds", histogram: true, info: true, safeZone: false, mirror: false },
  monitorMode: "duplicate",
  lvSize: "medium",
  fps: 12,
  autoReconnect: true,
};

export const ACCENTS = ["#2f7bff", "#22c55e", "#f59e0b", "#ef4444", "#a855f7", "#14b8a6"];

export function hexToChannels(hex: string): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return "47 123 255";
  return `${parseInt(m[1], 16)} ${parseInt(m[2], 16)} ${parseInt(m[3], 16)}`;
}
