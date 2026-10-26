import {
  adminConfig,
  adminSession,
  isAdmin,
  adminRequest,
  verifyKey,
} from "@/lib/admin-auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const shared = globalThis as typeof globalThis & {
  adminAttempts?: { count: number; since: number };
};
export async function GET() {
  return Response.json(
    { authenticated: await isAdmin() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(req: Request) {
  if (!adminRequest(req, true))
    return Response.json(
      { error: "Admin sign-in is not allowed from this origin." },
      { status: 403 },
    );
  const now = Date.now();
  if (!shared.adminAttempts || now - shared.adminAttempts.since > 60000)
    shared.adminAttempts = { count: 0, since: now };
  if (shared.adminAttempts.count >= 10)
    return Response.json(
      { error: "Too many attempts. Try again in one minute." },
      { status: 429 },
    );
  shared.adminAttempts.count++;
  try {
    if (Number(req.headers.get("content-length") ?? 0) > 1024)
      return Response.json({ error: "Invalid request." }, { status: 400 });
    const { key } = await req.json();
    if (!(await verifyKey(key)))
      return Response.json(
        { error: "The admin access key is incorrect." },
        { status: 401 },
      );
    const session = await adminSession();
    session.role = "superadmin";
    session.version = (await adminConfig()).keyHash;
    await session.save();
    shared.adminAttempts.count = 0;
    return Response.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      {
        error:
          "Admin access is not configured. Configure the administrator secrets on the server.",
      },
      { status: 503 },
    );
  }
}
export async function DELETE(req: Request) {
  if (!adminRequest(req))
    return Response.json({ error: "Request rejected." }, { status: 403 });
  try {
    (await adminSession()).destroy();
  } catch {}
  return Response.json({ ok: true });
}
