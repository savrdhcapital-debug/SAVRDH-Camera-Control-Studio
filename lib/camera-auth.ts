export function cameraAuthConfigured() {
  const url = process.env.CAMERA_SUPABASE_URL;
  const key = process.env.CAMERA_SUPABASE_PUBLISHABLE_KEY;
  if (Boolean(url) !== Boolean(key)) throw new Error('Camera authentication configuration is incomplete.');
  return Boolean(url && key);
}
export function cameraAuthConfig() {
  if (!cameraAuthConfigured()) throw new Error('Camera authentication is not configured.');
  const url = new URL(process.env.CAMERA_SUPABASE_URL!);
  if (url.protocol !== 'https:') throw new Error('Camera authentication requires HTTPS.');
  return {url:url.origin,key:process.env.CAMERA_SUPABASE_PUBLISHABLE_KEY!};
}
export async function cameraUserIsAdmin(token:string, expectedUserId?:string) {
  const {url,key}=cameraAuthConfig();
  const headers={apikey:key,Authorization:`Bearer ${token}`};
  const userResponse=await fetch(`${url}/auth/v1/user`,{headers,cache:'no-store',signal:AbortSignal.timeout(15000)});
  if (!userResponse.ok) return null;
  const {id}=await userResponse.json();
  if(typeof id!=='string'||(expectedUserId && id!==expectedUserId)) return null;
  const roleResponse=await fetch(`${url}/rest/v1/camera_studio_admins?user_id=eq.${encodeURIComponent(id)}&enabled=eq.true&select=user_id`,{headers,cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!roleResponse.ok) return null;
  const roles=await roleResponse.json();
  return roles.length===1 ? id : null;
}
export async function signInCameraAdmin(email:unknown,password:unknown) {
  if(typeof email!=='string'||typeof password!=='string'||email.length>254||password.length>256) return null;
  const {url,key}=cameraAuthConfig();
  const response=await fetch(`${url}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({email,password}),cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!response.ok) return null;
  const result=await response.json();
  if(typeof result.access_token!=='string') return null;
  const userId=await cameraUserIsAdmin(result.access_token);
  if(!userId) return null;
  return {userId,accessToken:result.access_token,expiresAt:Math.min(Number(result.expires_at)*1000,Date.now()+3600000)};
}
