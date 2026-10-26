import type { AdminData } from './admin-types';

// Server-only credentials. No NEXT_PUBLIC_ variables are used here.
export function databaseConfigured() {
  const url = process.env.CAMERA_SUPABASE_URL;
  const key = process.env.CAMERA_SUPABASE_SERVICE_ROLE_KEY;
  if (Boolean(url) !== Boolean(key)) throw new Error('Camera database configuration is incomplete.');
  return Boolean(url && key);
}
function config() {
  if (!databaseConfigured()) throw new Error('Camera database is not configured.');
  const url = new URL(process.env.CAMERA_SUPABASE_URL!);
  if (url.protocol !== 'https:') throw new Error('Camera database requires HTTPS.');
  return { url: `${url.origin}/rest/v1/camera_studio_state`, key: process.env.CAMERA_SUPABASE_SERVICE_ROLE_KEY! };
}
async function request(query: string, init: RequestInit = {}) {
  const {url,key} = config();
  const response = await fetch(`${url}${query}`, {
    ...init,
    cache: 'no-store',
    headers: { apikey:key, Authorization:`Bearer ${key}`, 'Content-Type':'application/json', ...init.headers },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('Camera database request failed. Check server configuration and database availability.');
  return response.json();
}
export async function readCameraDatabase(): Promise<{payload: AdminData; revision:number} | null> {
  const rows = await request('?id=eq.main&select=payload,revision');
  return rows[0] ?? null;
}
export async function writeCameraDatabase(payload: AdminData, revision: number | null): Promise<boolean> {
  if (revision === null) {
    const rows = await request('?on_conflict=id', {method:'POST', headers:{Prefer:'resolution=ignore-duplicates,return=representation'}, body:JSON.stringify({id:'main',payload,revision:1})});
    return rows.length === 1;
  }
  const rows = await request(`?id=eq.main&revision=eq.${revision}`, {method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({payload,revision:revision+1,updated_at:new Date().toISOString()})});
  return rows.length === 1;
}
