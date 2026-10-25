import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash, timingSafeEqual } from "node:crypto";
export const AUTH_FILE = path.join(process.cwd(), "data", "admin-auth.json");
type Config = { keyHash: string; sessionSecret: string };
export async function adminConfig(): Promise<Config> {
  return JSON.parse(await fs.readFile(AUTH_FILE, "utf8"));
}
export async function adminSession() {
  const config = await adminConfig();
  return getIronSession<{ role?: string; version?: string }>(await cookies(), {
    password: config.sessionSecret,
    cookieName: "savrdh_admin",
    ttl: 8 * 3600,
    cookieOptions: {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.ADMIN_SECURE_COOKIE === "true",
      path: "/",
    },
  });
}
export async function isAdmin() {
  try {
    const session = await adminSession();
    const config = await adminConfig();
    return session.role === "superadmin" && session.version === config.keyHash;
  } catch {
    return false;
  }
}
export async function verifyKey(key: unknown) {
  if (typeof key !== "string" || key.length > 256) return false;
  const config = await adminConfig();
  const digest = createHash("sha256").update(key).digest();
  return timingSafeEqual(digest, Buffer.from(config.keyHash, "hex"));
}
export function localRequest(req: Request, mutation = false) {
  const url = new URL(req.url);
  const origin = new URL(
    `${url.protocol}//${req.headers.get("host") ?? url.host}`,
  );
  return (
    ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname) &&
    req.headers.get("sec-fetch-site") !== "cross-site" &&
    (!req.headers.get("origin") ||
      req.headers.get("origin") === origin.origin) &&
    (!mutation ||
      req.headers.get("content-type")?.startsWith("application/json"))
  );
}
