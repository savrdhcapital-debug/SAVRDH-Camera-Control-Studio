"use client";

import AppearanceStudio from "@/components/AppearanceStudio";
import { useState } from "react";
import { useCamera, type Conn } from "@/components/CameraProvider";
import Icon from "@/components/Icon";
import { Btn, Card, Radio } from "@/components/ui";

type Mode = "direct" | "network" | "auto" | "demo" | "webcam";
type Found = { ip: string; port: number; name: string; demo: boolean };

const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: "webcam", label: "Laptop Webcam", hint: "Use the built-in camera for live view, photos and video (browser permission required)" },
  { id: "direct", label: "Wi‑Fi (Direct)", hint: "Connect this computer to the camera’s Wi-Fi hotspot" },
  { id: "network", label: "Wi‑Fi (Network)", hint: "Connect the camera and computer to the same router" },
  { id: "auto", label: "Auto Detect", hint: "Scan the local network for a compatible CCAPI camera" },
  { id: "demo", label: "Demo Camera", hint: "Try a simulated EOS R50 without camera hardware" },
];

const IPV4 = /^(\d{1,3}\.){3}\d{1,3}$/;

function CameraArt() {
  return (
    <svg viewBox="0 0 220 150" className="h-40 w-full" aria-hidden>
      <rect x="10" y="40" width="200" height="90" rx="16" fill="currentColor" opacity="0.15" />
      <rect x="10" y="40" width="200" height="90" rx="16" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.5" />
      <path d="M70 40l10-18h60l10 18" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.5" />
      <circle cx="110" cy="88" r="38" fill="#0b0d12" stroke="currentColor" strokeWidth="3" opacity="0.9" />
      <circle cx="110" cy="88" r="24" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.5" />
      <circle cx="110" cy="88" r="9" fill="currentColor" opacity="0.4" />
      <rect x="22" y="52" width="26" height="12" rx="4" fill="currentColor" opacity="0.35" />
      <circle cx="186" cy="56" r="6" fill="currentColor" opacity="0.4" />
    </svg>
  );
}

export default function ConnectionPage() {
  const cam = useCamera();
  const [mode, setMode] = useState<Mode>("webcam");
  const [ip, setIp] = useState("192.168.1.1");
  const [port, setPort] = useState("8080");
  const [subnet, setSubnet] = useState("");
  const [found, setFound] = useState<Found[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState("");

  const connected = cam.status === "connected";
  const busy = cam.status === "connecting";

  const connectTo = (c: Conn) => void cam.connect(c);

  const scan = async () => {
    setScanning(true);
    setScanMsg("");
    setFound([]);
    try {
      const res = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subnet: subnet.trim() || undefined }),
      });
      const data = (await res.json()) as { cameras?: Found[]; message?: string; scanned?: number };
      if (!res.ok) throw new Error(data.message ?? "Scan failed");
      const list = data.cameras ?? [];
      setFound(list);
      setScanMsg(list.length ? `${list.length} camera(s) found` : `No cameras found (${data.scanned ?? 0} addresses scanned). Is CCAPI enabled?`);
      if (list.length === 1) connectFound(list[0]);
    } catch (e) {
      setScanMsg(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  };

  const connectFound = (f: Found) =>
    connectTo(
      f.demo
        ? { baseUrl: "mock", name: f.name, mode: "demo" }
        : { baseUrl: `http://${f.ip}:${f.port}`, name: f.name, mode: "network" },
    );

  const onConnect = () => {
    if (mode === "webcam") return connectTo({ baseUrl: "webcam", name: "Laptop Webcam", mode: "webcam" });
    if (mode === "demo") return connectTo({ baseUrl: "mock", name: "Canon EOS R50 (Demo)", mode: "demo" });
    if (mode === "auto") return void scan();
    if (!IPV4.test(ip) || !/^\d{2,5}$/.test(port)) {
      cam.notify("Enter a valid IP address and port, such as 192.168.1.1 : 8080", "error");
      return;
    }
    connectTo({ baseUrl: `http://${ip}:${port}`, name: "Canon EOS R50", mode });
  };

  return (
    <div className="grid gap-d lg:grid-cols-2">
      <Card className="connection-hero flex flex-col items-center justify-center text-center">
        <p className="eyebrow">YOUR CREATIVE CONNECTION</p>
        <h1 className="animated-title mb-6">Ready to Connect</h1>
        <div className="text-muted">
          <CameraArt />
        </div>
        <div className="mt-2 text-lg font-bold">{cam.conn?.name ?? "Canon EOS R50"}</div>
        <div className={`text-sm ${connected ? "text-ok" : cam.status === "error" ? "text-rec" : "text-muted"}`}>
          ● {connected ? "Connected" : busy ? "Connecting…" : cam.status === "error" ? "Error" : "Not connected"}
        </div>
        {cam.conn && (
          <div className="mt-1 text-xs text-muted">
            {cam.conn.mode === "demo" ? "Demo camera" : cam.conn.mode === "webcam" ? "Laptop webcam" : cam.conn.baseUrl.replace("http://", "IP: ")}
            {cam.info ? ` · FW ${cam.info.firmwareversion}` : ""}
          </div>
        )}
        {cam.error && <div className="mt-2 max-w-xs text-sm text-rec">{cam.error}</div>}
        {connected && (
          <div className="mt-4 flex gap-2">
            <Btn onClick={() => void cam.disconnect()}>Disconnect</Btn>
          </div>
        )}
      </Card>

      <Card title="Connect to Camera">
        <div className="flex flex-col gap-2">
          {MODES.map((m) => (
            <Radio key={m.id} checked={mode === m.id} label={m.label} hint={m.hint} onSelect={() => setMode(m.id)} />
          ))}
        </div>

        {(mode === "direct" || mode === "network") && (
          <div className="mt-3 grid grid-cols-[1fr_90px] gap-2">
            <label className="text-xs text-muted">
              Camera IP
              <input value={ip} onChange={(e) => setIp(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded-xl border border-line/10 bg-panel2 px-3 py-2 text-sm text-fg outline-none focus:border-accent" />
            </label>
            <label className="text-xs text-muted">
              Port
              <input value={port} onChange={(e) => setPort(e.target.value)} inputMode="numeric" className="mt-1 w-full rounded-xl border border-line/10 bg-panel2 px-3 py-2 text-sm text-fg outline-none focus:border-accent" />
            </label>
          </div>
        )}
        {mode === "auto" && (
          <label className="mt-3 block text-xs text-muted">
            Subnet (optional, for example 192.168.1)
            <input value={subnet} onChange={(e) => setSubnet(e.target.value)} placeholder="auto" className="mt-1 w-full rounded-xl border border-line/10 bg-panel2 px-3 py-2 text-sm text-fg outline-none focus:border-accent" />
          </label>
        )}

        <Btn variant="primary" className="mt-4 w-full" disabled={busy || scanning} onClick={onConnect}>
          {scanning ? "Scanning…" : busy ? "Connecting…" : mode === "auto" ? "Scan & Connect" : "Connect"}
        </Btn>

        {scanMsg && <p className="mt-2 text-xs text-muted">{scanMsg}</p>}
        {found.length > 1 && (
          <ul className="mt-2 space-y-2">
            {found.map((f) => (
              <li key={f.ip} className="flex items-center justify-between rounded-xl bg-panel2 px-3 py-2 text-sm">
                <span>{f.name} <span className="text-muted">({f.ip})</span></span>
                <Btn onClick={() => connectFound(f)}>Connect</Btn>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Paired cameras" className="lg:col-span-2">
        {cam.paired.length === 0 ? (
          <p className="text-sm text-muted">Connected cameras are saved here for one-click reconnection.</p>
        ) : (
          <ul className="divide-y divide-line/10">
            {cam.paired.map((p) => (
              <li key={`${p.serial}-${p.baseUrl}`} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="flex items-center gap-3">
                  <Icon name="camera" className="h-5 w-5 text-muted" />
                  <div>
                    <div className="text-sm font-medium">{p.name}</div>
                    <div className="text-xs text-muted">
                      {p.mode === "demo" ? "Demo" : p.mode === "webcam" ? "Webcam" : p.baseUrl.replace("http://", "")} · last seen {new Date(p.lastSeen).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Btn variant="primary" disabled={busy} onClick={() => connectTo(p)}>Reconnect</Btn>
                  <Btn variant="ghost" onClick={() => cam.forget(p)}>Forget</Btn>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="lg:col-span-2"><AppearanceStudio /></div>

      <Card title="Real camera setup" className="lg:col-span-2">
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
          <li>Enable CCAPI on your camera. Verify developer activation and compatibility with your model and firmware.</li>
          <li>Enable camera Wi-Fi and connect this computer to the same network or camera hotspot.</li>
          <li>Enter the camera IP address or use Auto Detect, then select Connect.</li>
          <li>Pairing saves the camera model and serial number. You may need to confirm the first connection on your camera.</li>
        </ol>
      </Card>
    </div>
  );
}
