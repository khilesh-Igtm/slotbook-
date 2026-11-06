"use client";

import React, { useState } from "react";
import { DateTime } from "luxon";
import { ChevronLeftIcon, ChevronRightIcon } from "./Icons";

export interface BookingCalendarProps {
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (dateIso: string) => void;
  timezone: string;
}

export function BookingCalendar({ selectedDate, onSelectDate, timezone }: BookingCalendarProps) {
  // Current month reference based on host timezone
  const todayHost = DateTime.now().setZone(timezone).startOf("day");
  const initialSelected = DateTime.fromISO(selectedDate, { zone: timezone }).isValid
    ? DateTime.fromISO(selectedDate, { zone: timezone }).startOf("day")
    : todayHost;

  const [currentMonth, setCurrentMonth] = useState<DateTime>(initialSelected.startOf("month"));

  const startOfMonth = currentMonth.startOf("month");
  const endOfMonth = currentMonth.endOf("month");

  // Luxon weekday: 1 = Monday, 7 = Sunday
  // Pad blank days before the 1st of the month
  const startWeekday = startOfMonth.weekday; // 1 to 7
  const blankDaysCount = startWeekday - 1;

  const daysInMonth = endOfMonth.day;
  const days: DateTime[] = [];
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(currentMonth.set({ day: i }).startOf("day"));
  }

  const prevMonth = () => {
    const prev = currentMonth.minus({ months: 1 });
    // Prevent going before the current month
    if (prev.endOf("month") >= todayHost) {
      setCurrentMonth(prev);
    }
  };

  const nextMonth = () => {
    setCurrentMonth(currentMonth.plus({ months: 1 }));
  };

  const canGoPrev = currentMonth.minus({ months: 1 }).endOf("month") >= todayHost;

  const weekHeaders = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="w-full">
      {/* Month Navigation Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <h2 className="text-base font-semibold text-slate-900">
          {currentMonth.toFormat("MMMM yyyy")}
        </h2>
        <div className="flex items-center space-x-1">
          <button
            type="button"
            onClick={prevMonth}
            disabled={!canGoPrev}
            aria-label="Previous Month"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeftIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={nextMonth}
            aria-label="Next Month"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <ChevronRightIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Weekday Names */}
      <div className="grid grid-cols-7 gap-1 pt-3 text-center text-xs font-semibold text-slate-400">
        {weekHeaders.map((day) => (
          <div key={day} className="py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-1 pt-2">
        {/* Leading blank slots */}
        {Array.from({ length: blankDaysCount }).map((_, i) => (
          <div key={`blank-${i}`} className="h-10" />
        ))}

        {/* Days of the month */}
        {days.map((day) => {
          const dateStr = day.toFormat("yyyy-MM-dd");
          const isSelected = dateStr === selectedDate;
          const isPast = day < todayHost;
          const isToday = day.hasSame(todayHost, "day");

          return (
            <button
              key={dateStr}
              type="button"
              disabled={isPast}
              onClick={() => onSelectDate(dateStr)}
              className={`h-10 w-full rounded-lg text-sm font-medium flex items-center justify-center transition-all ${
                isSelected
                  ? "bg-indigo-600 text-white shadow-sm font-semibold hover:bg-indigo-700"
                  : isPast
                  ? "text-slate-300 cursor-not-allowed"
                  : "text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              } ${isToday && !isSelected ? "border border-indigo-200 text-indigo-600 font-semibold" : ""}`}
            >
              <span>{day.day}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

