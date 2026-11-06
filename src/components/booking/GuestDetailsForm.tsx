"use client";

import React, { useState } from "react";
import { DateTime } from "luxon";
import { AvailableSlot } from "@/lib/services/availability.service";
import { ArrowLeftIcon, CalendarIcon, ClockIcon, GlobeIcon, SpinnerIcon, AlertCircleIcon } from "./Icons";

export interface GuestDetailsFormProps {
  slot: AvailableSlot;
  eventTitle: string;
  hostName: string;
  timezone: string;
  isSubmitting: boolean;
  errorMessage: string | null;
  onBack: () => void;
  onSubmit: (formData: { guestName: string; guestEmail: string }) => void;
}

export function GuestDetailsForm({
  slot,
  eventTitle,
  hostName,
  timezone,
  isSubmitting,
  errorMessage,
  onBack,
  onSubmit,
}: GuestDetailsFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});

  const dateObj = DateTime.fromISO(slot.startAt, { zone: timezone });
  const formattedDateTime = dateObj.isValid
    ? `${dateObj.toFormat("EEEE, MMMM d, yyyy")} • ${slot.localStart} – ${slot.localEnd}`
    : `${slot.localStart} – ${slot.localEnd}`;

  const validate = () => {
    const newErrors: { name?: string; email?: string } = {};
    if (!name.trim()) {
      newErrors.name = "Full name is required";
    }
    if (!email.trim()) {
      newErrors.email = "Email address is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = "Please enter a valid email address";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit({ guestName: name.trim(), guestEmail: email.trim() });
    }
  };

  return (
    <div className="space-y-6">
      {/* Back button & Title */}
      <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          aria-label="Back to time selection"
        >
          <ArrowLeftIcon className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-base font-semibold text-slate-900">Enter Your Details</h2>
          <p className="text-xs text-slate-500">Please provide your contact info to confirm the booking</p>
        </div>
      </div>

      {/* Selected Slot Summary Card */}
      <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 space-y-2">
        <div className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">
          {eventTitle} with {hostName}
        </div>
        <div className="flex items-center text-sm font-medium text-slate-800 gap-2">
          <CalendarIcon className="w-4 h-4 text-slate-400 shrink-0" />
          <span>{formattedDateTime}</span>
        </div>
        <div className="flex items-center text-xs text-slate-500 gap-4">
          <span className="flex items-center gap-1">
            <ClockIcon className="w-3.5 h-3.5" />
            {slot.duration}m
          </span>
          <span className="flex items-center gap-1">
            <GlobeIcon className="w-3.5 h-3.5" />
            {timezone}
          </span>
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-start gap-2.5">
          <AlertCircleIcon className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs leading-relaxed">{errorMessage}</div>
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="guestName" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Your Full Name *
          </label>
          <input
            id="guestName"
            type="text"
            required
            disabled={isSubmitting}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (errors.name) setErrors({ ...errors, name: undefined });
            }}
            placeholder="Jane Doe"
            className={`w-full px-3.5 py-2.5 rounded-lg border text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all ${
              errors.name
                ? "border-red-300 focus:border-red-500 focus:ring-red-500/20"
                : "border-slate-200 focus:border-indigo-600 focus:ring-indigo-500/20"
            }`}
          />
          {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
        </div>

        <div>
          <label htmlFor="guestEmail" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Your Email Address *
          </label>
          <input
            id="guestEmail"
            type="email"
            required
            disabled={isSubmitting}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors({ ...errors, email: undefined });
            }}
            placeholder="jane@example.com"
            className={`w-full px-3.5 py-2.5 rounded-lg border text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all ${
              errors.email
                ? "border-red-300 focus:border-red-500 focus:ring-red-500/20"
                : "border-slate-200 focus:border-indigo-600 focus:ring-indigo-500/20"
            }`}
          />
          {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email}</p>}
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-sm transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <SpinnerIcon className="w-4 h-4 text-white" />
                <span>Confirming Booking...</span>
              </>
            ) : (
              <span>Confirm Appointment</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

