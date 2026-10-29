"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { ALL_SETTINGS, camera, setCameraBase, setCameraLogger, type Setting, type SettingName } from "@/lib/camera";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { nativeCameraAvailable, type DiscoveredCamera } from "@/lib/native";
import { usePrefs } from "./PrefsProvider";

export type Status = "disconnected" | "connecting" | "connected" | "error";
export type Conn = { baseUrl: string; name: string; mode: "direct" | "network" | "demo" | "webcam"; serial?: string };
export type Paired = Conn & { lastSeen: number };
export type LogEntry = { t: number; level: "info" | "warn" | "error"; msg: string };
export type FrameStats = { fps: number; latencyMs: number; kbPerFrame: number; dropped: number; width: number; height: number };
export type Take = { n: number; startedAt: number; duration: number };
export type Info = { productname: string; serialnumber: string; firmwareversion: string };
export type Battery = { percent: number | null; label: string; name: string };
export type Storage = { total: number; free: number };
type Toast = { id: number; msg: string; kind: "info" | "error" };

interface Ctx {
  status: Status;
  error: string;
  conn: Conn | null;
  info: Info | null;
  settings: Partial<Record<SettingName, Setting>>;
  liveView: boolean;
  recording: boolean;
  elapsed: number;
  shots: number;
  lastShotAt: number;
  lastThumb: string;
  takes: Take[];
  battery: Battery | null;
  storage: Storage | null;
  logs: LogEntry[];
  frameStats: FrameStats | null;
  paired: Paired[];
  toast: Toast | null;
  connect: (c: Conn) => Promise<void>;
  reconnect: () => Promise<void>;
  disconnect: () => Promise<void>;
  forget: (p: Paired) => void;
  refreshSettings: () => Promise<void>;
  setSetting: (n: SettingName, v: string) => Promise<void>;
  setLiveView: (on: boolean) => Promise<void>;
  restartLiveView: () => Promise<void>;
  shutter: () => Promise<void>;
  af: (x?: number, y?: number) => Promise<void>;
  toggleRec: () => Promise<void>;
  notify: (msg: string, kind?: "info" | "error") => void;
  log: (level: LogEntry["level"], msg: string) => void;
  clearLogs: () => void;
  reportFrameStats: (s: FrameStats) => void;
  setLastThumb: (s: string) => void;
}

const CameraCtx = createContext<Ctx | null>(null);

export function useCamera() {
  const c = useContext(CameraCtx);
  if (!c) throw new Error("useCamera outside CameraProvider");
  return c;
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Unknown error");

export function CameraProvider({ children }: { children: ReactNode }) {
  const { prefs, loaded: prefsLoaded } = usePrefs();
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  const [status, setStatus] = useState<Status>("disconnected");
  const [error, setError] = useState("");
  const [conn, setConn] = useState<Conn | null>(null);
  const [info, setInfo] = useState<Info | null>(null);
  const [settings, setSettings] = useState<Partial<Record<SettingName, Setting>>>({});
  const [liveView, setLiveViewState] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [shots, setShots] = useState(0);
  const [lastShotAt, setLastShotAt] = useState(0);
  const [lastThumb, setLastThumb] = useState("");
  const [takes, setTakes] = useState<Take[]>([]);
  const [battery, setBattery] = useState<Battery | null>(null);
  const [storage, setStorage] = useState<Storage | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [frameStats, setFrameStats] = useState<FrameStats | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [saved, setSaved, savedLoaded] = useLocalStorage<Conn | null>("savrdh.conn", null);
  const [paired, setPaired] = useLocalStorage<Paired[]>("savrdh.paired", []);

  const lastConn = useRef<Conn | null>(null);
  const recStart = useRef<number | null>(null);
  const booted = useRef(false);

  const log = useCallback(
    (level: LogEntry["level"], msg: string) => setLogs((l) => [...l.slice(-499), { t: Date.now(), level, msg }]),
    [],
  );
  const notify = useCallback((msg: string, kind: "info" | "error" = "info") => setToast({ id: Date.now(), msg, kind }), []);

  useEffect(() => {
    setCameraLogger(log);
    return () => setCameraLogger(null);
  }, [log]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  const run = useCallback(
    async function run<T>(label: string, fn: () => Promise<T>): Promise<T | undefined> {
      try {
        return await fn();
      } catch (e) {
        const m = errMsg(e);
        log("error", `${label}: ${m}`);
        setToast({ id: Date.now(), msg: `${label}: ${m}`, kind: "error" });
        return undefined;
      }
    },
    [log],
  );

  const refreshSettings = useCallback(async () => {
    const res = await Promise.allSettled(ALL_SETTINGS.map((n) => camera.getSetting(n)));
    const next: Partial<Record<SettingName, Setting>> = {};
    res.forEach((r, i) => {
      if (r.status === "fulfilled") next[ALL_SETTINGS[i]] = r.value;
    });
    setSettings(next);
  }, []);

  const connect = useCallback(
    async (c: Conn) => {
      setStatus("connecting");
      setError("");
      setCameraBase(c.mode === "demo" ? "mock" : c.mode === "webcam" ? "webcam" : c.baseUrl);
      lastConn.current = c;
      try {
        const i = await camera.info();
        setInfo(i);
        const full: Conn = { ...c, name: i.productname || c.name, serial: i.serialnumber };
        lastConn.current = full;
        setConn(full);
        setSaved(full);
        setPaired((list) =>
          [
            { ...full, lastSeen: Date.now() },
            ...list.filter((p) => (p.serial && full.serial ? p.serial !== full.serial : p.baseUrl !== full.baseUrl)),
          ].slice(0, 8),
        );
        try {
          await camera.startLiveView(prefsRef.current.lvSize);
          setLiveViewState(true);
        } catch (e) {
          setLiveViewState(false);
          log("warn", `Live view could not start: ${errMsg(e)}`);
        }
        await refreshSettings();
        setStatus("connected");
        log("info", `Connected to ${full.name}`);
      } catch (e) {
        setError(errMsg(e));
        setStatus("error");
        log("error", `Connect failed: ${errMsg(e)}`);
      }
    },
    [log, refreshSettings, setPaired, setSaved],
  );

  const reconnect = useCallback(async () => {
    const c = lastConn.current ?? saved ?? paired[0] ?? null;
    if (c) await connect(c);
    else notify("No saved camera to reconnect", "error");
  }, [connect, notify, paired, saved]);

  const disconnect = useCallback(async () => {
    await camera.stopLiveView().catch(() => undefined);
    lastConn.current = null;
    setSaved(null);
    setCameraBase("");
    setStatus("disconnected");
    setConn(null);
    setInfo(null);
    setSettings({});
    setBattery(null);
    setStorage(null);
    setLiveViewState(false);
    setRecording(false);
    recStart.current = null;
    log("info", "Disconnected");
  }, [log, setSaved]);

  const forget = useCallback(
    (p: Paired) => setPaired((l) => l.filter((x) => !(x.baseUrl === p.baseUrl && x.serial === p.serial))),
    [setPaired],
  );

  const setSetting = useCallback(
    async (n: SettingName, v: string) => {
      const ok = await run(`Set ${n}`, async () => {
        await camera.setSetting(n, v);
        return true;
      });
      if (ok) setSettings((s) => (s[n] ? { ...s, [n]: { ...s[n]!, value: v } } : s));
    },
    [run],
  );

  const setLiveView = useCallback(
    async (on: boolean) => {
      const ok = await run("Live view", async () => {
        if (on) await camera.startLiveView(prefsRef.current.lvSize);
        else await camera.stopLiveView();
        return true;
      });
      if (ok) setLiveViewState(on);
    },
    [run],
  );

  const restartLiveView = useCallback(async () => {
    await run("Live view", async () => {
      await camera.stopLiveView().catch(() => undefined);
      await camera.startLiveView(prefsRef.current.lvSize);
      setLiveViewState(true);
    });
  }, [run]);

  const shutter = useCallback(async () => {
    const ok = await run("Shutter", async () => {
      await camera.shutter();
      return true;
    });
    if (ok) {
      setShots((s) => s + 1);
      setLastShotAt(Date.now());
    }
  }, [run]);

  const af = useCallback(
    async (x?: number, y?: number) => {
      await run("Autofocus", () => camera.af(x, y));
    },
    [run],
  );

  const toggleRec = useCallback(async () => {
    if (recording) {
      const ok = await run("Stop recording", async () => {
        await camera.recStop();
        return true;
      });
      if (ok) {
        const started = recStart.current ?? Date.now();
        setTakes((t) => [...t, { n: t.length + 1, startedAt: started, duration: Math.floor((Date.now() - started) / 1000) }]);
        setRecording(false);
        recStart.current = null;
      }
    } else {
      const ok = await run("Start recording", async () => {
        await camera.recStart();
        return true;
      });
      if (ok) {
        recStart.current = Date.now();
        setElapsed(0);
        setRecording(true);
      }
    }
  }, [recording, run]);

  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - (recStart.current ?? Date.now())) / 1000)), 250);
    return () => clearInterval(id);
  }, [recording]);

  // Heartbeat: battery + storage every 10 s; 3 misses = connection lost.
  useEffect(() => {
    if (status !== "connected") return;
    let fails = 0;
    let alive = true;
    const tick = async () => {
      try {
        const b = await camera.battery();
        if (!alive) return;
        setBattery(b);
        fails = 0;
        const s = await camera.storage().catch(() => null);
        if (alive && s) setStorage(s);
      } catch {
        fails++;
        if (alive && fails >= 3) {
          setStatus("error");
          setError("Connection lost");
          log("error", "Connection lost (3 failed heartbeats)");
        }
      }
    };
    tick();
    const id = setInterval(tick, 10000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [status, log]);

  // Auto-reconnect after a dropped connection.
  useEffect(() => {
    if (status !== "error" || !prefs.autoReconnect || !lastConn.current) return;
    const id = setTimeout(() => {
      log("info", "Auto-reconnecting…");
      const previous = lastConn.current;
      if (!previous) return;
      if (nativeCameraAvailable() && previous.serial && !["webcam", "demo"].includes(previous.mode)) {
        void (async () => {
          try {
            const response = await fetch("/api/discover", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
            if (!response.ok) throw new Error("Discovery unavailable");
            const data = await response.json() as { cameras?: DiscoveredCamera[] };
            const match = data.cameras?.find((candidate) => candidate.serial === previous.serial);
            if (match) { await connect({ ...previous, baseUrl: `http://${match.ip}:${match.port}` }); return; }
          } catch { log("warn", "Camera rediscovery failed; trying the last saved address."); }
          await connect(previous);
        })();
      } else void connect(previous);
    }, nativeCameraAvailable() ? 12000 : 5000);
    return () => clearTimeout(id);
  }, [status, prefs.autoReconnect, connect, log]);

  // Reconnect to the last camera on app start.
  useEffect(() => {
    if (booted.current || !savedLoaded || !prefsLoaded) return;
    booted.current = true;
    if (saved && prefs.autoReconnect) void connect(saved);
  }, [savedLoaded, prefsLoaded, saved, prefs.autoReconnect, connect]);

  const value: Ctx = {
    status,
    error,
    conn,
    info,
    settings,
    liveView,
    recording,
    elapsed,
    shots,
    lastShotAt,
    lastThumb,
    takes,
    battery,
    storage,
    logs,
    frameStats,
    paired,
    toast,
    connect,
    reconnect,
    disconnect,
    forget,
    refreshSettings,
    setSetting,
    setLiveView,
    restartLiveView,
    shutter,
    af,
    toggleRec,
    notify,
    log,
    clearLogs: () => setLogs([]),
    reportFrameStats: setFrameStats,
    setLastThumb,
  };

  return <CameraCtx.Provider value={value}>{children}</CameraCtx.Provider>;
}
