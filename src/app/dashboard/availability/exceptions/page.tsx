import { Suspense } from "react";
import { requireHostSession } from "@/lib/auth/session";
import { listDateOverridesForHost } from "@/lib/services/date-override.service";
import { DateOverridesManager } from "@/components/dashboard/DateOverridesManager";

async function DateOverridesContent() {
  const session = await requireHostSession();
  const overrides = await listDateOverridesForHost(session.hostId);

  return (
    <DateOverridesManager
      initialOverrides={overrides}
      hostTimezone={session.timezone}
    />
  );
}

export default function DateOverridesPage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center text-xs text-slate-400">
          Loading special dates...
        </div>
      }
    >
      <DateOverridesContent />
    </Suspense>
  );
}

