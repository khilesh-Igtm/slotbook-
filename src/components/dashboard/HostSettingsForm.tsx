"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GlobeIcon, CheckCircleIcon, AlertCircleIcon, SpinnerIcon } from "@/components/booking/Icons";

const COMMON_TIMEZONES = [
  "Asia/Kolkata",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
  "UTC",
];

export interface HostSettingsFormProps {
  initialHost: {
    id: string;
    name: string;
    email: string;
    slug: string;
    timezone: string;
  };
}

export function HostSettingsForm({ initialHost }: HostSettingsFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialHost.name);
  const [timezone, setTimezone] = useState(initialHost.timezone);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch("/api/dashboard/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          timezone: timezone.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to update settings.");
      }

      setSuccessMessage("Settings updated successfully.");
      router.refresh();
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "An error occurred while saving."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
          Account & Timezone Settings
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Manage your host profile name and calendar timezone.
        </p>
      </div>

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircleIcon className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
          <AlertCircleIcon className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-xs space-y-6"
      >
        {/* Display Name */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-800">
            Display Name
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Email (Read-only) */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-800">
            Email Address
          </label>
          <input
            type="email"
            disabled
            value={initialHost.email}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono text-slate-500 bg-slate-50 cursor-not-allowed"
          />
          <p className="text-[11px] text-slate-400">
            Email is your account identifier and cannot be changed directly.
          </p>
        </div>

        {/* Public Booking Slug (Read-only) */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-800">
            Public Booking URL
          </label>
          <div className="flex items-center gap-2 text-xs">
            <span className="font-mono text-slate-600 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 flex-1 truncate">
              /book/{initialHost.slug}
            </span>
            <Link
              href={`/book/${initialHost.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 rounded-xl border border-slate-200 text-indigo-600 hover:bg-slate-50 font-semibold shrink-0"
            >
              Open Page &nearr;
            </Link>
          </div>
        </div>

        {/* Timezone Selector */}
        <div className="space-y-1.5 pt-2 border-t border-slate-100">
          <label className="block text-xs font-bold text-slate-800">
            Host IANA Timezone
          </label>
          <div className="space-y-2">
            <select
              value={COMMON_TIMEZONES.includes(timezone) ? timezone : "CUSTOM"}
              onChange={(e) => {
                if (e.target.value !== "CUSTOM") {
                  setTimezone(e.target.value);
                }
              }}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
              {!COMMON_TIMEZONES.includes(timezone) && (
                <option value="CUSTOM">Custom: {timezone}</option>
              )}
            </select>

            <div className="space-y-1">
              <span className="text-[11px] text-slate-400">Or enter an exact IANA timezone string:</span>
              <input
                type="text"
                placeholder="e.g. Europe/Stockholm, America/Toronto"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Timezone Explanation Box */}
        <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/60 text-xs text-amber-900 space-y-1">
          <div className="font-bold flex items-center gap-1.5 text-amber-800">
            <GlobeIcon className="w-4 h-4 text-amber-600" />
            Timezone Impact Notice
          </div>
          <p className="leading-relaxed">
            Changing your timezone affects future weekly availability interpretation and how your public booking calendar displays available slots to guests. All existing booking instants are stored permanently in UTC and remain unaffected.
          </p>
        </div>

        {/* Submit */}
        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors flex items-center gap-2 shadow-xs disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <SpinnerIcon className="w-4 h-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <span>Save Settings</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

