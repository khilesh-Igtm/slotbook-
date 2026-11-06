import { Suspense } from "react";
import { requireHostSession } from "@/lib/auth/session";
import { BookingsList } from "@/components/dashboard/BookingsList";

async function BookingsContent() {
  const session = await requireHostSession();
  return <BookingsList hostTimezone={session.timezone} />;
}

export default function DashboardBookingsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center text-xs text-slate-400">
          Loading bookings...
        </div>
      }
    >
      <BookingsContent />
    </Suspense>
  );
}

