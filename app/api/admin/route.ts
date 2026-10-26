import { isAdmin, adminRequest } from "@/lib/admin-auth";
import { readAdmin, saveRecord } from "@/lib/admin-store";
import { ENTITIES, type Entity } from "@/lib/admin-types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
export async function GET(req: Request) {
  if (!adminRequest(req) || !(await isAdmin()))
    return json({ error: "Admin sign-in required." }, 401);
  try {
    return json(await readAdmin());
  } catch {
    return json({ error: "Could not read admin records. Check the database connection." }, 500);
  }
}
export async function POST(req: Request) {
  if (!adminRequest(req, true) || !(await isAdmin()))
    return json({ error: "Admin sign-in required." }, 401);
  try {
    const text = await req.text();
    if (text.length > 10000) return json({ error: "Request too large." }, 413);
    const body = JSON.parse(text);
    if (!ENTITIES.includes(body.entity))
      return json({ error: "Unknown record type." }, 400);
    if (!body.record || typeof body.record !== "object")
      return json({ error: "Invalid record." }, 400);
    return json(
      await saveRecord(
        body.entity as Entity,
        body.record,
        typeof body.id === "string" ? body.id : undefined,
      ),
    );
  } catch (e) {
    return json(
      { error: e instanceof Error ? e.message : "Could not save the record." },
      400,
    );
  }
}
