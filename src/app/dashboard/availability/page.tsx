import { Suspense } from "react";
import { requireHostSession } from "@/lib/auth/session";
import { getHostWeeklyAvailability } from "@/lib/services/host-availability.service";
import { WeeklyAvailabilityManager } from "@/components/dashboard/WeeklyAvailabilityManager";

async function WeeklyAvailabilityContent() {
  const session = await requireHostSession();
  const data = await getHostWeeklyAvailability(session.hostId);

  return (
    <WeeklyAvailabilityManager
      initialSchedules={data.schedules}
      hostTimezone={session.timezone}
    />
  );
}

export default function WeeklyAvailabilityPage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center text-xs text-slate-400">
          Loading working hours...
        </div>
      }
    >
      <WeeklyAvailabilityContent />
    </Suspense>
  );
}

