"use client";
import { useEffect, useRef, useState } from "react";
import { useDirectBroadcast } from "@/components/useDirectBroadcast";
import { Btn, Card, Toggle } from "@/components/ui";
export default function StreamingPage() {
 const video=useRef<HTMLVideoElement>(null);
 const stream=useRef<MediaStream|null>(null);
 const broadcast=useDirectBroadcast(stream);
 const [streamKey,setStreamKey]=useState("");
 const recorder=useRef<MediaRecorder|null>(null);
 const mounted=useRef(true);
 const pending=useRef(false);
 const [active,setActive]=useState(false);
 const [busy,setBusy]=useState(false);
 const [recording,setRecording]=useState(false);
 const [audio,setAudio]=useState(true);
 const [error,setError]=useState("");
 const [source,setSource]=useState("Screen");
 const [destination,setDestination]=useState<"youtube"|"facebook">("youtube");
 const [download,setDownload]=useState<{url:string;ext:string}|null>(null);
 const downloadRef=useRef<string|null>(null);
 const [seconds,setSeconds]=useState(0);
 const stop=()=>{
  void broadcast.stop();
  if(recorder.current&&recorder.current.state!=="inactive") recorder.current.stop();
  stream.current?.getTracks().forEach(t=>t.stop()); stream.current=null;
  if(video.current) video.current.srcObject=null;
  setActive(false);
 };
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;const r=recorder.current;if(r&&r.state!=="inactive")r.stop();stream.current?.getTracks().forEach(t=>t.stop());if(downloadRef.current)URL.revokeObjectURL(downloadRef.current);};},[]);
 useEffect(()=>{if(!recording)return;const start=Date.now();const id=setInterval(()=>setSeconds(Math.floor((Date.now()-start)/1000)),1000);return()=>clearInterval(id);},[recording]);
 const connect=async(kind:"screen"|"webcam")=>{
  if(pending.current)return;pending.current=true;setBusy(true);setError("");
  try {
   if(!navigator.mediaDevices)throw new Error("Open this studio on localhost or HTTPS in a supported desktop browser.");
   if(kind==="screen"&&!navigator.mediaDevices.getDisplayMedia)throw new Error("Screen capture is unavailable in this browser. Use desktop Chrome or Edge.");
   const next=kind==="screen"?await navigator.mediaDevices.getDisplayMedia({video:{frameRate:30},audio}):await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1920},height:{ideal:1080}},audio});
   if(!mounted.current){next.getTracks().forEach(t=>t.stop());return;}
   stream.current?.getTracks().forEach(t=>t.stop());stream.current=next;
   if(video.current){video.current.srcObject=next;await video.current.play();}
   setSource(kind==="screen"?"Screen":"Webcam");setActive(true);
   next.getVideoTracks()[0].addEventListener("ended",()=>{if(stream.current===next)stop();},{once:true});
  }catch(e){if(stream.current){stream.current.getTracks().forEach(t=>t.stop());stream.current=null;}setActive(false);setError(e instanceof Error?e.message:"Could not connect source.");}
  finally{pending.current=false;if(mounted.current)setBusy(false);}
 };
 const record=()=>{
  setError("");
  try{
   if(!stream.current)return;
   if(typeof MediaRecorder==="undefined")throw new Error("Recording is unavailable in this browser.");
   const type=["video/webm;codecs=vp9,opus","video/webm;codecs=vp8,opus","video/mp4","video/webm"].find(t=>MediaRecorder.isTypeSupported(t));
   const r=new MediaRecorder(stream.current,type?{mimeType:type}:undefined);recorder.current=r;
   let bytes=0;const chunks:Blob[]=[];
   r.ondataavailable=e=>{if(e.data.size){chunks.push(e.data);bytes+=e.data.size;if(bytes>256*1024*1024&&r.state!=="inactive"){r.stop();if(mounted.current)setError("Recording reached the 256 MB limit. Download it, then start a new take.");}}};
   r.onstop=()=>{if(!mounted.current)return;const mime=r.mimeType||type||"video/webm";const blob=new Blob(chunks,{type:mime});if(downloadRef.current)URL.revokeObjectURL(downloadRef.current);const url=URL.createObjectURL(blob);downloadRef.current=url;setDownload({url,ext:mime.includes("mp4")?"mp4":"webm"});setRecording(false);};
   r.onerror=()=>{if(mounted.current){setError("Recording interrupted. Any captured data will be available when recording stops.");setRecording(false);}};
   r.start(1000);setSeconds(0);setRecording(true);
  }catch(e){setError(e instanceof Error?e.message:"Recording failed.");}
 };
 return <div className="streaming-page space-y-5">
  <div className="streaming-heading motion-chrome flex flex-wrap items-center justify-between gap-4"><div><p className="eyebrow">ON AIR, ON YOUR TERMS</p><h1 className="animated-title">Live Streaming Studio</h1><p className="text-sm text-muted mt-2">Connect your screen or webcam and broadcast directly to YouTube or Facebook.</p></div><span className="studio-badge">{recording?`Recording · ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,"0")}`:active?`${source} preview active`:"No source connected"}</span></div>
  <div className="streaming-workspace grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)]">
   <Card title="Program preview" right={<span className="text-xs text-muted">{active?source:"Standby"}</span>}>
    <div className="relative aspect-video overflow-hidden rounded-xl bg-black" id="program-preview" data-active={active}><video ref={video} autoPlay playsInline muted className="h-full w-full object-contain"/>{!active&&<div className="absolute inset-0 grid place-content-center text-center"><div className="text-4xl text-white/25 mb-4">◎</div><p className="text-white font-semibold">Your next live starts here.</p><p className="text-white/40 text-xs mt-2">Choose a screen, window, browser tab or webcam.</p></div>}</div>
    <div className="flex flex-wrap gap-2 mt-4"><Btn variant="primary" disabled={busy||active} onClick={()=>void connect("screen")}>{busy?"Connecting…":"Connect screen"}</Btn><Btn disabled={busy||active} onClick={()=>void connect("webcam")}>Connect webcam</Btn><Btn disabled={!active} onClick={stop}>Disconnect</Btn><Btn disabled={!active} onClick={()=>{void document.getElementById("program-preview")?.requestFullscreen().catch(()=>setError("Fullscreen is unavailable in this browser."));}}>Clean fullscreen</Btn></div>
    <div className="flex gap-3 items-center mt-4"><Btn variant={recording?"danger":"default"} disabled={!active||broadcast.busy} onClick={()=>recording?recorder.current?.stop():record()}>{recording?"Stop recording":"Record locally"}</Btn>{download&&<a className="text-sm text-accent underline" href={download.url} download={`savrdh-recording.${download.ext}`}>Download recording</a>}</div>
    {error&&<p role="alert" className="text-rec text-sm mt-4">{error}</p>}
   </Card>
   <div className="space-y-5"><Card title="Source settings"><Toggle label="Request source audio" hint="Applies on the next connection. Screen audio depends on your browser." checked={audio} onChange={setAudio}/><p className="text-xs text-muted mt-3">Preview is muted to prevent feedback. Webcam audio uses your microphone. Download recordings before leaving (256 MB per take).</p></Card>
   <Card title="Broadcast destination"><div className="flex gap-2 mb-4">{(["youtube","facebook"] as const).map(d=><button key={d} disabled={broadcast.busy} className={`flex-1 rounded-xl border p-3 text-sm ${destination===d?"border-accent bg-accent/10":"border-line/10"}`} aria-pressed={destination===d} onClick={()=>{setDestination(d);setStreamKey("");}}>{d==="youtube"?"YouTube Live":"Facebook Live"}</button>)}</div>
    <label className="setting-label">Stream key<input type="password" autoComplete="off" spellCheck={false} disabled={broadcast.busy} value={streamKey} onChange={e=>setStreamKey(e.target.value)} placeholder="Paste your platform stream key" className="rounded-xl border border-line/20 bg-panel2 px-3 py-2 text-sm"/></label>
    <p className="text-xs text-muted mb-3">Your key is used locally and never saved. Start broadcast sends your source to {destination==="youtube"?"YouTube":"Facebook"}.</p>
    <div className="flex flex-wrap gap-2"><Btn variant={broadcast.busy?"danger":"primary"} disabled={broadcast.busy?broadcast.state==="stopping":!active||recording||streamKey.trim().length<8||broadcast.ready!==true} onClick={()=>broadcast.busy?void broadcast.stop():void broadcast.start(destination,streamKey.trim()).then(()=>setStreamKey(""))}>{broadcast.busy?"Stop broadcast":"Start broadcast"}</Btn><a className="inline-flex items-center text-xs text-accent underline" target="_blank" rel="noreferrer" href={destination==="youtube"?"https://www.youtube.com/livestreaming":"https://www.facebook.com/live/producer"}>Open platform dashboard ↗</a></div>
    <p role="status" className={`text-xs mt-3 ${broadcast.state==="error"?"text-rec":"text-muted"}`}>{broadcast.ready===false?"Local encoder unavailable. Restart the local server after installing dependencies.":broadcast.message||"Local encoder ready · 720p / 30 fps · One destination at a time"}</p>
   </Card></div>
  </div>
  <details className="studio-card p-4"><summary className="cursor-pointer text-sm font-semibold">Direct broadcasting setup</summary><div className="grid gap-4 md:grid-cols-3 mt-4">{[["Connect a source","Choose a screen, browser tab or webcam. Source audio is included when your browser provides it; otherwise the encoder supplies silence."],["Add your stream key","Create a live broadcast in your platform dashboard and paste its stream key here. Keep the dashboard open to check video and audio."],["Start broadcasting","Select Start broadcast here. Confirm Go Live in the platform dashboard if required by its settings. Stop broadcast here when finished."]].map(([title,text])=><div key={title}><h2 className="font-semibold text-sm mb-2">{title}</h2><p className="text-xs text-muted">{text}</p></div>)}</div><p className="text-xs text-muted mt-4">The local server encodes and sends your source directly over RTMPS. Keep this tab and local server running. Only one platform can be streamed to at a time. The Sending status reports encoder output; your platform dashboard confirms whether the broadcast is public.</p></details>
 </div>;
}
