import {adminRequest} from '@/lib/admin-auth';
import {cameraAuthConfig} from '@/lib/camera-auth';
import {customerSession} from '@/lib/customer-auth';
export const dynamic='force-dynamic';
export async function POST(req:Request){
 if(!adminRequest(req,true))return Response.json({error:'Request rejected.'},{status:403});
 try{
 const raw=await req.text();if(raw.length>2048)return Response.json({error:'Request too large.'},{status:413});
 const b=JSON.parse(raw);if(typeof b.email!=='string'||typeof b.password!=='string'||b.email.length>254||b.password.length<8||b.password.length>256)throw Error('Enter a valid email and a password with at least eight characters.');
 const {url,key}=cameraAuthConfig();const signup=b.action==='signup';
 const r=await fetch(`${url}/auth/v1/${signup?'signup':'token?grant_type=password'}`,{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({email:b.email,password:b.password}),cache:'no-store',signal:AbortSignal.timeout(15000)});
 const data=await r.json();if(!r.ok)throw Error(signup?'Account could not be created. Check your details or try signing in.':'Email or password is incorrect.');
 if(signup)return Response.json({message:'Account request received. If confirmation is required, check your email. Sign in after confirmation. Trial access still requires administrator approval.'});
 if(!data.access_token||!data.user?.id)throw Error('Could not create a session.');
 const session=await customerSession();session.userId=data.user.id;session.accessToken=data.access_token;session.expiresAt=Date.now()+Math.min(Number(data.expires_in)||3600,3600)*1000;await session.save();
 const response=await fetch(`${url}/rest/v1/camera_entitlements?user_id=eq.${encodeURIComponent(data.user.id)}&select=status,starts_at,ends_at`,{headers:{apikey:key,Authorization:`Bearer ${data.access_token}`},cache:'no-store'});
 if(!response.ok)throw Error('Could not check trial status.');const [access]=await response.json();
 const active=access&&['trial','active'].includes(access.status)&&Date.parse(access.starts_at)<=Date.now()&&Date.parse(access.ends_at)>Date.now();
 return Response.json(active?{active:true}:{active:false,message:'Your account is signed in. Access requires Super Admin trial approval or an active subscription.'},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Sign-in failed.'},{status:400});}
}
export async function DELETE(req:Request){if(!adminRequest(req,true))return Response.json({error:'Rejected'},{status:403});(await customerSession()).destroy();return Response.json({ok:true});}
