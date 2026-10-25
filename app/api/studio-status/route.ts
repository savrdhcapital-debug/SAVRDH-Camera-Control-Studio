import { localRequest } from "@/lib/admin-auth";
import { updateStudio } from "@/lib/admin-store";
export const runtime = "nodejs";
export async function PUT(req: Request) {
  if (!localRequest(req, true))
    return Response.json(
      { error: "Local studio requests only." },
      { status: 403 },
    );
  try {
    const raw = await req.text();
    if (raw.length > 2048) throw new Error();
    const s = JSON.parse(raw);
    if (
      typeof s.id !== "string" ||
      !/^[a-zA-Z0-9-]{10,80}$/.test(s.id) ||
      !["disconnected", "connecting", "connected", "error"].includes(s.status)
    )
      throw new Error();
    await updateStudio({
      id: s.id,
      name: String(s.name ?? "Camera Studio").slice(0, 120),
      mode: String(s.mode ?? "").slice(0, 30),
      status: s.status,
      recording: s.recording === true,
      liveView: s.liveView === true,
      shots: Math.max(0, Math.min(10000000, Number(s.shots) || 0)),
      lastSeen: Date.now(),
    });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Invalid studio status." }, { status: 400 });
  }
}
