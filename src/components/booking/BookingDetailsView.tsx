"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { DateTime } from "luxon";
import { PublicBookingResponse } from "@/lib/services/booking.service";
import {
  CalendarIcon,
  ClockIcon,
  VideoIcon,
  CheckCircleIcon,
  AlertCircleIcon,
} from "./Icons";
import { CancellationModal } from "./CancellationModal";

export interface BookingDetailsViewProps {
  initialBooking: PublicBookingResponse;
  initialKey?: string;
}

export function BookingDetailsView({
  initialBooking,
  initialKey = "",
}: BookingDetailsViewProps) {
  const searchParams = useSearchParams();
  const keyFromUrl = searchParams.get("key") || "";
  const [booking, setBooking] = useState<PublicBookingResponse>(initialBooking);
  const [cancellationKey, setCancellationKey] = useState<string>(initialKey || keyFromUrl);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isCancelled = booking.status === "CANCELLED";
  const timezone = booking.host.timezone;
  const startDt = DateTime.fromISO(booking.startAt, { zone: timezone });
  const endDt = DateTime.fromISO(booking.endAt, { zone: timezone });

  const formattedDate = startDt.isValid
    ? startDt.toFormat("EEEE, MMMM d, yyyy")
    : booking.startAt;
  const formattedTime =
    startDt.isValid && endDt.isValid
      ? `${startDt.toFormat("HH:mm")} – ${endDt.toFormat("HH:mm")}`
      : "";

  const handleCancelConfirm = async (reason: string) => {
    if (!cancellationKey.trim()) {
      setErrorMessage("Please provide a valid cancellation key to cancel this booking.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/bookings/${booking.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cancellationKey: cancellationKey.trim(),
          reason,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to cancel appointment.");
      }

      setBooking(data.booking);
      setSuccessMessage(
        "Appointment successfully cancelled. The reserved slot has been released back to availability."
      );
      setIsModalOpen(false);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "An unexpected error occurred."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Status Banner */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-slate-100 mb-1">
          {isCancelled ? (
            <AlertCircleIcon className="w-8 h-8 text-amber-500" />
          ) : (
            <CheckCircleIcon className="w-8 h-8 text-emerald-600" />
          )}
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {isCancelled ? "Appointment Cancelled" : "Confirmed Appointment"}
        </h1>
        <p className="text-sm text-slate-500">
          {isCancelled
            ? "This appointment was cancelled and the time slot was released."
            : "Review appointment details or manage your booking."}
        </p>
      </div>

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs leading-relaxed">
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs leading-relaxed flex items-center gap-2">
          <AlertCircleIcon className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-6 sm:p-8 border-b border-slate-100 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
              {booking.eventType.title}
            </span>
            <h2 className="text-xl font-bold text-slate-900">
              With {booking.host.name}
            </h2>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
              isCancelled
                ? "bg-red-50 text-red-700 border border-red-200"
                : "bg-emerald-50 text-emerald-700 border border-emerald-200"
            }`}
          >
            {booking.status}
          </span>
        </div>

        <div className="p-6 sm:p-8 space-y-6 text-sm">
          {/* Time & Date */}
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 text-slate-600">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="font-semibold text-slate-900 text-base">
                {formattedDate}
              </div>
              <div className="text-xs text-slate-500 font-medium mt-0.5">
                {formattedTime} ({timezone})
              </div>
            </div>
          </div>

          {/* Duration & Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-3">
              <ClockIcon className="w-5 h-5 text-slate-400 shrink-0" />
              <div>
                <div className="text-xs text-slate-400 font-medium">Duration</div>
                <div className="text-sm font-semibold text-slate-800">
                  {booking.eventType.duration} minutes
                </div>
              </div>
            </div>

            {booking.eventType.location && (
              <div className="flex items-center gap-3">
                <VideoIcon className="w-5 h-5 text-slate-400 shrink-0" />
                <div>
                  <div className="text-xs text-slate-400 font-medium">Location</div>
                  <div className="text-sm font-semibold text-slate-800">
                    {booking.eventType.location}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Guest Info */}
          <div className="pt-4 border-t border-slate-100 space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Guest Attendee
            </div>
            <div className="text-sm font-bold text-slate-900">{booking.guestName}</div>
            <div className="text-xs text-slate-500">{booking.guestEmail}</div>
          </div>

          {/* Cancellation Info if Cancelled */}
          {isCancelled && booking.cancellationReason && (
            <div className="pt-4 border-t border-slate-100 bg-amber-50/50 p-4 rounded-xl border border-amber-200/50 space-y-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-amber-800">
                Cancellation Reason
              </div>
              <div className="text-xs text-amber-900">{booking.cancellationReason}</div>
            </div>
          )}

          {/* Reference ID */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span>Booking Reference</span>
            <span className="font-mono text-slate-600 select-all">{booking.id}</span>
          </div>
        </div>

        {/* Cancellation Section (if Confirmed) */}
        {!isCancelled && (
          <div className="p-6 sm:p-8 bg-slate-50 border-t border-slate-100 space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-800">
                Manage Appointment
              </h3>
              <p className="text-xs text-slate-500">
                To prevent unauthorized cancellations, enter the cancellation key provided when this appointment was booked.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="Enter Cancellation Key (e.g. UUID)"
                value={cancellationKey}
                onChange={(e) => setCancellationKey(e.target.value)}
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              />
              <button
                type="button"
                onClick={() => {
                  if (!cancellationKey.trim()) {
                    setErrorMessage("Please enter your cancellation key before proceeding.");
                    return;
                  }
                  setIsModalOpen(true);
                }}
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-white border border-red-200 text-red-600 hover:bg-red-50 font-semibold text-xs transition-colors shrink-0 disabled:opacity-50"
              >
                Cancel Appointment
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Back / Book Another */}
      <div className="flex justify-between items-center text-xs">
        <Link
          href={`/book/${booking.host.slug}`}
          className="text-indigo-600 hover:text-indigo-700 font-semibold transition-colors"
        >
          &larr; View all events by {booking.host.name}
        </Link>
        <Link
          href="/"
          className="text-slate-400 hover:text-slate-600 transition-colors"
        >
          Slotbook Home
        </Link>
      </div>

      {/* Cancellation Modal */}
      <CancellationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleCancelConfirm}
        eventTitle={booking.eventType.title}
        hostName={booking.host.name}
      />
    </div>
  );
}
