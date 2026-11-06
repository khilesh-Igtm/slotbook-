import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getHostBySlug } from "@/lib/services/availability.service";
import { ClockIcon, VideoIcon, CalendarIcon } from "@/components/booking/Icons";

interface PageProps {
  params: Promise<{
    hostSlug: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { hostSlug } = await params;
  try {
    const host = await getHostBySlug(hostSlug);
    return {
      title: `${host.name} | Book an Appointment | Slotbook`,
      description: `Schedule a meeting with ${host.name} on Slotbook.`,
    };
  } catch {
    return {
      title: "Host Not Found | Slotbook",
    };
  }
}

async function HostProfileContent({
  params,
}: {
  params: Promise<{ hostSlug: string }>;
}) {
  const { hostSlug } = await params;

  let host;
  try {
    host = await getHostBySlug(hostSlug);
  } catch {
    notFound();
  }

  // Generate host initials for avatar
  const initials = host.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="space-y-8">
      {/* Host Profile Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-8 shadow-xs flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-6">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center text-2xl font-black shadow-md shadow-indigo-100 shrink-0">
          {initials}
        </div>

        <div className="space-y-2 flex-1">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 justify-between">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              {host.name}
            </h1>
            <span className="text-xs font-medium text-slate-400">
              @{host.slug}
            </span>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed max-w-xl">
            Welcome to my scheduling page. Select one of the appointment types below to view my real-time calendar and book a time that works best for you.
          </p>
        </div>
      </div>

      {/* Event Types List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
            Available Meeting Types ({host.eventTypes.length})
          </h2>
        </div>

        {host.eventTypes.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center space-y-3">
            <CalendarIcon className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-base font-semibold text-slate-800">No active event types</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              {host.name} currently does not have any active event types available for booking.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {host.eventTypes.map((eventType) => (
              <Link
                key={eventType.id}
                href={`/book/${host.slug}/${eventType.slug}`}
                className="group bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs hover:border-indigo-300 hover:shadow-md hover:shadow-indigo-50/50 transition-all duration-200 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                      {eventType.title}
                    </h3>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 shrink-0">
                      <ClockIcon className="w-3.5 h-3.5" />
                      {eventType.duration}m
                    </span>
                  </div>

                  {eventType.description && (
                    <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed">
                      {eventType.description}
                    </p>
                  )}
                </div>

                <div className="pt-6 mt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-slate-500 font-medium">
                    {eventType.location && (
                      <>
                        <VideoIcon className="w-4 h-4 text-slate-400" />
                        <span>{eventType.location}</span>
                      </>
                    )}
                  </div>
                  <span className="font-semibold text-indigo-600 group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                    Book Now &rarr;
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function HostProfilePage({ params }: PageProps) {
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
              className="text-xs font-medium text-slate-500 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              Home
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <Suspense
          fallback={
            <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center text-sm text-slate-400">
              Loading host profile...
            </div>
          }
        >
          <HostProfileContent params={params} />
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
