"use client";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
type BroadcastState="idle"|"connecting"|"sending"|"stopping"|"error";
export function useDirectBroadcast(source:RefObject<MediaStream|null>){
 const [state,setState]=useState<BroadcastState>("idle");const [message,setMessage]=useState("");const [ready,setReady]=useState<boolean|null>(null);
 const session=useRef<string|null>(null);const recorder=useRef<MediaRecorder|null>(null);const poll=useRef<ReturnType<typeof setInterval>|null>(null);const chain=useRef(Promise.resolve());const bytes=useRef(0);const alive=useRef(true);const starting=useRef(false);
 const stop=useCallback(async()=>{
  if(poll.current){clearInterval(poll.current);poll.current=null;}
  const id=session.current;session.current=null;
  if(alive.current&&id)setState("stopping");
  const r=recorder.current;recorder.current=null;
  if(r&&r.state!=="inactive")r.stop();
  if(id)await fetch("/api/stream",{method:"DELETE",headers:{"x-stream-session":id},keepalive:true}).catch(()=>{});
  if(alive.current){setState("idle");setMessage("Broadcast stopped.");}
 },[]);
 useEffect(()=>{alive.current=true;fetch("/api/stream").then(r=>r.json()).then(d=>{if(alive.current)setReady(d.ready===true);}).catch(()=>{if(alive.current)setReady(false);});return()=>{alive.current=false;void stop();};},[stop]);
 const start=async(platform:"youtube"|"facebook",key:string)=>{
  if(starting.current||session.current||!source.current)return;
  starting.current=true;setState("connecting");setMessage("Connecting to the platform…");
  try{
   if(typeof MediaRecorder==="undefined")throw new Error("Direct streaming is not supported in this browser.");
   const mime=["video/webm;codecs=vp8,opus","video/webm;codecs=vp9,opus","video/mp4"].find(t=>MediaRecorder.isTypeSupported(t));if(!mime)throw new Error("Use a desktop browser with WebM or MP4 recording support.");
   const r=new MediaRecorder(source.current,{mimeType:mime,videoBitsPerSecond:3000000});recorder.current=r;
   const res=await fetch("/api/stream",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({platform,key,audio:source.current.getAudioTracks().length>0})});const data=await res.json();if(!res.ok)throw new Error(data.error??"Could not start the encoder.");
   const id=data.id as string;
   if(!alive.current){await fetch("/api/stream",{method:"DELETE",headers:{"x-stream-session":id},keepalive:true});return;}
   session.current=id;bytes.current=0;chain.current=Promise.resolve();
   const fail=async(text:string)=>{await stop();if(alive.current){setState("error");setMessage(text);}};
   r.ondataavailable=e=>{
    if(session.current!==id||!e.data.size)return;
    bytes.current+=e.data.size;
    if(bytes.current>12*1024*1024){void fail("Upload cannot keep up. Check your connection and start again.");return;}
    chain.current=chain.current.then(async()=>{if(session.current!==id)return;const response=await fetch("/api/stream",{method:"POST",headers:{"x-stream-session":id,"Content-Type":"application/octet-stream"},body:e.data,signal:AbortSignal.timeout(12000)});bytes.current-=e.data.size;if(!response.ok){const d=await response.json();throw new Error(d.error??"Video upload failed.");}}).catch(e=>{if(session.current===id)void fail(e instanceof Error?e.message:"Video upload failed.");});
   };
   r.onerror=()=>void fail("Browser encoder failed. Reconnect the source and try again.");
   r.onstop=()=>{if(session.current===id)void stop();};
   r.start(500);
   poll.current=setInterval(async()=>{if(session.current!==id)return;try{const res=await fetch("/api/stream",{headers:{"x-stream-session":id}});const d=await res.json();if(session.current!==id)return;if(!res.ok||d.state==="error"||d.state==="stopped"){void fail(d.message??d.error??"Broadcast ended.");return;}setState(d.state);setMessage(d.message);}catch{void fail("Lost connection to the local streaming server.");}},1500);
  }catch(e){await stop();if(alive.current){setState("error");setMessage(e instanceof Error?e.message:"Could not start broadcasting.");}}
  finally{starting.current=false;}
 };
 return {state,message,ready,start,stop,busy:state==="connecting"||state==="sending"||state==="stopping"};
}
