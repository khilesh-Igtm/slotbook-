"use client";

import React, { useState } from "react";
import Link from "next/link";
import { BookingStatus, NotificationType, NotificationStatus } from "@prisma/client";
import {
  CalendarIcon,
  ClockIcon,
  VideoIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  SpinnerIcon,
} from "@/components/booking/Icons";

export interface HostBookingDetailProps {
  booking: {
    id: string;
    guestName: string;
    guestEmail: string;
    status: BookingStatus;
    cancellationReason: string | null;
    startAtUtc: string;
    endAtUtc: string;
    reservedStartAtUtc: string;
    reservedEndAtUtc: string;
    createdAtUtc: string;
    formattedDate: string;
    formattedTime: string;
    formattedReservedTime: string;
    eventType: {
      id: string;
      title: string;
      slug: string;
      description: string | null;
      duration: number;
      bufferBefore: number;
      bufferAfter: number;
      location: string | null;
    };
    notifications: Array<{
      id: string;
      type: NotificationType;
      status: NotificationStatus;
      scheduledAt: string;
      sentAt: string | null;
    }>;
  };
  hostTimezone: string;
}

export function HostBookingDetail({
  booking: initialBooking,
  hostTimezone,
}: HostBookingDetailProps) {
  const [booking, setBooking] = useState(initialBooking);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isCancelled = booking.status === "CANCELLED";

  const handleCancelBooking = async () => {
    setIsCancelling(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/dashboard/bookings/${booking.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason.trim() || undefined }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to cancel booking.");
      }

      setBooking((prev) => ({
        ...prev,
        status: data.booking.status,
        cancellationReason: data.booking.cancellationReason,
      }));

      setSuccessMessage(data.message || "Booking has been cancelled.");
      setIsCancelModalOpen(false);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to cancel booking."
      );
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      {/* Top Breadcrumb & Actions */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/bookings"
          className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors flex items-center gap-1.5"
        >
          &larr; Back to all bookings
        </Link>

        {!isCancelled && (
          <button
            type="button"
            onClick={() => setIsCancelModalOpen(true)}
            className="px-4 py-2 rounded-xl border border-red-200 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
          >
            Cancel Appointment
          </button>
        )}
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

      {/* Main Details Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Card Header */}
        <div className="p-6 sm:p-8 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
              {booking.eventType.title}
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              Appointment with {booking.guestName}
            </h1>
          </div>

          <span
            className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider self-start sm:self-auto ${
              isCancelled
                ? "bg-rose-50 text-rose-700 border border-rose-200"
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
              <div className="font-bold text-slate-900 text-base">
                {booking.formattedDate}
              </div>
              <div className="text-xs text-slate-500 font-medium mt-0.5">
                {booking.formattedTime} ({hostTimezone})
              </div>
              <div className="text-[11px] font-mono text-slate-400 mt-1">
                UTC: {booking.startAtUtc}
              </div>
            </div>
          </div>

          {/* Grid Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Guest Attendee
              </div>
              <div className="text-sm font-bold text-slate-900 mt-1">
                {booking.guestName}
              </div>
              <div className="text-xs text-slate-500">{booking.guestEmail}</div>
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Meeting Duration
              </div>
              <div className="text-sm font-bold text-slate-900 mt-1">
                {booking.eventType.duration} minutes
              </div>
              {booking.eventType.location && (
                <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                  <VideoIcon className="w-3.5 h-3.5 text-slate-400" />
                  <span>{booking.eventType.location}</span>
                </div>
              )}
            </div>
          </div>

          {/* Concurrency Buffer Info */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1.5 text-xs text-slate-600">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <ClockIcon className="w-4 h-4 text-indigo-600" />
              Buffer-Protected Reservation Bounds
            </div>
            <div className="text-[11px] text-slate-500 leading-relaxed">
              Reserved with {booking.eventType.bufferBefore}m pre-buffer and {booking.eventType.bufferAfter}m post-buffer: <strong className="font-mono text-slate-800">{booking.formattedReservedTime}</strong> ({hostTimezone}).
            </div>
          </div>

          {/* Cancellation Info if Cancelled */}
          {isCancelled && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-1">
              <div className="font-bold text-rose-800 flex items-center gap-1.5">
                <AlertCircleIcon className="w-4 h-4 text-rose-600" />
                Cancellation Details
              </div>
              <div>
                Reason: <strong>{booking.cancellationReason || "No reason specified."}</strong>
              </div>
              <div className="text-[11px] text-rose-600 pt-1">
                This time slot has been released back into your availability calendar.
              </div>
            </div>
          )}

          {/* Notifications Timeline */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <div className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Notification Events ({booking.notifications.length})
            </div>

            {booking.notifications.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No notifications generated.</p>
            ) : (
              <div className="space-y-2">
                {booking.notifications.map((n) => (
                  <div
                    key={n.id}
                    className="flex items-center justify-between text-xs bg-slate-50 p-3 rounded-xl border border-slate-100"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800">{n.type}</span>
                      <span className="text-[11px] text-slate-400">
                        Scheduled: {n.scheduledAt}
                      </span>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        n.status === "SENT"
                          ? "bg-emerald-50 text-emerald-700"
                          : n.status === "SCHEDULED"
                          ? "bg-indigo-50 text-indigo-700"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {n.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Reference ID */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span>Reference ID</span>
            <span className="font-mono text-slate-600 select-all">{booking.id}</span>
          </div>
        </div>
      </div>

      {/* Host Cancel Modal */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-xl p-6 space-y-6">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-900">
                Cancel Appointment
              </h3>
              <p className="text-xs text-slate-500">
                Are you sure you want to cancel the appointment with {booking.guestName}? The reserved time slot will immediately be made available again.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800">
                Cancellation Reason (Optional)
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Host schedule conflict, rescheduling required..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Keep Booking
              </button>
              <button
                type="button"
                onClick={handleCancelBooking}
                disabled={isCancelling}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors flex items-center gap-2 shadow-xs disabled:opacity-50"
              >
                {isCancelling ? (
                  <>
                    <SpinnerIcon className="w-4 h-4 animate-spin" />
                    <span>Cancelling...</span>
                  </>
                ) : (
                  <span>Confirm Cancellation</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

