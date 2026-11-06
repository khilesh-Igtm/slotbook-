"use client";

import React from "react";
import { DateTime } from "luxon";
import { AvailableSlot } from "@/lib/services/availability.service";
import { ClockIcon, SpinnerIcon } from "./Icons";

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
  const dateObj = DateTime.fromISO(selectedDate, { zone: timezone });
  const formattedDate = dateObj.isValid ? dateObj.toFormat("EEEE, MMMM d") : selectedDate;

  return (
    <div className="flex flex-col h-full">
      {/* Date Header */}
      <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{formattedDate}</h3>
          <p className="text-xs text-slate-500 mt-0.5">Times shown in {timezone}</p>
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

              if (isSelected) {
                return (
                  <div key={slot.startAt} className="grid grid-cols-2 gap-2 animate-fadeIn">
                    <button
                      type="button"
                      className="py-2.5 px-3 rounded-lg border-2 border-indigo-600 bg-indigo-50/50 text-indigo-700 font-semibold text-sm text-center shadow-xs"
                    >
                      {slot.localStart}
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
                  {slot.localStart}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

