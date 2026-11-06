"use client";

import React, { useState } from "react";
import { DayOfWeek } from "@prisma/client";
import { DayScheduleInput } from "@/lib/validations/availability.schema";
import { ClockIcon, CheckCircleIcon, AlertCircleIcon, SpinnerIcon } from "@/components/booking/Icons";

const DAY_LABELS: Record<DayOfWeek, string> = {
  [DayOfWeek.MONDAY]: "Monday",
  [DayOfWeek.TUESDAY]: "Tuesday",
  [DayOfWeek.WEDNESDAY]: "Wednesday",
  [DayOfWeek.THURSDAY]: "Thursday",
  [DayOfWeek.FRIDAY]: "Friday",
  [DayOfWeek.SATURDAY]: "Saturday",
  [DayOfWeek.SUNDAY]: "Sunday",
};

export interface WeeklyAvailabilityManagerProps {
  initialSchedules: DayScheduleInput[];
  hostTimezone: string;
}

export function WeeklyAvailabilityManager({
  initialSchedules,
  hostTimezone,
}: WeeklyAvailabilityManagerProps) {
  const [schedules, setSchedules] = useState<DayScheduleInput[]>(initialSchedules);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleToggleDay = (dayIndex: number) => {
    setSchedules((prev) =>
      prev.map((d, idx) => {
        if (idx !== dayIndex) return d;
        const willBeEnabled = !d.isEnabled;
        return {
          ...d,
          isEnabled: willBeEnabled,
          windows: willBeEnabled && d.windows.length === 0
            ? [{ startTime: "09:00", endTime: "17:00" }]
            : d.windows,
        };
      })
    );
  };

  const handleAddWindow = (dayIndex: number) => {
    setSchedules((prev) =>
      prev.map((d, idx) => {
        if (idx !== dayIndex) return d;
        // Default new window after existing windows if possible
        const lastWindow = d.windows[d.windows.length - 1];
        let newStart = "13:00";
        let newEnd = "17:00";

        if (lastWindow) {
          newStart = lastWindow.endTime;
          // Add 2 hours if before 22:00
          const [h] = lastWindow.endTime.split(":").map(Number);
          const endHour = Math.min(h + 2, 23);
          newEnd = `${String(endHour).padStart(2, "0")}:00`;
        }

        return {
          ...d,
          windows: [...d.windows, { startTime: newStart, endTime: newEnd }],
        };
      })
    );
  };

  const handleRemoveWindow = (dayIndex: number, windowIndex: number) => {
    setSchedules((prev) =>
      prev.map((d, idx) => {
        if (idx !== dayIndex) return d;
        const newWindows = d.windows.filter((_, wIdx) => wIdx !== windowIndex);
        return {
          ...d,
          windows: newWindows,
          isEnabled: newWindows.length > 0,
        };
      })
    );
  };

  const handleWindowChange = (
    dayIndex: number,
    windowIndex: number,
    field: "startTime" | "endTime",
    value: string
  ) => {
    setSchedules((prev) =>
      prev.map((d, idx) => {
        if (idx !== dayIndex) return d;
        const updatedWindows = d.windows.map((w, wIdx) => {
          if (wIdx !== windowIndex) return w;
          return { ...w, [field]: value };
        });
        return { ...d, windows: updatedWindows };
      })
    );
  };

  const handleCopyToAll = (sourceDayIndex: number) => {
    const source = schedules[sourceDayIndex];
    if (!source) return;

    if (!window.confirm(`Copy ${DAY_LABELS[source.dayOfWeek]}'s schedule to all other weekdays (Mon–Fri)?`)) {
      return;
    }

    const weekdays: DayOfWeek[] = [
      DayOfWeek.MONDAY,
      DayOfWeek.TUESDAY,
      DayOfWeek.WEDNESDAY,
      DayOfWeek.THURSDAY,
      DayOfWeek.FRIDAY,
    ];

    setSchedules((prev) =>
      prev.map((d) => {
        if (weekdays.includes(d.dayOfWeek)) {
          return {
            ...d,
            isEnabled: source.isEnabled,
            windows: JSON.parse(JSON.stringify(source.windows)),
          };
        }
        return d;
      })
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch("/api/dashboard/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedules }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to update availability.");
      }

      setSchedules(data.schedules);
      setSuccessMessage("Weekly availability schedule updated successfully.");
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "An error occurred while saving schedule."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Weekly Working Hours
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Set your recurring available hours. Multi-window intervals are supported. All times in {hostTimezone}.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors flex items-center gap-2 shadow-xs disabled:opacity-50 self-start sm:self-auto"
        >
          {isSaving ? (
            <>
              <SpinnerIcon className="w-4 h-4 animate-spin" />
              <span>Saving Changes...</span>
            </>
          ) : (
            <span>Save Availability &rarr;</span>
          )}
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

      {/* Days List */}
      <div className="bg-white rounded-3xl border border-slate-200/80 divide-y divide-slate-100 overflow-hidden shadow-xs">
        {schedules.map((daySchedule, dayIdx) => (
          <div
            key={daySchedule.dayOfWeek}
            className={`p-5 transition-colors ${
              daySchedule.isEnabled ? "bg-white" : "bg-slate-50/50"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              {/* Day Toggle & Label */}
              <div className="flex items-center gap-3 w-40 shrink-0">
                <input
                  type="checkbox"
                  id={`day-toggle-${daySchedule.dayOfWeek}`}
                  checked={daySchedule.isEnabled}
                  onChange={() => handleToggleDay(dayIdx)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                />
                <label
                  htmlFor={`day-toggle-${daySchedule.dayOfWeek}`}
                  className={`text-sm font-bold cursor-pointer ${
                    daySchedule.isEnabled ? "text-slate-900" : "text-slate-400"
                  }`}
                >
                  {DAY_LABELS[daySchedule.dayOfWeek]}
                </label>
              </div>

              {/* Windows Column */}
              <div className="flex-1 space-y-2">
                {!daySchedule.isEnabled || daySchedule.windows.length === 0 ? (
                  <span className="text-xs text-slate-400 italic">
                    Unavailable (closed all day)
                  </span>
                ) : (
                  daySchedule.windows.map((win, winIdx) => (
                    <div
                      key={winIdx}
                      className="flex items-center gap-2 flex-wrap"
                    >
                      <input
                        type="time"
                        value={win.startTime}
                        onChange={(e) =>
                          handleWindowChange(dayIdx, winIdx, "startTime", e.target.value)
                        }
                        className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-mono text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <span className="text-xs text-slate-400">to</span>
                      <input
                        type="time"
                        value={win.endTime}
                        onChange={(e) =>
                          handleWindowChange(dayIdx, winIdx, "endTime", e.target.value)
                        }
                        className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-mono text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />

                      {daySchedule.windows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveWindow(dayIdx, winIdx)}
                          className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                          title="Delete this window"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Day Actions */}
              {daySchedule.isEnabled && (
                <div className="flex items-center gap-2 self-start pt-0.5">
                  <button
                    type="button"
                    onClick={() => handleAddWindow(dayIdx)}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors px-2 py-1 rounded-lg hover:bg-indigo-50/50"
                  >
                    + Add Interval
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopyToAll(dayIdx)}
                    title="Copy this day's schedule to Mon–Fri"
                    className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Info Callout */}
      <div className="p-4 rounded-2xl bg-slate-100/70 text-xs text-slate-600 flex items-start gap-3">
        <ClockIcon className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-slate-800">Buffer & Concurrency Note:</span> Changing weekly availability modifies which time intervals are evaluated for future appointments. Existing bookings and their buffer protections are preserved and never deleted or modified.
        </div>
      </div>
    </div>
  );
}
