import { NextResponse, type NextRequest } from 'next/server';
import { unsealData } from 'iron-session';
import { cameraAuthConfigured, cameraAuthConfig, cameraUserIsAdmin } from './lib/camera-auth';
export async function middleware(req:NextRequest) {
 const path=req.nextUrl.pathname;
 if(path==='/login'||path.startsWith('/admin')||path==='/api/customer/session'||path==='/api/trial'||path.startsWith('/api/admin')||path.startsWith('/_next/')||path==='/favicon.ico')return NextResponse.next();
 try {
  if(!cameraAuthConfigured()) throw Error('Access is not configured');
  const secret=process.env.CAMERA_ADMIN_SESSION_SECRET;
  if(!secret)throw Error('Sessions are not configured');
  for(const name of ['savrdh_admin','savrdh_customer']) {
   const value=req.cookies.get(name)?.value;if(!value)continue;
   const session=await unsealData<{accessToken?:string;userId?:string;expiresAt?:number}>(value,{password:secret,ttl:8*3600});
   if(!session.accessToken||!session.userId||!session.expiresAt||session.expiresAt<=Date.now())continue;
   if(name==='savrdh_admin' && await cameraUserIsAdmin(session.accessToken,session.userId))return NextResponse.next();
   const {url,key}=cameraAuthConfig();const headers={apikey:key,Authorization:`Bearer ${session.accessToken}`};
   const user=await fetch(`${url}/auth/v1/user`,{headers,cache:'no-store'});
   if(!user.ok||(await user.json()).id!==session.userId)continue;
   const response=await fetch(`${url}/rest/v1/camera_entitlements?user_id=eq.${encodeURIComponent(session.userId)}&select=status,starts_at,ends_at`,{headers,cache:'no-store'});
   if(!response.ok)continue;const rows=await response.json();const access=rows[0];
   if(access&&['trial','active'].includes(access.status)&&Date.parse(access.starts_at)<=Date.now()&&Date.parse(access.ends_at)>Date.now())return NextResponse.next();
  }
 } catch {}
 if(path.startsWith('/api/'))return NextResponse.json({error:'An approved trial or active subscription is required.'},{status:403,headers:{'Cache-Control':'no-store'}});
 return NextResponse.redirect(new URL('/login',req.url));
}
export const config={matcher:['/((?!_next/static|_next/image).*)']};
