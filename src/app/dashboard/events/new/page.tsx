import { Suspense } from "react";
import { requireHostSession } from "@/lib/auth/session";
import { EventTypeForm } from "@/components/dashboard/EventTypeForm";

async function NewEventContent() {
  const session = await requireHostSession();
  return <EventTypeForm hostSlug={session.slug} isEdit={false} />;
}

export default function NewEventTypePage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center text-xs text-slate-400">
          Loading form...
        </div>
      }
    >
      <NewEventContent />
    </Suspense>
  );
}

