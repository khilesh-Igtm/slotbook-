"use client";

import React, { useState } from "react";
import { FormattedDateOverride } from "@/lib/services/date-override.service";
import {
  CalendarIcon,
  ClockIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  SpinnerIcon,
} from "@/components/booking/Icons";

export interface DateOverridesManagerProps {
  initialOverrides: FormattedDateOverride[];
  hostTimezone: string;
}

export function DateOverridesManager({
  initialOverrides,
  hostTimezone,
}: DateOverridesManagerProps) {
  const [overrides, setOverrides] = useState<FormattedDateOverride[]>(initialOverrides);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [isUnavailable, setIsUnavailable] = useState(true);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("13:00");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Conflict warning state
  const [conflictWarning, setConflictWarning] = useState<{
    message: string;
    conflicts: Array<{ id: string; guestName: string; eventTitle: string; formattedTime: string }>;
  } | null>(null);

  const handleOpenModal = () => {
    setSelectedDate("");
    setIsUnavailable(true);
    setStartTime("09:00");
    setEndTime("13:00");
    setConflictWarning(null);
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleSaveException = async (force: boolean = false) => {
    if (!selectedDate) {
      setErrorMessage("Please select a calendar date.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const payload = {
      date: selectedDate,
      isUnavailable,
      startTime: isUnavailable ? null : startTime,
      endTime: isUnavailable ? null : endTime,
      force,
    };

    try {
      const res = await fetch("/api/dashboard/exceptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to save date exception.");
      }

      if (data.requiresConfirmation) {
        // Conflicting bookings found: show explicit confirmation
        setConflictWarning({
          message: data.message,
          conflicts: data.conflicts,
        });
        return;
      }

      // Success
      setOverrides((prev) => [...prev, data.override].sort((a, b) => a.date.localeCompare(b.date)));
      setSuccessMessage(
        `Date exception for ${selectedDate} has been applied. Public availability will reflect this schedule.`
      );
      setIsModalOpen(false);
      setConflictWarning(null);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "An error occurred while saving."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, date: string) => {
    if (!window.confirm(`Remove exception for ${date}? This date will revert to your standard weekly schedule.`)) {
      return;
    }

    setLoadingId(id);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/dashboard/exceptions/${id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to delete exception.");
      }

      setOverrides((prev) => prev.filter((o) => o.id !== id));
      setSuccessMessage(data.message || `Exception for ${date} removed.`);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to remove exception."
      );
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Date Exceptions & Special Days
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Override your weekly availability for specific dates (e.g. holidays, vacations, or custom hours). All times in {hostTimezone}.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenModal}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors shadow-xs inline-flex items-center gap-1.5 self-start sm:self-auto"
        >
          <span>+ Add Date Exception</span>
        </button>
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

      {/* List of Exceptions */}
      {overrides.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center space-y-4 shadow-xs">
          <CalendarIcon className="w-10 h-10 text-slate-300 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900">No date exceptions configured</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              You are currently following your recurring weekly availability for every date on the calendar.
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenModal}
            className="inline-block px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors shadow-xs"
          >
            Add Exception
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200/80 divide-y divide-slate-100 overflow-hidden shadow-xs">
          {overrides.map((item) => (
            <div
              key={item.id}
              className="p-5 flex items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                    item.isUnavailable
                      ? "bg-rose-50 text-rose-600"
                      : "bg-indigo-50 text-indigo-600"
                  }`}
                >
                  {item.isUnavailable ? (
                    <AlertCircleIcon className="w-5 h-5" />
                  ) : (
                    <ClockIcon className="w-5 h-5" />
                  )}
                </div>

                <div className="space-y-0.5">
                  <div className="text-sm font-bold text-slate-900 font-mono">
                    {item.date}
                  </div>
                  <div className="text-xs text-slate-500">
                    {item.isUnavailable ? (
                      <span className="font-semibold text-rose-600">
                        Unavailable all day (Blocked)
                      </span>
                    ) : (
                      <span className="text-slate-700">
                        Custom hours:{" "}
                        <strong className="font-mono text-slate-900">
                          {item.startTime} – {item.endTime}
                        </strong>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleDelete(item.id, item.date)}
                disabled={loadingId === item.id}
                className="text-xs font-semibold text-rose-600 hover:text-rose-800 transition-colors px-3 py-1.5 rounded-xl hover:bg-rose-50 disabled:opacity-50"
              >
                {loadingId === item.id ? (
                  <SpinnerIcon className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  "Remove"
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Exception Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-200 shadow-xl p-6 sm:p-8 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Add Date Exception
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Override weekly hours for a specific date in your calendar.
              </p>
            </div>

            {/* Conflict Warning Alert */}
            {conflictWarning && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-3">
                <div className="font-bold flex items-center gap-1.5 text-amber-800">
                  <AlertCircleIcon className="w-4 h-4 shrink-0" />
                  Existing Confirmed Bookings Detected
                </div>
                <p className="leading-relaxed">{conflictWarning.message}</p>
                <div className="space-y-1 bg-white/70 p-3 rounded-xl border border-amber-200/50">
                  <div className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider">
                    Affected Bookings:
                  </div>
                  {conflictWarning.conflicts.map((c) => (
                    <div key={c.id} className="text-xs text-amber-900 flex justify-between">
                      <span>{c.guestName} ({c.eventTitle})</span>
                      <span className="font-mono font-semibold">{c.formattedTime}</span>
                    </div>
                  ))}
                </div>
                <div className="text-[11px] text-amber-700 italic">
                  Note: Slotbook will NEVER silently cancel or modify confirmed appointments. You can proceed to add this exception, which will prevent ANY NEW bookings on these hours.
                </div>
              </div>
            )}

            <div className="space-y-4">
              {/* Date Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  Select Calendar Date
                </label>
                <input
                  type="date"
                  required
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Type Radio */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-800">
                  Exception Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setIsUnavailable(true)}
                    className={`p-3 rounded-2xl border text-left text-xs transition-all ${
                      isUnavailable
                        ? "border-rose-300 bg-rose-50/50 text-rose-900 font-semibold shadow-xs"
                        : "border-slate-200 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div className="font-bold">Block Entire Day</div>
                    <div className="text-[11px] opacity-75 mt-0.5">Unavailable all day</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsUnavailable(false)}
                    className={`p-3 rounded-2xl border text-left text-xs transition-all ${
                      !isUnavailable
                        ? "border-indigo-300 bg-indigo-50/50 text-indigo-900 font-semibold shadow-xs"
                        : "border-slate-200 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div className="font-bold">Custom Hours</div>
                    <div className="text-[11px] opacity-75 mt-0.5">Specific working window</div>
                  </button>
                </div>
              </div>

              {/* Custom Hours inputs */}
              {!isUnavailable && (
                <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200/60">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-700">
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-700">
                      End Time
                    </label>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>

              {conflictWarning ? (
                <button
                  type="button"
                  onClick={() => handleSaveException(true)}
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition-colors flex items-center gap-2 shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <SpinnerIcon className="w-4 h-4 animate-spin" />
                      <span>Applying...</span>
                    </>
                  ) : (
                    <span>Confirm & Apply Exception</span>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSaveException(false)}
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors flex items-center gap-2 shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <SpinnerIcon className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Exception</span>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

