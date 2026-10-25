import { Card } from "@/components/ui";

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-xl">
      <Card title="SAVRDH Camera Control Studio">
        <p className="text-sm text-muted">
          Wireless camera control for Canon EOS R50: live view, photos, video, media library, multi-screen preview and diagnostics.
        </p>
        <dl className="mt-4 space-y-1 text-sm">
          <div className="flex justify-between"><dt className="text-muted">Version</dt><dd>0.2.0</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Stack</dt><dd>Next.js · Tailwind · Canon CCAPI</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Next</dt><dd>Tauri (Mac) → iPhone/iPad app</dd></div>
        </dl>
        <p className="mt-4 text-xs text-muted">
          This is an independent project and is not affiliated with Canon Inc. Canon and EOS are trademarks of their respective owners.
        </p>
      </Card>
    </div>
  );
}
