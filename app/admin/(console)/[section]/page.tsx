import { notFound } from "next/navigation";
import AdminWorkspace from "@/components/admin/AdminWorkspace";
import { SECTIONS } from "@/lib/admin-types";
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!SECTIONS.some((s) => s.id === section)) notFound();
  return <AdminWorkspace section={section} />;
}
