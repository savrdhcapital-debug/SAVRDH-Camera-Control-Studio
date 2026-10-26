import {cameraAuthConfig} from '@/lib/camera-auth';
export const dynamic='force-dynamic';
// Public legacy anon key: gateway invocation only; no privileged CRM credentials.
const CRM_PUBLIC_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkZmZnZXR1em9ldXB1aG9hdWJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwMzA0NTcsImV4cCI6MjEwMjYwNjQ1N30.t3Q25-gj2HvO3Z-OrUrvo4EKtk1Bum6PIjxGBQv-vM4';
const ALLOWED=['https://savrdhtechnologies.com','https://www.savrdhtechnologies.com','https://camera-control-studio.vercel.app'];
function response(req:Request,data:unknown,status=200){const origin=req.headers.get('origin')||'';return Response.json(data,{status,headers:{'Cache-Control':'no-store','Access-Control-Allow-Origin':ALLOWED.includes(origin)?origin:ALLOWED[0],'Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'POST, OPTIONS',Vary:'Origin'}});}
export async function OPTIONS(req:Request){return response(req,{ok:true});}
export async function POST(req:Request){
 const origin=req.headers.get('origin');if(origin&&!ALLOWED.includes(origin))return response(req,{error:'Origin not allowed.'},403);
 try{
 const raw=await req.text();if(raw.length>5000)return response(req,{error:'Request too large.'},413);
 const b=JSON.parse(raw);if(b.website)return response(req,{ok:true});
 const id=String(b.request_id||''),email=String(b.email||'').trim().toLowerCase(),name=String(b.customer_name||'').trim(),phone=String(b.phone||'').trim();
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id)||name.length<2||name.length>120||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!/^\+?[0-9()\s-]{8,18}$/.test(phone))return response(req,{error:'Enter valid contact details.'},400);
 const {url,key}=cameraAuthConfig();
 const saved=await fetch(`${url}/rest/v1/camera_trial_requests`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({id,email,customer_name:name,phone}),cache:'no-store',signal:AbortSignal.timeout(15000)});
 if(!saved.ok&&saved.status!==409)throw Error('Could not save the trial request. Please try again.');
 const crm=await fetch('https://ldffgetuzoeupuhoaubn.supabase.co/functions/v1/camera-lead-intake',{method:'POST',headers:{'Content-Type':'application/json',apikey:CRM_PUBLIC_KEY,Authorization:`Bearer ${CRM_PUBLIC_KEY}`},body:JSON.stringify({request_id:id,email,customer_name:name,phone}),signal:AbortSignal.timeout(15000)});
 const result=await crm.json().catch(()=>({}));if(!crm.ok||!result.crm_recorded)throw Error('Your trial request was saved, but CRM registration is pending. Please retry to complete registration.');
 return response(req,{ok:true,message:'Request received. Create and confirm your Camera Studio account with this email. Access begins only after Super Admin approval.'});
 }catch(e){return response(req,{error:e instanceof Error?e.message:'Request could not be completed.'},503);}
}
