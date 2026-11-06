"use client";

import React, { useState } from "react";
import { DateTime } from "luxon";
import { BookingResponse } from "@/lib/services/booking.service";
import { CheckCircleIcon, CalendarIcon, ClockIcon, GlobeIcon, VideoIcon, AlertCircleIcon } from "./Icons";
import { CancellationModal } from "./CancellationModal";

export interface ConfirmationViewProps {
  booking: BookingResponse;
  onBookAnother: () => void;
  onCancellationSuccess?: (updatedBooking: BookingResponse) => void;
}

export function ConfirmationView({ booking, onBookAnother, onCancellationSuccess }: ConfirmationViewProps) {
  const [currentBooking, setCurrentBooking] = useState<BookingResponse>(booking);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cancelStatusMessage, setCancelStatusMessage] = useState<string | null>(null);

  const isCancelled = currentBooking.status === "CANCELLED";
  const timezone = currentBooking.host.timezone;
  const startDt = DateTime.fromISO(currentBooking.startAt, { zone: timezone });
  const endDt = DateTime.fromISO(currentBooking.endAt, { zone: timezone });

  const formattedDate = startDt.isValid ? startDt.toFormat("EEEE, MMMM d, yyyy") : currentBooking.startAt;
  const formattedTime = startDt.isValid && endDt.isValid
    ? `${startDt.toFormat("HH:mm")} – ${endDt.toFormat("HH:mm")}`
    : "";

  const handleCancel = async (reason: string) => {
    if (!currentBooking.cancellationKey) {
      throw new Error("No cancellation key available for this session.");
    }

    const res = await fetch(`/api/bookings/${currentBooking.id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cancellationKey: currentBooking.cancellationKey,
        reason,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.message || "Failed to cancel appointment.");
    }

    setCurrentBooking(data.booking);
    setCancelStatusMessage("Your appointment has been cancelled successfully. Your time slot has been released.");
    if (onCancellationSuccess) {
      onCancellationSuccess(data.booking);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-4 px-2 space-y-6">
      {/* Header Banner */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 mb-1">
          {isCancelled ? (
            <AlertCircleIcon className="w-8 h-8 text-amber-500" />
          ) : (
            <CheckCircleIcon className="w-8 h-8 text-emerald-600" />
          )}
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {isCancelled ? "Appointment Cancelled" : "You're Scheduled!"}
        </h1>
        <p className="text-sm text-slate-500">
          {isCancelled
            ? "This booking is no longer active."
            : "A calendar invitation has been sent to your email address."}
        </p>
      </div>

      {cancelStatusMessage && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs leading-relaxed">
          {cancelStatusMessage}
        </div>
      )}

      {/* Booking Details Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
              {currentBooking.eventType.title}
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                isCancelled ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
              }`}
            >
              {currentBooking.status}
            </span>
          </div>
          <h2 className="text-lg font-bold text-slate-900">With {currentBooking.host.name}</h2>
        </div>

        <div className="p-6 space-y-4 text-sm">
          <div className="flex items-start gap-3">
            <CalendarIcon className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-slate-800">{formattedDate}</div>
              <div className="text-xs text-slate-500">
                {formattedTime} ({timezone})
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ClockIcon className="w-5 h-5 text-slate-400 shrink-0" />
            <span className="text-slate-700 font-medium">{currentBooking.eventType.duration} minutes</span>
          </div>

          {currentBooking.eventType.location && (
            <div className="flex items-center gap-3">
              <VideoIcon className="w-5 h-5 text-slate-400 shrink-0" />
              <span className="text-slate-700 font-medium">{currentBooking.eventType.location}</span>
            </div>
          )}

          <div className="flex items-center gap-3">
            <GlobeIcon className="w-5 h-5 text-slate-400 shrink-0" />
            <span className="text-slate-600 text-xs">Host timezone: {timezone}</span>
          </div>

          {/* Guest Info */}
          <div className="pt-4 border-t border-slate-100 flex flex-col space-y-1 text-xs">
            <span className="font-semibold text-slate-400 uppercase tracking-wider">Booked For</span>
            <span className="font-semibold text-slate-800 text-sm">{currentBooking.guestName}</span>
            <span className="text-slate-500">{currentBooking.guestEmail}</span>
          </div>

          {/* Booking Ref */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span>Reference ID</span>
            <span className="font-mono text-slate-600 select-all">{currentBooking.id}</span>
          </div>
        </div>
      </div>

      {/* Actions / Cancellation Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={onBookAnother}
          className="w-full sm:w-auto px-5 py-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm transition-colors text-center"
        >
          Book Another Time
        </button>

        {!isCancelled && currentBooking.cancellationKey && (
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="w-full sm:w-auto text-xs text-slate-400 hover:text-red-600 font-medium transition-colors py-2"
          >
            Need to cancel this appointment?
          </button>
        )}
      </div>

      {/* Cancellation Modal */}
      <CancellationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleCancel}
        eventTitle={currentBooking.eventType.title}
        hostName={currentBooking.host.name}
      />
    </div>
  );
}

