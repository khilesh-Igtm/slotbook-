import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireHostSession } from "@/lib/auth/session";
import { getBookingDetailsForHost } from "@/lib/services/host-booking.service";
import { HostBookingDetail } from "@/components/dashboard/HostBookingDetail";

interface PageProps {
  params: Promise<{
    bookingId: string;
  }>;
}

async function BookingDetailContent({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const session = await requireHostSession();
  const { bookingId } = await params;

  let booking;
  try {
    booking = await getBookingDetailsForHost(
      session.hostId,
      bookingId,
      session.timezone
    );
  } catch {
    notFound();
  }

  return (
    <HostBookingDetail
      booking={booking}
      hostTimezone={session.timezone}
    />
  );
}

export default function HostBookingDetailPage({ params }: PageProps) {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center text-xs text-slate-400">
          Loading booking details...
        </div>
      }
    >
      <BookingDetailContent params={params} />
    </Suspense>
  );
}

