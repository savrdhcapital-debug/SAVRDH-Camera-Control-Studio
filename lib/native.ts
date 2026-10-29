export type DiscoveredCamera = { ip: string; port: number; name: string; demo: boolean; serial?: string; authenticationRequired?: boolean };
declare global {
  interface Window { savrdhNative?: { platform: string; localCamera: boolean } }
}
export function nativeCameraAvailable() { return typeof window !== "undefined" && window.savrdhNative?.localCamera === true; }
