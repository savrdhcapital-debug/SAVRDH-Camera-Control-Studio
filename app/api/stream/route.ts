import { encoderReady, sessions, startSession, stopSession } from "@/lib/stream-relay";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
function allowed(req:Request){const u=new URL(req.url);return ["localhost","127.0.0.1","[::1]"].includes(u.hostname)&&(!req.headers.get("origin")||req.headers.get("origin")===u.origin)&&req.headers.get("sec-fetch-site")!=="cross-site";}
async function limited(req:Request,max:number){const reader=req.body?.getReader();if(!reader)return new Uint8Array();const chunks:Uint8Array[]=[];let size=0;try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw new Error("Upload is too large.");}chunks.push(value);}}finally{reader.releaseLock();}const out=new Uint8Array(size);let offset=0;for(const c of chunks){out.set(c,offset);offset+=c.length;}return out;}
export async function GET(req:Request){if(!allowed(req))return json({error:"Use this feature on localhost."},403);const id=req.headers.get("x-stream-session");if(!id)return json({ready:await encoderReady()});const s=sessions.get(id);return s?json({state:s.state,message:s.message,bytes:s.bytes,frames:s.frames}):json({error:"Broadcast session has ended."},404);}
export async function POST(req:Request){
 if(!allowed(req))return json({error:"Use this feature on localhost."},403);
 try{
  const id=req.headers.get("x-stream-session");
  if(!id){const body=JSON.parse(new TextDecoder().decode(await limited(req,2048)));const s=await startSession(body.platform,body.key,body.audio===true);return json({id:s.id,state:s.state});}
  const s=sessions.get(id);if(!s)return json({error:"Broadcast session has ended."},404);
  if(s.state==="stopped"||s.state==="error")return json({error:s.message},409);
  const data=await limited(req,8*1024*1024);if(!data.length)return json({error:"Empty video chunk."},400);
  s.lastChunk=Date.now();
  await new Promise<void>((resolve,reject)=>{s.process.stdin?.write(data,(error: Error | null | undefined)=>error?reject(error):resolve());});s.bytes+=data.length;
  return json({ok:true});
 }catch(e){return json({error:e instanceof Error&&/Choose|Enter|already|encoder|large|installed/.test(e.message)?e.message:"Could not process the broadcast request."},400);}
}
export async function DELETE(req:Request){if(!allowed(req))return json({error:"Use this feature on localhost."},403);const s=sessions.get(req.headers.get("x-stream-session")??"");if(s)stopSession(s);return json({ok:true});}
