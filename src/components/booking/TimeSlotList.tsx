"use client";

import React, { useState } from "react";
import { DateTime } from "luxon";
import { AvailableSlot } from "@/lib/services/availability.service";
import { ClockIcon, GlobeIcon, SpinnerIcon } from "./Icons";

const TIMEZONE_OPTIONS = [
  "Asia/Kolkata",
  "America/New_York",
  "America/Los_Angeles",
  "America/Chicago",
  "Europe/London",
  "Europe/Paris",
  "Asia/Tokyo",
  "UTC",
];

export interface TimeSlotListProps {
  selectedDate: string;
  slots: AvailableSlot[];
  isLoading: boolean;
  selectedSlot: AvailableSlot | null;
  onSelectSlot: (slot: AvailableSlot) => void;
  onProceedToDetails: () => void;
  timezone: string;
}

export function TimeSlotList({
  selectedDate,
  slots,
  isLoading,
  selectedSlot,
  onSelectSlot,
  onProceedToDetails,
  timezone,
}: TimeSlotListProps) {
  const [guestZone, setGuestZone] = useState<string>(timezone);

  const dateObj = DateTime.fromISO(selectedDate, { zone: guestZone });
  const formattedDate = dateObj.isValid ? dateObj.toFormat("EEEE, MMMM d") : selectedDate;

  // Ensure host timezone is always included in the dropdown options
  const availableTimezones = Array.from(new Set([timezone, ...TIMEZONE_OPTIONS]));

  return (
    <div className="flex flex-col h-full">
      {/* Date Header & Timezone Selector */}
      <div className="pb-3 border-b border-slate-100 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{formattedDate}</h3>
          <p className="text-xs text-slate-500 mt-0.5">Times shown in {guestZone}</p>
        </div>

        {/* Guest Timezone Selector */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          <GlobeIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <select
            value={guestZone}
            onChange={(e) => setGuestZone(e.target.value)}
            className="text-xs text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            title="Change display timezone"
          >
            {availableTimezones.map((tz) => (
              <option key={tz} value={tz}>
                {tz} {tz === timezone ? "(Host)" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Content Area */}
      <div className="pt-4 flex-1">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-3 text-slate-400">
            <SpinnerIcon className="w-6 h-6 text-indigo-600" />
            <span className="text-xs font-medium text-slate-500">Checking availability...</span>
          </div>
        ) : slots.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 px-4 text-center">
            <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
              <ClockIcon className="w-5 h-5" />
            </div>
            <p className="text-sm font-semibold text-slate-800">No available slots</p>
            <p className="text-xs text-slate-500 max-w-xs mt-1">
              There are no available appointment times on this date. Please select a different day on the calendar.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
            {slots.map((slot) => {
              const isSelected = selectedSlot?.startAt === slot.startAt;
              // Format slot boundary according to the selected display timezone
              const displayStart = DateTime.fromISO(slot.startAt).setZone(guestZone).toFormat("HH:mm");

              if (isSelected) {
                return (
                  <div key={slot.startAt} className="grid grid-cols-2 gap-2 animate-fadeIn">
                    <button
                      type="button"
                      className="py-2.5 px-3 rounded-lg border-2 border-indigo-600 bg-indigo-50/50 text-indigo-700 font-semibold text-sm text-center shadow-xs"
                    >
                      {displayStart}
                    </button>
                    <button
                      type="button"
                      onClick={onProceedToDetails}
                      className="py-2.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm text-center shadow-xs transition-colors"
                    >
                      Next
                    </button>
                  </div>
                );
              }

              return (
                <button
                  key={slot.startAt}
                  type="button"
                  onClick={() => onSelectSlot(slot)}
                  className="w-full py-2.5 px-4 rounded-lg border border-slate-200 bg-white hover:border-indigo-600 hover:text-indigo-600 font-medium text-sm text-slate-700 transition-all text-center focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  {displayStart}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

