export const ENTITIES = [
  "customers",
  "plans",
  "licenses",
  "models",
  "payments",
  "tickets",
] as const;
export type Entity = (typeof ENTITIES)[number];
export type AdminRow = {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  email?: string;
  customerId?: string;
  planId?: string;
  amount?: number;
  deviceLimit?: number;
  expiresAt?: string;
  licenseKey?: string;
  notes?: string;
  connection?: string;
};
export type StudioSnapshot = {
  id: string;
  name: string;
  mode: string;
  status: string;
  recording: boolean;
  liveView: boolean;
  shots: number;
  lastSeen: number;
};
export type AuditEntry = {
  id: string;
  at: string;
  action: string;
  detail: string;
};
export type AdminData = {
  version: 1;
  customers: AdminRow[];
  plans: AdminRow[];
  licenses: AdminRow[];
  models: AdminRow[];
  payments: AdminRow[];
  tickets: AdminRow[];
  audit: AuditEntry[];
  studio: StudioSnapshot[];
};
export const SECTIONS = [
  { id: "", label: "Dashboard", icon: "home" },
  { id: "studio", label: "SAVRDH Camera Studio", icon: "camera" },
  { id: "customers", label: "Customers", icon: "user" },
  { id: "trials", label: "Trial Requests", icon: "check" },
  { id: "plans", label: "Subscription Plans", icon: "library" },
  { id: "licenses", label: "Licenses & Activation", icon: "check" },
  { id: "models", label: "Camera Models", icon: "camera" },
  { id: "payments", label: "Payments Ledger", icon: "download" },
  { id: "appearance", label: "Appearance Studio", icon: "palette" },
  { id: "tickets", label: "Support Tickets", icon: "info" },
  { id: "reports", label: "Analytics & Reports", icon: "pulse" },
  { id: "activity", label: "Activity Log", icon: "gear" },
] as const;
