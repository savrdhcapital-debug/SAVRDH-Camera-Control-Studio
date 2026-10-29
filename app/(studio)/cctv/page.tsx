"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { nativeCameraAvailable } from "@/lib/native";
import { Btn, Card } from "@/components/ui";
type CCTV = { id: string; name: string; kind: string; url: string };
type Device = { ip: string; name: string; url: string };
async function local<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || data.error || "Camera request failed.");
  return data as T;
}
function Preview({ camera }: { camera: CCTV }) {
  const [playing, setPlaying] = useState(false);
  const [image, setImage] = useState("");
  const [message, setMessage] = useState("Preview stopped");
  const currentURL = useRef("");
  useEffect(() => {
    if (!playing) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const response = await fetch(`/api/cctv/${camera.id}/frame`, { cache: "no-store" });
        if (!response.ok) { const data = await response.json(); throw new Error(data.message || "Preview unavailable."); }
        const blob = await response.blob();
        if (!alive) return;
        const old = currentURL.current;
        currentURL.current = URL.createObjectURL(blob);
        setImage(currentURL.current);
        setMessage("Live preview · no recording");
        if (old) setTimeout(() => URL.revokeObjectURL(old), 200);
      } catch (error) { if (alive) setMessage(error instanceof Error ? error.message : "Could not load the CCTV preview."); }
      if (alive) timer = setTimeout(tick, camera.kind === "snapshot" ? 1000 : 250);
    };
    void tick();
    return () => {
      alive = false; clearTimeout(timer);
      void fetch(`/api/cctv/${camera.id}/preview`, { method: "DELETE" }).catch(() => {});
      if (currentURL.current) URL.revokeObjectURL(currentURL.current);
      currentURL.current = "";
    };
  }, [playing, camera.id, camera.kind]);
  return <div className="rounded-2xl border border-line/10 bg-black/30 p-3">
    <div className="mb-3 flex items-center justify-between gap-3"><h2 className="font-semibold">{camera.name}</h2><Btn onClick={() => { setPlaying(!playing); setImage(""); setMessage(playing ? "Preview stopped" : "Connecting to camera…"); }}>{playing ? "Stop preview" : "Start preview"}</Btn></div>
    <div className="flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-black">{playing && image ? <img src={image} alt={`${camera.name} live camera view`} className="h-full w-full object-contain" /> : <p className="p-6 text-center text-sm text-muted">{playing ? "Waiting for camera video…" : "Select Start preview"}</p>}</div>
    <p role="status" className="mt-3 text-xs text-muted">{message}</p><p className="mt-1 break-all text-xs text-muted">{camera.url}</p>
  </div>;
}
export default function CCTVPage() {
  const [native, setNative] = useState(false);
  const [cameras, setCameras] = useState<CCTV[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [kind, setKind] = useState("onvif");
  const [name, setName] = useState("");
  const [url, setURL] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const load = useCallback(async () => { try { const data = await local<{ cameras: CCTV[] }>("/api/cctv"); setCameras(data.cameras); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not load cameras."); } }, []);
  useEffect(() => { const installed = nativeCameraAvailable(); setNative(installed); if (installed) void load(); }, [load]);
  async function discover() { setBusy(true); setMessage("Looking for ONVIF cameras on your local Wi-Fi…"); try { const data = await local<{ cameras: Device[] }>("/api/cctv/discover", "POST", {}); setDevices(data.cameras); setMessage(data.cameras.length ? `${data.cameras.length} ONVIF camera(s) found. Select one, then enter its local camera login.` : "No ONVIF devices replied. Enable local ONVIF/RTSP in the camera’s settings, or add its stream URL manually. Cloud-only cameras are not supported."); } catch (error) { setMessage(error instanceof Error ? error.message : "Discovery failed."); } finally { setBusy(false); } }
  async function save(event: React.FormEvent) { event.preventDefault(); setBusy(true); setMessage(""); try { const address = /^\d+\.\d+\.\d+\.\d+$/.test(url.trim()) && kind === "onvif" ? `http://${url.trim()}/onvif/device_service` : url.trim(); const data = await local<{ cameras: CCTV[] }>("/api/cctv", "POST", { name, kind, url: address, username, password }); setCameras(data.cameras); setPassword(""); setUsername(""); setName(""); setURL(""); setMessage("Camera saved on this Mac. Its password is stored in Keychain."); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save this camera."); } finally { setBusy(false); } }
  async function remove(camera: CCTV) { if (!confirm(`Remove ${camera.name} from this Mac? This does not erase the camera or its recordings.`)) return; try { const data = await local<{ cameras: CCTV[] }>(`/api/cctv/${camera.id}`, "DELETE"); setCameras(data.cameras); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not remove camera."); } }
  return <div className="space-y-4"><Card title="Local CCTV Studio"><p className="text-sm text-muted">View cameras on the same Wi-Fi. Up to four RTSP streams can preview together. Camera details stay on this Mac; passwords are stored in Apple Keychain.</p>{!native && <p className="mt-4 rounded-xl border border-line/10 p-4 text-sm">Open the installed SAVRDH Camera Studio Mac app to connect local CCTV cameras. The hosted website cannot read your Wi-Fi cameras.</p>}
    <div className="mt-4 flex flex-wrap gap-2"><Btn variant="primary" disabled={!native || busy} onClick={() => void discover()}>{busy ? "Working…" : "Find ONVIF cameras"}</Btn><Btn disabled={!native || busy} onClick={() => void load()}>Refresh saved cameras</Btn></div><p role="status" className="mt-3 text-sm text-muted">{message}</p>
    {devices.length > 0 && <div className="mt-3 grid gap-2 sm:grid-cols-2">{devices.map(device => <button key={device.url} onClick={() => { setKind("onvif"); setURL(device.url); setName(device.name); }} className="rounded-xl border border-line/10 p-3 text-left text-sm">{device.name}<span className="block text-xs text-muted">{device.url}</span></button>)}</div>}
  </Card>
  <Card title="Add a CCTV camera"><form onSubmit={event => void save(event)} className="grid gap-3 md:grid-cols-2"><label className="setting-label">Camera name<input required minLength={2} maxLength={80} className="admin-input" value={name} onChange={event => setName(event.target.value)} placeholder="Front entrance" /></label><label className="setting-label">Connection type<select className="admin-input" value={kind} onChange={event => setKind(event.target.value)}><option value="onvif">ONVIF (find stream automatically)</option><option value="rtsp">RTSP stream URL</option><option value="snapshot">HTTP JPEG/PNG snapshot URL</option></select></label><label className="setting-label md:col-span-2">{kind === "onvif" ? "Camera IP or ONVIF service address" : "Camera stream address"}<input required maxLength={2000} className="admin-input" value={url} onChange={event => setURL(event.target.value)} placeholder={kind === "onvif" ? "192.168.1.3" : kind === "rtsp" ? "rtsp://192.168.1.3:554/your-stream-path" : "http://192.168.1.3/your-snapshot-path"} /></label><label className="setting-label">Local camera username<input className="admin-input" autoComplete="off" value={username} onChange={event => setUsername(event.target.value)} /></label><label className="setting-label">Local camera password<input type="password" className="admin-input" autoComplete="off" value={password} onChange={event => setPassword(event.target.value)} /></label><p className="text-xs text-muted md:col-span-2">Use the camera’s own local account, not your phone-app or Studio account. The device ID shown in a phone app is not an RTSP address. Some cameras require ONVIF/RTSP to be enabled; manufacturer-only cloud streams cannot be opened here.</p><Btn variant="primary" disabled={!native || busy}>Save camera on this Mac</Btn></form></Card>
  <div className="grid gap-4 xl:grid-cols-2">{cameras.map(camera => <div key={camera.id}><Preview camera={camera} /><button className="mt-2 text-xs text-muted" onClick={() => void remove(camera)}>Remove saved camera</button></div>)}</div>
  {!cameras.length && <Card><p className="text-sm text-muted">No saved CCTV cameras yet. Find an ONVIF camera or add a supported local stream above.</p></Card>}</div>;
}
