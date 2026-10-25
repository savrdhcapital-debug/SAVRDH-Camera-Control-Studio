import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";

// Local file storage for Media Library organisation (favorites, albums, downloaded).
export const dynamic = "force-dynamic";

type Meta = { favorites: string[]; albums: Record<string, string[]>; downloaded: string[] };
const FILE = path.join(process.cwd(), "data", "library.json");
const EMPTY: Meta = { favorites: [], albums: {}, downloaded: [] };

const strArr = (v: unknown, max = 20000): string[] | null =>
  Array.isArray(v) && v.length <= max && v.every((x) => typeof x === "string" && x.length < 512) ? (v as string[]) : null;

function validate(v: unknown): Meta | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const favorites = strArr(o.favorites);
  const downloaded = strArr(o.downloaded);
  if (!favorites || !downloaded) return null;
  if (!o.albums || typeof o.albums !== "object" || Array.isArray(o.albums)) return null;
  const albums: Record<string, string[]> = {};
  const entries = Object.entries(o.albums as Record<string, unknown>);
  if (entries.length > 200) return null;
  for (const [k, val] of entries) {
    const a = strArr(val);
    if (!a || k.length > 80) return null;
    albums[k] = a;
  }
  return { favorites, albums, downloaded };
}

export async function GET() {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    return NextResponse.json(validate(JSON.parse(raw)) ?? EMPTY);
  } catch {
    return NextResponse.json(EMPTY);
  }
}

export async function PUT(req: Request) {
  const meta = validate(await req.json().catch(() => null));
  if (!meta) return NextResponse.json({ message: "Invalid library data" }, { status: 400 });
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(meta, null, 2), "utf8");
  return NextResponse.json({ ok: true });
}
