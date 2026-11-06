import Link from "next/link";
import { AlertCircleIcon, CalendarIcon } from "@/components/booking/Icons";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200/80 shadow-sm p-8 space-y-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-50 text-red-500 mx-auto">
          <AlertCircleIcon className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Page Not Found
          </h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            The scheduling link you followed does not exist, has been changed, or the event type is currently inactive.
          </p>
        </div>

        <div className="pt-2 flex flex-col gap-3">
          <Link
            href="/"
            className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition-colors text-center inline-flex items-center justify-center gap-2 shadow-xs"
          >
            <CalendarIcon className="w-4 h-4" />
            Return to Slotbook Home
          </Link>
        </div>
      </div>
    </div>
  );
}

