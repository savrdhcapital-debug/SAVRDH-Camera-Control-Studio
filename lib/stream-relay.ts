import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { access } from "node:fs/promises";
import ffmpegPath from "ffmpeg-static";
export type RelaySession = { id:string; process:ChildProcess; state:"connecting"|"sending"|"stopped"|"error"; message:string; bytes:number; frames:number; lastChunk:number; timer:ReturnType<typeof setInterval> };
const shared=globalThis as typeof globalThis & {studioRelaySessions?:Map<string,RelaySession>};
export const sessions=shared.studioRelaySessions??=new Map();
export async function encoderReady(){if(!ffmpegPath)return false;try{await access(ffmpegPath);return true;}catch{return false;}}
export function destinationUrl(platform:unknown,key:unknown){
 if(platform!=="youtube"&&platform!=="facebook")throw new Error("Choose YouTube or Facebook.");
 if(typeof key!=="string"||key.length<8||key.length>512||!/^[-a-zA-Z0-9_?=&%.]+$/.test(key))throw new Error("Enter a valid platform stream key (8–512 characters).");
 return `${platform==="youtube"?"rtmps://a.rtmps.youtube.com:443/live2/":"rtmps://live-api-s.facebook.com:443/rtmp/"}${key}`;
}
export function encoderArgs(url:string,hasAudio=true){return ["-hide_banner","-loglevel","error","-nostats","-progress","pipe:3","-fflags","+genpts","-thread_queue_size","512","-protocol_whitelist","pipe","-i","pipe:0",...(!hasAudio?["-f","lavfi","-i","anullsrc=channel_layout=stereo:sample_rate=44100"]:[]),"-map","0:v:0","-map",hasAudio?"0:a:0":"1:a:0","-shortest","-vf","scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2","-r","30","-c:v","libx264","-preset","veryfast","-tune","zerolatency","-pix_fmt","yuv420p","-b:v","3000k","-maxrate","3000k","-bufsize","6000k","-g","60","-c:a","aac","-b:a","128k","-ar","44100","-flvflags","no_duration_filesize","-f","flv",url];}
export function stopSession(s:RelaySession){
 clearInterval(s.timer);if(s.state!=="error"){s.state="stopped";s.message="Broadcast stopped.";}
 s.process.stdin?.end();
 const kill=setTimeout(()=>s.process.kill("SIGKILL"),3000);kill.unref();
 setTimeout(()=>sessions.delete(s.id),60000).unref();
}
export async function startSession(platform:unknown,key:unknown,hasAudio=true){
 const url=destinationUrl(platform,key);
 if(!await encoderReady())throw new Error("The local encoder is not installed. Install the ffmpeg-static package and restart the local server.");
 if([...sessions.values()].some(s=>s.state==="connecting"||s.state==="sending"))throw new Error("A broadcast is already running. Stop it before starting another.");
 const proc=spawn(ffmpegPath!,encoderArgs(url,hasAudio),{stdio:["pipe","ignore","pipe","pipe"],shell:false});
 const s:RelaySession={id:randomUUID(),process:proc,state:"connecting",message:"Connecting to the platform…",bytes:0,frames:0,lastChunk:Date.now(),timer:setInterval(()=>{},30000)};
 clearInterval(s.timer);
 s.timer=setInterval(()=>{if(Date.now()-s.lastChunk>20000){s.state="error";s.message="Broadcast stopped: no video received for 20 seconds.";stopSession(s);}},5000);s.timer.unref();
 sessions.set(s.id,s);
 // Never log encoder stderr: destination URLs can contain a private stream key.
 proc.stderr?.resume();
 proc.stdin?.on("error",()=>{if(s.state!=="stopped"){s.state="error";s.message="Encoder disconnected. Check your stream key and platform dashboard.";stopSession(s);}});
 let progress="";
 proc.stdio[3]?.on("data",(buf:Buffer)=>{progress+=buf.toString();const lines=progress.split("\n");progress=lines.pop()??"";for(const line of lines){if(line.startsWith("frame=")){s.frames=Number(line.slice(6))||0;if(s.frames>0&&s.state==="connecting"){s.state="sending";s.message="Sending video. Check your platform dashboard to confirm the public broadcast.";}}}});
 proc.on("error",()=>{s.state="error";s.message="The local encoder could not start.";stopSession(s);});
 proc.on("exit",code=>{if(s.state!=="stopped"){s.state="error";s.message=code===0?"Encoder ended. Start a new broadcast to reconnect.":"Platform connection failed. Check the stream key, live access and internet connection.";}clearInterval(s.timer);setTimeout(()=>sessions.delete(s.id),60000).unref();});
 return s;
}
