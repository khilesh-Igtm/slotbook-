import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getHostAndEventTypeBySlug } from "@/lib/services/availability.service";
import { BookingContainer } from "@/components/booking/BookingContainer";

interface PageProps {
  params: Promise<{
    hostSlug: string;
    eventSlug: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { hostSlug, eventSlug } = await params;
  try {
    const { host, eventType } = await getHostAndEventTypeBySlug(hostSlug, eventSlug);
    return {
      title: `${eventType.title} with ${host.name} | Slotbook`,
      description:
        eventType.description ||
        `Book a ${eventType.duration}-minute appointment with ${host.name}.`,
    };
  } catch {
    return {
      title: "Event Not Found | Slotbook",
    };
  }
}

async function PublicBookingContent({
  params,
}: {
  params: Promise<{ hostSlug: string; eventSlug: string }>;
}) {
  const { hostSlug, eventSlug } = await params;

  let host;
  let eventType;

  try {
    const result = await getHostAndEventTypeBySlug(hostSlug, eventSlug);
    host = result.host;
    eventType = result.eventType;
  } catch {
    notFound();
  }

  return (
    <BookingContainer
      host={{
        id: host.id,
        name: host.name,
        slug: host.slug,
        timezone: host.timezone,
      }}
      eventType={{
        id: eventType.id,
        title: eventType.title,
        slug: eventType.slug,
        description: eventType.description,
        duration: eventType.duration,
        location: eventType.location,
      }}
    />
  );
}

export default function PublicBookingPage({ params }: PageProps) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur-xs sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2 font-bold text-slate-900 tracking-tight hover:opacity-90 transition-opacity"
            >
              <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs font-black shadow-xs">
                S
              </span>
              <span>Slotbook</span>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="text-xs font-medium text-slate-500 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              Home
            </Link>
          </div>
        </div>
      </header>

      {/* Main Booking Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <Suspense
          fallback={
            <div className="max-w-5xl mx-auto bg-white rounded-3xl border border-slate-200/80 p-12 text-center text-sm text-slate-400">
              Loading calendar and availability...
            </div>
          }
        >
          <PublicBookingContent params={params} />
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
