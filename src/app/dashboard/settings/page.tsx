import { Suspense } from "react";
import { requireHostSession } from "@/lib/auth/session";
import { getAuthenticatedHost } from "@/lib/services/auth.service";
import { HostSettingsForm } from "@/components/dashboard/HostSettingsForm";

async function SettingsContent() {
  const session = await requireHostSession();
  const host = await getAuthenticatedHost(session.hostId);

  return <HostSettingsForm initialHost={host} />;
}

export default function DashboardSettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center text-xs text-slate-400">
          Loading settings...
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}

