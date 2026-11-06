import { Suspense } from "react";
import Link from "next/link";
import { requireHostSession } from "@/lib/auth/session";
import { getDashboardOverview } from "@/lib/services/dashboard.service";
import {
  CalendarIcon,
  ClockIcon,
  VideoIcon,
  CheckCircleIcon,
} from "@/components/booking/Icons";

function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="h-8 w-48 bg-slate-200 rounded-lg"></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-white rounded-2xl border border-slate-100 p-4"></div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-64 bg-white rounded-2xl border border-slate-100"></div>
        <div className="h-64 bg-white rounded-2xl border border-slate-100"></div>
      </div>
    </div>
  );
}

async function DashboardOverviewContent() {
  const session = await requireHostSession();
  const data = await getDashboardOverview(session.hostId, session.timezone);

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Welcome back, {session.name}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Here is your real-time scheduling activity for your timezone ({session.timezone}).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/book/${session.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors shadow-xs inline-flex items-center gap-1.5"
          >
            <span>Preview Public Page</span>
            <span className="text-indigo-600">&rarr;</span>
          </Link>
          <Link
            href="/dashboard/events/new"
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors shadow-xs inline-flex items-center gap-1.5"
          >
            <span>+ New Event Type</span>
          </Link>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Total Bookings
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            {data.stats.totalBookings}
          </div>
          <p className="text-[11px] text-slate-400">All-time appointments</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
            Upcoming
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600">
            {data.stats.upcomingBookings}
          </div>
          <p className="text-[11px] text-slate-400">Confirmed & scheduled</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
            Completed
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            {data.stats.completedBookings}
          </div>
          <p className="text-[11px] text-slate-400">Past sessions</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wider text-rose-500">
            Cancelled
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            {data.stats.cancelledBookings}
          </div>
          <p className="text-[11px] text-slate-400">Released time slots</p>
        </div>
      </div>

      {/* Quick Action Navigation Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          href="/dashboard/events"
          className="p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-indigo-300 hover:shadow-xs transition-all flex items-center gap-3.5 group"
        >
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <VideoIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
              Manage Event Types
            </div>
            <div className="text-[11px] text-slate-500">Create, edit duration & buffers</div>
          </div>
        </Link>

        <Link
          href="/dashboard/availability"
          className="p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-indigo-300 hover:shadow-xs transition-all flex items-center gap-3.5 group"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <ClockIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900 group-hover:text-amber-600 transition-colors">
              Weekly Availability
            </div>
            <div className="text-[11px] text-slate-500">Working hours & multi-window schedules</div>
          </div>
        </Link>

        <Link
          href="/dashboard/availability/exceptions"
          className="p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-indigo-300 hover:shadow-xs transition-all flex items-center gap-3.5 group"
        >
          <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900 group-hover:text-violet-600 transition-colors">
              Date Exceptions
            </div>
            <div className="text-[11px] text-slate-500">Block holidays & special hours</div>
          </div>
        </Link>
      </div>

      {/* Main 2-Column Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Next Scheduled Appointments */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Upcoming Appointments
            </h2>
            <Link
              href="/dashboard/bookings"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              View all &rarr;
            </Link>
          </div>

          {data.upcomingAppointments.length === 0 ? (
            <div className="text-center py-10 text-slate-400 space-y-2">
              <CalendarIcon className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs">No upcoming appointments scheduled yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.upcomingAppointments.map((app) => (
                <Link
                  key={app.id}
                  href={`/dashboard/bookings/${app.id}`}
                  className="block p-4 rounded-2xl border border-slate-100 hover:border-indigo-200 hover:bg-slate-50/50 transition-all space-y-2 group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                      {app.guestName}
                    </span>
                    <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
                      {app.duration}m
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 font-medium">
                    {app.eventTitle}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <ClockIcon className="w-3.5 h-3.5 text-slate-400" />
                      <span>{app.formattedDate} &middot; {app.formattedTime}</span>
                    </div>
                    {app.location && (
                      <span className="text-slate-400 truncate max-w-[120px]">{app.location}</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent Booking Activity */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">
              Recent Activity
            </h2>
            <Link
              href="/dashboard/bookings"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              All bookings &rarr;
            </Link>
          </div>

          {data.recentBookings.length === 0 ? (
            <div className="text-center py-10 text-slate-400 space-y-2">
              <CheckCircleIcon className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs">No recent booking activity recorded.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.recentBookings.map((b) => (
                <Link
                  key={b.id}
                  href={`/dashboard/bookings/${b.id}`}
                  className="py-3 flex items-center justify-between hover:bg-slate-50/50 -mx-2 px-2 rounded-xl transition-colors group"
                >
                  <div className="min-w-0 pr-3">
                    <div className="text-xs font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                      {b.guestName}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {b.eventTitle} &middot; {b.formattedDateTime}
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                      b.status === "CONFIRMED"
                        ? "bg-emerald-50 text-emerald-700"
                        : b.status === "CANCELLED"
                        ? "bg-rose-50 text-rose-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {b.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardOverviewContent />
    </Suspense>
  );
}
