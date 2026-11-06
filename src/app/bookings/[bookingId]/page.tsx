import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getBookingById } from "@/lib/services/booking.service";
import { BookingDetailsView } from "@/components/booking/BookingDetailsView";

interface PageProps {
  params: Promise<{
    bookingId: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { bookingId } = await params;
  try {
    const booking = await getBookingById(bookingId);
    return {
      title: `Booking: ${booking.eventType.title} with ${booking.host.name} | Slotbook`,
    };
  } catch {
    return {
      title: "Booking Not Found | Slotbook",
    };
  }
}

async function BookingLookupContent({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;

  let booking;
  try {
    booking = await getBookingById(bookingId);
  } catch {
    notFound();
  }

  return <BookingDetailsView initialBooking={booking} />;
}

export default function BookingLookupPage({ params }: PageProps) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      {/* Top Header */}
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur-xs sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 font-bold text-slate-900 tracking-tight hover:opacity-90 transition-opacity"
          >
            <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs font-black shadow-xs">
              S
            </span>
            <span>Slotbook</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="text-xs font-medium text-slate-600 hover:text-indigo-600 transition-colors"
            >
              Slotbook Home
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <Suspense
          fallback={
            <div className="text-center py-12 text-sm text-slate-400">
              Loading appointment details...
            </div>
          }
        >
          <BookingLookupContent params={params} />
        </Suspense>
      </main>

      {/* Footer */}
      <footer className="py-6 border-t border-slate-200/80 text-center text-xs text-slate-400">
        <p>
          Powered by{" "}
          <Link href="/" className="font-semibold text-slate-600 hover:text-indigo-600 transition-colors">
            Slotbook
          </Link>{" "}
          · Concurrency-safe, timezone-precise scheduling
        </p>
      </footer>
    </div>
  );
}
