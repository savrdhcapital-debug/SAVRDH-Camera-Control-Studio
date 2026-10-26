"use client";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  ENTITIES,
  SECTIONS,
  type Entity,
  type AdminData,
  type AdminRow,
} from "@/lib/admin-types";
import AppearanceStudio from "../AppearanceStudio";
import Icon from "../Icon";
import { Btn, Card } from "../ui";
const money = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
const date = (s: string) =>
  new Date(s).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
const statusOptions: Record<Entity, string[]> = {
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
const singular: Record<Entity, string> = {
  customers: "customer",
  plans: "plan",
  licenses: "license",
  models: "camera model",
  payments: "payment record",
  tickets: "support ticket",
};
const activeLicense = (r: AdminRow) =>
  r.status === "Active" &&
  (!r.expiresAt || new Date(`${r.expiresAt}T23:59:59`).getTime() >= Date.now());
function Badge({ status }: { status: string }) {
  return (
    <span
      className={`admin-status ${["Active", "Paid", "Supported", "Browser supported", "Resolved"].includes(status) ? "status-good" : ["Suspended", "Revoked", "Refunded"].includes(status) ? "status-bad" : ""}`}
    >
      {status}
    </span>
  );
}
export default function AdminWorkspace({ section }: { section: string }) {
  const router = useRouter();
  const [data, setData] = useState<AdminData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [editor, setEditor] = useState<{
    entity: Entity;
    row?: AdminRow;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [range, setRange] = useState(30);
  const dialog = useRef<HTMLDialogElement>(null);
  const mounted = useRef(true);
  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin", { cache: "no-store" });
      if (r.status === 401) {
        router.replace("/admin/login");
        return;
      }
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      if (mounted.current) {
        setData(d);
        setError("");
      }
    } catch (e) {
      if (mounted.current)
        setError(e instanceof Error ? e.message : "Could not load admin data.");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [router]);
  useEffect(() => {
    mounted.current = true;
    void load();
    const timer = setInterval(() => void load(), 15000);
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, [load]);
  useEffect(() => {
    setSearch("");
    setFilter("All");
    setNotice("");
  }, [section]);
  useEffect(() => {
    if (editor) dialog.current?.showModal();
    else dialog.current?.close();
  }, [editor]);
  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editor) return;
    setBusy(true);
    setNotice("");
    try {
      const record = Object.fromEntries(new FormData(e.currentTarget));
      const r = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: editor.entity,
          id: editor.row?.id,
          record,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setEditor(null);
      setNotice("Record saved.");
      await load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not save the record.");
    } finally {
      setBusy(false);
    }
  };
  if (loading)
    return (
      <div className="admin-empty">
        <span className="admin-loader" />
        Loading your workspace…
      </div>
    );
  if (!data)
    return (
      <Card title="Workspace unavailable">
        <p role="alert" className="text-rec text-sm">
          {error}
        </p>
        <Btn className="mt-4" onClick={() => void load()}>
          Try again
        </Btn>
      </Card>
    );
  const title = SECTIONS.find((s) => s.id === section)?.label ?? "Dashboard";
  const customers = data.customers.filter((c) => c.status !== "Archived");
  const licenses = data.licenses.filter(activeLicense);
  const paid = data.payments.filter((p) => p.status === "Paid");
  const revenue = paid.reduce((sum, p) => sum + (p.amount ?? 0), 0);
  const monthly = licenses.reduce(
    (sum, l) => sum + (data.plans.find((p) => p.id === l.planId)?.amount ?? 0),
    0,
  );
  const fresh = data.studio.filter((s) => Date.now() - s.lastSeen < 35000);
  const connected = fresh.filter((s) => s.status === "connected");
  const openTickets = data.tickets.filter(
    (t) => t.status === "Open" || t.status === "In progress",
  );
  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "savrdh-admin-export.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const entity = ENTITIES.includes(section as Entity)
    ? (section as Entity)
    : null;
  const reference = (id: string | undefined, kind: "customers" | "plans") =>
    data[kind].find((r) => r.id === id)?.name ?? "—";
  const filtered = entity
    ? data[entity].filter(
        (r) =>
          (filter === "All" ? r.status !== "Archived" : r.status === filter) &&
          [
            r.name,
            r.email,
            r.licenseKey,
            reference(r.customerId, "customers"),
            reference(r.planId, "plans"),
          ]
            .join(" ")
            .toLowerCase()
            .includes(search.toLowerCase()),
      )
    : [];
  const metricCards = [
    ["Total customers", customers.length, "Saved customer records", "user"],
    ["Active licenses", licenses.length, "Camera Studio license registry", "check"],
    ["Monthly plan value", money(monthly), "Based on active licenses", "pulse"],
    [
      "Recorded revenue",
      money(revenue),
      "Paid records · manual ledger",
      "download",
    ],
    [
      "Connected studios",
      connected.length,
      `${fresh.length} recently seen browsers`,
      "monitor",
    ],
    ["Open tickets", openTickets.length, "Open and in progress", "info"],
  ] as const;
  const chart = () => {
    const buckets = Array.from({ length: 7 }, (_, i) => {
      const from = Date.now() - range * 86400000 + ((i * range) / 7) * 86400000;
      return paid
        .filter(
          (p) =>
            +new Date(p.createdAt) >= from &&
            +new Date(p.createdAt) < from + (range / 7) * 86400000,
        )
        .reduce((sum, p) => sum + (p.amount ?? 0), 0);
    });
    const max = Math.max(...buckets, 1);
    const points = buckets
      .map((n, i) => `${30 + i * 75},${150 - (n / max) * 110}`)
      .join(" ");
    return (
      <>
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-semibold text-sm">Recorded revenue overview</h2>
          <div className="admin-range">
            {[7, 30, 90].map((n) => (
              <button
                key={n}
                aria-pressed={range === n}
                onClick={() => setRange(n)}
              >
                {n}D
              </button>
            ))}
          </div>
        </div>
        <svg
          className="admin-chart"
          viewBox="0 0 510 180"
          role="img"
          aria-label={`Paid ledger revenue over the last ${range} days`}
        >
          <defs>
            <linearGradient id="adminRevenueFill" x1="0" y1="0" x2="0" y2="1">
              <stop stopColor="rgb(var(--accent))" stopOpacity=".45" />
              <stop offset="1" stopColor="rgb(var(--accent))" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[40, 95, 150].map((y) => (
            <line
              key={y}
              x1="25"
              x2="490"
              y1={y}
              y2={y}
              stroke="currentColor"
              opacity=".1"
            />
          ))}
          <polygon
            points={`30,150 ${points} 480,150`}
            fill="url(#adminRevenueFill)"
          />
          <polyline
            points={points}
            fill="none"
            stroke="rgb(var(--accent))"
            strokeWidth="3"
          />
          {buckets.map((n, i) => (
            <circle
              key={i}
              cx={30 + i * 75}
              cy={150 - (n / max) * 110}
              r="4"
              fill="rgb(var(--accent))"
            >
              <title>{money(n)}</title>
            </circle>
          ))}
        </svg>
        <div className="flex justify-between text-[10px] text-muted">
          <span>{range} days ago</span>
          <span>Today</span>
        </div>
        {paid.length === 0 && (
          <p className="text-xs text-muted mt-2">
            Add a paid ledger record to see revenue here.
          </p>
        )}
      </>
    );
  };
  const table = (rows: AdminRow[], kind: Entity) => (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>{kind === "payments" ? "Reference" : "Name"}</th>
            {kind === "customers" && <th>Email / Plan</th>}
            {["licenses", "payments", "tickets"].includes(kind) && (
              <th>Customer</th>
            )}
            {kind === "licenses" && <th>License / Plan</th>}
            {["plans", "payments"].includes(kind) && <th>Amount</th>}
            {kind === "plans" && <th>Devices</th>}
            {kind === "models" && <th>Connection</th>}
            <th>Status</th>
            <th>Updated</th>
            <th>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <b>{r.name}</b>
                {r.notes && <p className="admin-row-note">{r.notes}</p>}
              </td>
              {kind === "customers" && (
                <td>
                  {r.email}
                  <p className="text-muted text-xs mt-1">
                    {reference(r.planId, "plans")}
                  </p>
                </td>
              )}
              {["licenses", "payments", "tickets"].includes(kind) && (
                <td>{reference(r.customerId, "customers")}</td>
              )}
              {kind === "licenses" && (
                <td>
                  <code className="text-[10px] break-all">{r.licenseKey}</code>
                  <p className="text-muted text-xs mt-1">
                    {reference(r.planId, "plans")}
                    {r.expiresAt ? ` · Expires ${r.expiresAt}` : ""}
                  </p>
                </td>
              )}
              {["plans", "payments"].includes(kind) && (
                <td>
                  {money(r.amount ?? 0)}
                  {kind === "plans" && (
                    <span className="text-muted text-[10px]"> / month</span>
                  )}
                </td>
              )}
              {kind === "plans" && <td>{r.deviceLimit}</td>}
              {kind === "models" && <td>{r.connection ?? "—"}</td>}
              <td>
                <Badge
                  status={
                    kind === "licenses" &&
                    r.status === "Active" &&
                    !activeLicense(r)
                      ? "Expired"
                      : r.status
                  }
                />
              </td>
              <td className="whitespace-nowrap">{date(r.updatedAt)}</td>
              <td>
                <button
                  className="admin-edit"
                  onClick={() => {
                    setNotice("");
                    setEditor({ entity: kind, row: r });
                  }}
                >
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <div className="admin-empty">
          <Icon name="library" className="h-8 w-8 opacity-40" />
          <p>No {kind} found.</p>
          <p className="text-xs text-muted">
            Add a record or adjust the search and filter.
          </p>
        </div>
      )}
    </div>
  );
  return (
    <div className="admin-workspace">
      <div className="admin-page-heading">
        <div>
          <p className="eyebrow">SAVRDH PLATFORM</p>
          <h1 className="animated-title">{title}</h1>
          <p className="text-xs text-muted mt-2">
            {section === ""
              ? "A clear view of your customers, licenses and connected studio."
              : section === "studio"
                ? "Your Camera Studio application, connected to this control center."
                : section === "appearance"
                  ? "Shared themes and motion across admin and Camera Studio in this browser."
                  : section === "payments"
                    ? "Manual payment records. This ledger does not charge customers."
                    : section === "licenses"
                      ? "Issue and track local license records. Client-side feature enforcement is not enabled."
                      : "Manage your Camera Studio records."}
          </p>
        </div>
        <div className="flex gap-2">
          {entity ? (
            <Btn
              variant="primary"
              onClick={() => {
                setNotice("");
                setEditor({ entity });
              }}
            >
              + Add {singular[entity]}
            </Btn>
          ) : (
            <Btn onClick={exportData}>Export records</Btn>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="text-rec text-sm">
          {error}
        </p>
      )}
      {notice && !editor && (
        <p role="status" className="text-sm text-accent">
          {notice}
        </p>
      )}
      {section === "" && (
        <>
          <div className="admin-metrics">
            {metricCards.map(([name, value, hint, icon]) => (
              <Card key={name}>
                <div className="flex gap-3 items-start">
                  <span className="admin-metric-icon">
                    <Icon name={icon} />
                  </span>
                  <div>
                    <p className="text-[10px] text-muted">{name}</p>
                    <p className="admin-metric-value">{value}</p>
                    <p className="text-[10px] text-muted mt-1">{hint}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          <div className="admin-dashboard-grid">
            <Card>{chart()}</Card>
            <Card title="Active license plan share">
              <div className="admin-plan-share">
                <div
                  className="admin-donut"
                  style={{
                    background: licenses.length
                      ? `conic-gradient(${data.plans
                          .map((p, i) => {
                            const before =
                              (data.plans
                                .slice(0, i)
                                .reduce(
                                  (n, x) =>
                                    n +
                                    licenses.filter((l) => l.planId === x.id)
                                      .length,
                                  0,
                                ) /
                                licenses.length) *
                              100;
                            const share =
                              (licenses.filter((l) => l.planId === p.id)
                                .length /
                                licenses.length) *
                              100;
                            return `hsl(${250 + i * 55} 85% 62%) ${before}% ${before + share}%`;
                          })
                          .join(",")})`
                      : "rgb(var(--line)/.1)",
                  }}
                >
                  <div>
                    <strong>{licenses.length}</strong>
                    <span>Active</span>
                  </div>
                </div>
                <div className="space-y-3">
                  {data.plans
                    .filter((p) => p.status !== "Archived")
                    .map((p, i) => (
                      <div
                        key={p.id}
                        className="flex justify-between gap-4 text-xs"
                      >
                        <span>
                          <i
                            className="admin-dot"
                            style={{
                              background: `hsl(${250 + i * 55} 85% 62%)`,
                            }}
                          />
                          {p.name}
                        </span>
                        <b>
                          {licenses.filter((l) => l.planId === p.id).length}
                        </b>
                      </div>
                    ))}
                </div>
              </div>
            </Card>
          </div>
          <Card
            title="Recent customers"
            right={
              <Link href="/admin/customers" className="text-xs text-accent">
                View all →
              </Link>
            }
          >
            {table(customers.slice(0, 5), "customers")}
          </Card>
          <StudioModule data={data} />
        </>
      )}
      {section === "studio" && <StudioModule data={data} expanded />}
      {section === "appearance" && <AppearanceStudio />}
      {entity && (
        <>
          <Card>
            <div className="admin-toolbar">
              <label className="admin-search">
                <Icon name="search" />
                <input
                  aria-label={`Search ${entity}`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={`Search ${entity}…`}
                />
              </label>
              <label className="sr-only" htmlFor="record-status">
                Filter by status
              </label>
              <select
                id="record-status"
                className="admin-input !w-auto"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                {["All", ...statusOptions[entity]].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <span className="text-xs text-muted">
                {filtered.length} records
              </span>
            </div>
          </Card>
          {entity === "plans" && (
            <div className="admin-plan-cards">
              {filtered.map((p) => (
                <Card key={p.id}>
                  <div className="flex justify-between gap-2">
                    <h2 className="font-semibold">{p.name}</h2>
                    <Badge status={p.status} />
                  </div>
                  <p className="admin-plan-price">
                    {money(p.amount ?? 0)}
                    <span>/ month</span>
                  </p>
                  <p className="text-sm text-muted mb-5">
                    {p.deviceLimit} device{p.deviceLimit === 1 ? "" : "s"} ·
                    Plan definition
                  </p>
                  <p className="text-xs text-muted mb-5">
                    {p.notes || "Add plan features and notes when editing."}
                  </p>
                  <Btn
                    className="w-full"
                    onClick={() => {
                      setNotice("");
                      setEditor({ entity: "plans", row: p });
                    }}
                  >
                    Edit plan
                  </Btn>
                </Card>
              ))}
            </div>
          )}
          <Card>{table(filtered, entity)}</Card>
        </>
      )}
      {section === "reports" && (
        <>
          <div className="admin-metrics">
            {metricCards.slice(0, 4).map(([name, value, hint, icon]) => (
              <Card key={name}>
                <p className="text-xs text-muted">{name}</p>
                <p className="admin-metric-value">{value}</p>
                <p className="text-xs text-muted mt-2">{hint}</p>
              </Card>
            ))}
          </div>
          <Card>{chart()}</Card>
          <Card title="Data coverage">
            <p className="text-sm text-muted">
              These reports use your saved local customer, license and payment
              records. Payment processing, automatic subscription renewals and
              cloud analytics are not connected.
            </p>
            <Btn onClick={exportData} className="mt-4">
              Export workspace JSON
            </Btn>
          </Card>
        </>
      )}
      {section === "activity" && (
        <Card title="Record activity">
          {data.audit.length ? (
            <div className="admin-audit">
              {data.audit.map((a) => (
                <div key={a.id}>
                  <span className="admin-dot" />
                  <div>
                    <b>{a.action}</b>
                    <p>{a.detail}</p>
                  </div>
                  <time>{new Date(a.at).toLocaleString()}</time>
                </div>
              ))}
            </div>
          ) : (
            <div className="admin-empty">Record changes will appear here.</div>
          )}
        </Card>
      )}
      <dialog
        ref={dialog}
        className="admin-dialog"
        onCancel={() => {
          if (!busy) setEditor(null);
        }}
        onClose={() => setEditor(null)}
      >
        <div className="p-6">
          {editor && (
            <>
              <div className="flex justify-between gap-4 items-center mb-5">
                <div>
                  <p className="eyebrow">WORKSPACE RECORD</p>
                  <h2 className="text-xl font-semibold">
                    {editor.row ? "Edit" : "Add"} {singular[editor.entity]}
                  </h2>
                </div>
                <button
                  aria-label="Close editor"
                  disabled={busy}
                  onClick={() => setEditor(null)}
                  className="admin-edit"
                >
                  ✕
                </button>
              </div>
              <form
                onSubmit={save}
                key={editor.row?.id ?? editor.entity}
                className="admin-record-form"
              >
                <label>
                  Name / reference
                  <input
                    required
                    minLength={2}
                    maxLength={120}
                    name="name"
                    defaultValue={editor.row?.name ?? ""}
                    className="admin-input"
                  />
                </label>
                {editor.entity === "customers" && (
                  <label>
                    Email
                    <input
                      required
                      type="email"
                      name="email"
                      defaultValue={editor.row?.email ?? ""}
                      className="admin-input"
                    />
                  </label>
                )}
                {["customers", "licenses"].includes(editor.entity) && (
                  <label>
                    Plan
                    <select
                      name="planId"
                      defaultValue={editor.row?.planId ?? ""}
                      required={editor.entity === "licenses"}
                      className="admin-input"
                    >
                      <option value="">Choose a plan</option>
                      {data.plans
                        .filter((p) => p.status !== "Archived")
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} · {p.status}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                {["licenses", "payments", "tickets"].includes(
                  editor.entity,
                ) && (
                  <label>
                    Customer
                    <select
                      name="customerId"
                      defaultValue={editor.row?.customerId ?? ""}
                      required={editor.entity !== "tickets"}
                      className="admin-input"
                    >
                      <option value="">Choose a customer</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {["plans", "payments"].includes(editor.entity) && (
                  <label>
                    Amount (INR){editor.entity === "plans" ? " per month" : ""}
                    <input
                      required
                      type="number"
                      min={0}
                      max={100000000}
                      step="0.01"
                      name="amount"
                      defaultValue={editor.row?.amount ?? 0}
                      className="admin-input"
                    />
                  </label>
                )}
                {editor.entity === "plans" && (
                  <label>
                    Device limit
                    <input
                      required
                      name="deviceLimit"
                      type="number"
                      min={1}
                      max={1000}
                      defaultValue={editor.row?.deviceLimit ?? 1}
                      className="admin-input"
                    />
                  </label>
                )}
                {editor.entity === "licenses" && (
                  <label>
                    Expiry date (optional)
                    <input
                      name="expiresAt"
                      type="date"
                      defaultValue={editor.row?.expiresAt ?? ""}
                      className="admin-input"
                    />
                  </label>
                )}
                {editor.entity === "models" && (
                  <label>
                    Connection method
                    <input
                      name="connection"
                      maxLength={160}
                      defaultValue={editor.row?.connection ?? ""}
                      className="admin-input"
                    />
                  </label>
                )}
                <label>
                  Status
                  <select
                    name="status"
                    defaultValue={
                      editor.row?.status ?? statusOptions[editor.entity][0]
                    }
                    className="admin-input"
                  >
                    {statusOptions[editor.entity].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label className="admin-form-wide">
                  Notes
                  <textarea
                    name="notes"
                    maxLength={2000}
                    defaultValue={editor.row?.notes ?? ""}
                    rows={3}
                    className="admin-input"
                  />
                </label>
                {editor.row?.licenseKey && (
                  <p className="text-xs text-muted admin-form-wide break-all">
                    License key: {editor.row.licenseKey}
                  </p>
                )}
                {notice && (
                  <p role="alert" className="admin-form-wide text-rec text-sm">
                    {notice}
                  </p>
                )}
                <div className="admin-form-wide flex justify-end gap-2">
                  <Btn
                    type="button"
                    disabled={busy}
                    onClick={() => setEditor(null)}
                  >
                    Cancel
                  </Btn>
                  <Btn type="submit" variant="primary" disabled={busy}>
                    {busy ? "Saving…" : "Save record"}
                  </Btn>
                </div>
              </form>
            </>
          )}
        </div>
      </dialog>
    </div>
  );
}
function StudioModule({
  data,
  expanded = false,
}: {
  data: AdminData;
  expanded?: boolean;
}) {
  const fresh = data.studio.filter((s) => Date.now() - s.lastSeen < 35000);
  return (
    <Card
      title="SAVRDH Camera Studio"
      right={<span className="studio-badge">Application connected</span>}
    >
      <div className="admin-app-module">
        <div className="admin-app-art">
          <Icon name="camera" className="h-16 w-16" />
          <span>CAMERA STUDIO</span>
          <b>Capture. Create. Go live.</b>
        </div>
        <div>
          <p className="eyebrow">CONNECTED APPLICATION</p>
          <h2 className="text-2xl font-semibold mb-3">SAVRDH Camera Studio</h2>
          <p className="text-sm text-muted">
            Live camera control, photos, video, screen sharing, multi-screen
            monitoring and direct streaming—all linked to this admin workspace.
          </p>
          <div className="flex gap-2 flex-wrap mt-5">
            <Link className="admin-open-app" href="/live">
              Open application →
            </Link>
            <Link
              className="admin-edit inline-flex items-center"
              href="/admin/appearance"
            >
              Customize appearance
            </Link>
          </div>
          <p className="text-xs text-muted mt-4">
            {fresh.length} browser{fresh.length === 1 ? "" : "s"} recently seen
            · {fresh.filter((s) => s.status === "connected").length} camera
            connection
            {fresh.filter((s) => s.status === "connected").length === 1
              ? ""
              : "s"}
          </p>
        </div>
      </div>
      {expanded && (
        <>
          <div className="admin-app-links">
            {[
              [
                "/connection",
                "Camera Connection",
                "Connect webcam or a compatible camera",
              ],
              [
                "/photo",
                "Photo Studio",
                "Shutter, focus and exposure controls",
              ],
              ["/video", "Video Studio", "Recording and camera settings"],
              [
                "/streaming",
                "Live Streaming",
                "Direct YouTube / Facebook broadcasting",
              ],
              ["/monitor", "Multi-Screen", "Clean external monitor preview"],
              ["/library", "Media Library", "Browse and organize camera media"],
            ].map(([href, title, hint]) => (
              <Link className="studio-card p-4" href={href} key={href}>
                <b className="text-sm">{title} ↗</b>
                <p className="text-xs text-muted mt-2">{hint}</p>
              </Link>
            ))}
          </div>
          <div className="admin-table-wrap mt-5">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Studio / camera</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Live view</th>
                  <th>Recording</th>
                  <th>Last seen</th>
                </tr>
              </thead>
              <tbody>
                {data.studio.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td>{s.mode || "Not selected"}</td>
                    <td>
                      <Badge
                        status={
                          Date.now() - s.lastSeen > 35000 ? "Offline" : s.status
                        }
                      />
                    </td>
                    <td>{s.liveView ? "On" : "Off"}</td>
                    <td>{s.recording ? "Recording" : "Idle"}</td>
                    <td>{new Date(s.lastSeen).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted mt-4">
            Connection status refreshes every 15 seconds. Customer, plan and
            license records are managed locally; subscription charging and
            license enforcement are not enabled.
          </p>
        </>
      )}
    </Card>
  );
}
