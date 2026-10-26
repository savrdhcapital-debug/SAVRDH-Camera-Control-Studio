import type { AdminData } from './admin-types';

import { cameraAuthConfigured, cameraAuthConfig } from './camera-auth';
import { adminSession } from './admin-auth';
export const databaseConfigured = cameraAuthConfigured;
async function request(query: string, init: RequestInit = {}) {
  const {url:origin,key} = cameraAuthConfig();
  const url = `${origin}/rest/v1/camera_studio_state`;
  const session = await adminSession();
  if(!session.accessToken || !session.expiresAt || session.expiresAt<=Date.now()) throw new Error('Sign in to Camera Studio again.');
  const response = await fetch(`${url}${query}`, {
    ...init,
    cache: 'no-store',
    headers: { apikey:key, Authorization:`Bearer ${session.accessToken}`, 'Content-Type':'application/json', ...init.headers },
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
