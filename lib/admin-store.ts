import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID, randomBytes } from "node:crypto";
import {
  ENTITIES,
  type AdminData,
  type AdminRow,
  type Entity,
  type StudioSnapshot,
} from "./admin-types";
const FILE = path.join(process.cwd(), "data", "admin-store.json");
const shared = globalThis as typeof globalThis & {
  adminWriteQueue?: Promise<unknown>;
};
const now = () => new Date().toISOString();
function initial(): AdminData {
  const t = now();
  return {
    version: 1,
    customers: [],
    licenses: [],
    payments: [],
    tickets: [],
    studio: [],
    audit: [],
    plans: [
      {
        id: "starter",
        name: "Starter",
        amount: 499,
        deviceLimit: 1,
        status: "Draft",
        createdAt: t,
        updatedAt: t,
      },
      {
        id: "creator",
        name: "Creator Pro",
        amount: 999,
        deviceLimit: 2,
        status: "Draft",
        createdAt: t,
        updatedAt: t,
      },
      {
        id: "studio",
        name: "Studio",
        amount: 1999,
        deviceLimit: 3,
        status: "Draft",
        createdAt: t,
        updatedAt: t,
      },
    ],
    models: [
      {
        id: "eos-r50",
        name: "Canon EOS R50",
        status: "Verify compatibility",
        connection: "CCAPI / Wi-Fi",
        notes:
          "Confirm CCAPI activation and firmware compatibility on your device.",
        createdAt: t,
        updatedAt: t,
      },
      {
        id: "webcam",
        name: "Built-in / USB Webcam",
        status: "Browser supported",
        connection: "Browser camera API",
        createdAt: t,
        updatedAt: t,
      },
    ],
  };
}
export async function readAdmin(): Promise<AdminData> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return initial();
    throw new Error(
      "Could not read the local admin store. Restore its backup before continuing.",
    );
  }
}
export function transaction<T>(
  fn: (data: AdminData) => T | Promise<T>,
): Promise<T> {
  const op = (shared.adminWriteQueue ?? Promise.resolve())
    .catch(() => {})
    .then(async () => {
      const data = await readAdmin();
      const result = await fn(data);
      await fs.mkdir(path.dirname(FILE), { recursive: true });
      const tmp = `${FILE}.${randomUUID()}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
      await fs.rename(tmp, FILE);
      return result;
    });
  shared.adminWriteQueue = op;
  return op;
}
const text = (v: unknown, max = 120) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";
const STATUSES: Record<Entity, string[]> = {
  customers: ["Active", "Trial", "Suspended", "Archived"],
  plans: ["Draft", "Active", "Archived"],
  licenses: ["Active", "Suspended", "Revoked", "Archived"],
  models: [
    "Verify compatibility",
    "Browser supported",
    "Supported",
    "Testing",
    "Planned",
    "Archived",
  ],
  payments: ["Pending", "Paid", "Refunded", "Archived"],
  tickets: ["Open", "In progress", "Resolved", "Archived"],
};
export async function saveRecord(
  entity: Entity,
  input: Record<string, unknown>,
  id?: string,
) {
  if (!ENTITIES.includes(entity)) throw new Error("Unknown record type.");
  return transaction((data) => {
    const existing = id ? data[entity].find((r) => r.id === id) : undefined;
    if (id && !existing) throw new Error("Record not found.");
    const name = text(input.name);
    if (name.length < 2)
      throw new Error("Enter a name with at least two characters.");
    const status = text(input.status);
    if (!STATUSES[entity].includes(status))
      throw new Error("Choose a valid status.");
    const row: AdminRow = {
      id: existing?.id ?? randomUUID(),
      name,
      status,
      createdAt: existing?.createdAt ?? now(),
      updatedAt: now(),
    };
    for (const field of [
      "email",
      "customerId",
      "planId",
      "notes",
      "connection",
      "expiresAt",
    ] as const) {
      const v = text(input[field], field === "notes" ? 2000 : 160);
      if (v) row[field] = v;
    }
    if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email))
      throw new Error("Enter a valid email address.");
    if (row.expiresAt && !/^\d{4}-\d{2}-\d{2}$/.test(row.expiresAt))
      throw new Error("Enter a valid expiry date.");
    if (entity === "customers" && !row.email)
      throw new Error("Customer email is required.");
    if (
      entity === "customers" &&
      data.customers.some(
        (r) =>
          r.id !== row.id &&
          r.email?.toLowerCase() === row.email?.toLowerCase(),
      )
    )
      throw new Error("A customer with this email already exists.");
    if (
      row.customerId &&
      !data.customers.some(
        (c) => c.id === row.customerId && c.status !== "Archived",
      )
    )
      throw new Error("Select an existing customer.");
    if (
      row.planId &&
      !data.plans.some((c) => c.id === row.planId && c.status !== "Archived")
    )
      throw new Error("Select an existing plan.");
    if (entity === "licenses" && (!row.customerId || !row.planId))
      throw new Error("A license needs a customer and a plan.");
    if (entity === "payments" && !row.customerId)
      throw new Error("A payment record needs a customer.");
    if (entity === "payments" || entity === "plans") {
      const n = Number(input.amount);
      if (!Number.isFinite(n) || n < 0 || n > 100000000)
        throw new Error("Enter a valid amount between 0 and 100,000,000.");
      row.amount = Math.round(n * 100) / 100;
    }
    if (entity === "plans") {
      const n = Number(input.deviceLimit);
      if (!Number.isInteger(n) || n < 1 || n > 1000)
        throw new Error("Device limit must be between 1 and 1,000.");
      row.deviceLimit = n;
    }
    if (entity === "licenses")
      row.licenseKey =
        existing?.licenseKey ??
        `SAV-${randomBytes(12)
          .toString("hex")
          .toUpperCase()
          .match(/.{1,6}/g)!
          .join("-")}`;
    data[entity] = existing
      ? data[entity].map((r) => (r.id === id ? row : r))
      : [row, ...data[entity]];
    data.audit = [
      {
        id: randomUUID(),
        at: now(),
        action: existing ? "Record updated" : "Record created",
        detail: `${entity}: ${name}`,
      },
      ...data.audit,
    ].slice(0, 1000);
    return row;
  });
}
export async function updateStudio(snapshot: StudioSnapshot) {
  return transaction((data) => {
    data.studio = [
      snapshot,
      ...data.studio.filter(
        (s) => s.id !== snapshot.id && Date.now() - s.lastSeen < 86400000,
      ),
    ].slice(0, 20);
  });
}
