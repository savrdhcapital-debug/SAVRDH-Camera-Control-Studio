import { NextRequest, NextResponse } from "next/server";
import { handleMock } from "@/lib/mock";
import { parseCameraBase } from "@/lib/security";

// Server-side proxy: browser → Next.js → Canon CCAPI (private LAN only).
// `__base` query param selects the camera ("mock" = built-in demo camera).
export const dynamic = "force-dynamic";

const MOCK_ENV = process.env.NEXT_PUBLIC_MOCK_MODE === "true";
const ENV_BASE = process.env.CCAPI_BASE_URL ?? "";

const PASS_HEADERS = ["content-type", "content-length", "content-range", "accept-ranges", "content-disposition"];

async function proxy(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const joined = path.join("/");
  const method = req.method;
  const hasBody = method !== "GET" && method !== "HEAD" && method !== "DELETE";
  const rawBody = hasBody ? await req.text() : "";

  const query = new URLSearchParams(req.nextUrl.searchParams);
  const baseParam = query.get("__base");
  query.delete("__base");

  if (MOCK_ENV || baseParam === "mock") {
    let body: Record<string, unknown> | null = null;
    try {
      body = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
    }
    const r = handleMock(method, joined, body, query);
    if (r.svg) {
      return new NextResponse(r.svg, {
        status: r.status,
        headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" },
      });
    }
    return NextResponse.json(r.json ?? {}, { status: r.status });
  }

  const base = parseCameraBase(baseParam ?? ENV_BASE);
  if (!base) {
    return NextResponse.json(
      { message: "No valid camera address. Only private LAN IPs (192.168.x.x, 10.x.x.x, 172.16-31.x.x) are allowed." },
      { status: 400 },
    );
  }

  const qs = query.toString();
  const target = `${base}/${joined}${qs ? `?${qs}` : ""}`;
  const headers: Record<string, string> = {};
  if (hasBody) headers["Content-Type"] = "application/json";
  const range = req.headers.get("range");
  if (range) headers["Range"] = range;

  try {
    const res = await fetch(target, {
      method,
      headers,
      body: hasBody && rawBody ? rawBody : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    const out = new Headers({ "Cache-Control": "no-store" });
    for (const h of PASS_HEADERS) {
      const v = res.headers.get(h);
      if (v) out.set(h, v);
    }
    return new NextResponse(res.body, { status: res.status, headers: out }); // streamed (large videos)
  } catch {
    return NextResponse.json(
      { message: `Camera unreachable at ${base}. Check Wi-Fi and that CCAPI is enabled.` },
      { status: 502 },
    );
  }
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as DELETE };
