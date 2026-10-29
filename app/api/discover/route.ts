import { NextResponse } from "next/server";
import os from "node:os";
import { isPrivateIPv4, isPrivateSubnetPrefix } from "@/lib/security";

// Auto Detect: probes a /24 for a CCAPI endpoint (port 8080) from the server's network.
export const dynamic = "force-dynamic";

const MOCK_ENV = process.env.NEXT_PUBLIC_MOCK_MODE === "true";

async function probe(ip: string) {
  try {
    const r = await fetch(`http://${ip}:8080/ccapi`, { signal: AbortSignal.timeout(700), cache: "no-store" });
    if (!r.ok) return null;
    let name = "Canon camera";
    try {
      const d = await fetch(`http://${ip}:8080/ccapi/ver100/deviceinformation`, {
        signal: AbortSignal.timeout(1200),
        cache: "no-store",
      });
      if (d.ok) {
        const j = (await d.json()) as { productname?: string };
        if (j.productname) name = j.productname;
      }
    } catch {
      /* keep generic name */
    }
    return { ip, port: 8080, name, demo: false };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { subnet?: string; demo?: boolean };

  if (body.demo || MOCK_ENV) {
    return NextResponse.json({ cameras: [{ ip: "demo", port: 0, name: "Canon EOS R50 (Demo)", demo: true }] });
  }

  if (process.env.VERCEL) {
    return NextResponse.json({ message: "The hosted website cannot scan your Wi-Fi. Open the installed SAVRDH Camera Studio app on the same router as the camera, then use Auto Detect." }, { status: 409 });
  }

  const prefixes = new Set<string>();
  if (body.subnet) {
    if (!isPrivateSubnetPrefix(body.subnet)) {
      return NextResponse.json({ message: "Subnet must look like 192.168.1 (private range)" }, { status: 400 });
    }
    prefixes.add(body.subnet);
  } else {
    for (const list of Object.values(os.networkInterfaces())) {
      for (const a of list ?? []) {
        if (a.family === "IPv4" && !a.internal && isPrivateIPv4(a.address)) {
          prefixes.add(a.address.split(".").slice(0, 3).join("."));
        }
      }
    }
    prefixes.add("192.168.1");
  }

  const ips: string[] = [];
  for (const p of [...prefixes].slice(0, 4)) for (let i = 1; i < 255; i++) ips.push(`${p}.${i}`);

  const found: NonNullable<Awaited<ReturnType<typeof probe>>>[] = [];
  for (let i = 0; i < ips.length; i += 64) {
    const batch = await Promise.all(ips.slice(i, i + 64).map(probe));
    for (const b of batch) if (b) found.push(b);
  }
  return NextResponse.json({ cameras: found, scanned: ips.length });
}
