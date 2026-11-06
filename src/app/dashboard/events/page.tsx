import { Suspense } from "react";
import { requireHostSession } from "@/lib/auth/session";
import { listEventTypesForHost } from "@/lib/services/event-type.service";
import { EventTypesList } from "@/components/dashboard/EventTypesList";

async function EventTypesContent() {
  const session = await requireHostSession();
  const eventTypes = await listEventTypesForHost(session.hostId);

  return (
    <EventTypesList
      initialEventTypes={eventTypes}
      hostSlug={session.slug}
    />
  );
}

export default function EventTypesPage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center text-xs text-slate-400">
          Loading event types...
        </div>
      }
    >
      <EventTypesContent />
    </Suspense>
  );
}

