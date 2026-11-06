import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireHostSession } from "@/lib/auth/session";
import { getEventTypeForHost } from "@/lib/services/event-type.service";
import { EventTypeForm } from "@/components/dashboard/EventTypeForm";

interface PageProps {
  params: Promise<{
    eventTypeId: string;
  }>;
}

async function EditEventContent({
  params,
}: {
  params: Promise<{ eventTypeId: string }>;
}) {
  const session = await requireHostSession();
  const { eventTypeId } = await params;

  let eventType;
  try {
    eventType = await getEventTypeForHost(session.hostId, eventTypeId);
  } catch {
    notFound();
  }

  return (
    <EventTypeForm
      initialData={eventType}
      hostSlug={session.slug}
      isEdit={true}
    />
  );
}

export default function EditEventTypePage({ params }: PageProps) {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center text-xs text-slate-400">
          Loading event details...
        </div>
      }
    >
      <EditEventContent params={params} />
    </Suspense>
  );
}

