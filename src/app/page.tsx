import Link from "next/link";
import {
  CalendarIcon,
  ClockIcon,
  GlobeIcon,
  VideoIcon,
  CheckCircleIcon,
} from "@/components/booking/Icons";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      {/* Top Header */}
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur-xs sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-sm font-black shadow-xs">
              S
            </span>
            <span className="font-bold text-lg text-slate-900 tracking-tight">
              Slotbook
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/book/alex-sharma"
              className="text-xs font-semibold px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-xs"
            >
              Live Demo &rarr;
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-12 sm:py-20 space-y-16">
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
            Production-Ready Scheduling Architecture
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.1]">
            Modern, Concurrency-Safe <br className="hidden sm:inline" />
            <span className="text-indigo-600">Appointment Scheduling</span>
          </h1>

          <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Engineered with PostgreSQL exclusion locks, Luxon timezone precision, buffer-isolated slot generation, and zero-leak cancellation tokens.
          </p>
        </div>

        {/* Demo Host Card */}
        <div className="max-w-3xl mx-auto bg-white rounded-3xl border border-slate-200/80 p-8 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center text-xl font-black shadow-md shadow-indigo-100 shrink-0">
              AS
            </div>

            <div className="space-y-1 flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Alex Sharma</h2>
                  <p className="text-xs text-slate-500">Demo Host &middot; @alex-sharma</p>
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                  <GlobeIcon className="w-3.5 h-3.5 text-slate-500" />
                  Asia/Kolkata
                </span>
              </div>
              <p className="text-xs text-slate-600 pt-1">
                Explore real-time slot generation, date picker, buffer reservations, and idempotent booking.
              </p>
            </div>
          </div>

          {/* Quick Links to Seeded Event Types */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
            <Link
              href="/book/alex-sharma/30-min-meeting"
              className="group p-5 rounded-2xl border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:border-indigo-300 hover:shadow-xs transition-all flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-900 group-hover:text-indigo-600 transition-colors">
                    30-Minute Meeting
                  </h3>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                    30m
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Quick sync for updates and project questions. 5m before/after buffers.
                </p>
              </div>
              <div className="pt-4 flex items-center justify-between text-xs text-indigo-600 font-semibold">
                <span className="flex items-center gap-1 text-slate-400 font-normal">
                  <VideoIcon className="w-3.5 h-3.5" /> Google Meet
                </span>
                <span className="group-hover:translate-x-0.5 transition-transform">
                  Book Slot &rarr;
                </span>
              </div>
            </Link>

            <Link
              href="/book/alex-sharma/60-min-consultation"
              className="group p-5 rounded-2xl border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:border-indigo-300 hover:shadow-xs transition-all flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-900 group-hover:text-indigo-600 transition-colors">
                    60-Minute Consultation
                  </h3>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                    60m
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Deep dive advisory session with architecture review. 10m buffers.
                </p>
              </div>
              <div className="pt-4 flex items-center justify-between text-xs text-indigo-600 font-semibold">
                <span className="flex items-center gap-1 text-slate-400 font-normal">
                  <VideoIcon className="w-3.5 h-3.5" /> Google Meet
                </span>
                <span className="group-hover:translate-x-0.5 transition-transform">
                  Book Slot &rarr;
                </span>
              </div>
            </Link>
          </div>

          <div className="text-center pt-2">
            <Link
              href="/book/alex-sharma"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              View Alex Sharma&apos;s Full Scheduling Directory &rarr;
            </Link>
          </div>
        </div>

        {/* Technical Architecture Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">
              Buffer-Aware Slot Generation
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Dynamically merges weekly availability with date overrides and reserves intervals with pre/post buffers to prevent overlapping appointments.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircleIcon className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">
              PostgreSQL Concurrency Locking
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Every booking executes within a transaction with host-level row locking and btree_gist exclusion constraints, eliminating race conditions.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
              <ClockIcon className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">
              Zero-Leak Secure Cancellations
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Public booking endpoints never expose cancellation keys. Only the guest who booked the slot holds the cryptographic token needed to release it.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 border-t border-slate-200/80 bg-white text-center text-xs text-slate-400 space-y-2">
        <p className="font-medium text-slate-600">
          Slotbook &middot; Enterprise-Grade Appointment Scheduling Engine
        </p>
        <p className="text-slate-400">
          Built with Next.js App Router, TypeScript, Prisma 6, PostgreSQL 17, and Luxon.
        </p>
      </footer>
    </div>
  );
}
