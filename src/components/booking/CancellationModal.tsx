"use client";

import React, { useState } from "react";
import { AlertCircleIcon, SpinnerIcon } from "./Icons";

export interface CancellationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  eventTitle: string;
  hostName: string;
}

export function CancellationModal({
  isOpen,
  onClose,
  onConfirm,
  eventTitle,
  hostName,
}: CancellationModalProps) {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await onConfirm(reason);
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to cancel booking.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-5 animate-scaleUp">
        <div className="flex items-center space-x-3 text-red-600">
          <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
            <AlertCircleIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">Cancel Appointment</h3>
            <p className="text-xs text-slate-500">This action will release your reserved slot.</p>
          </div>
        </div>

        <p className="text-sm text-slate-600 leading-relaxed">
          Are you sure you want to cancel your <strong className="text-slate-800">{eventTitle}</strong> with{" "}
          <strong className="text-slate-800">{hostName}</strong>?
        </p>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs leading-relaxed">
            {error}
          </div>
        )}

        <form onSubmit={handleConfirm} className="space-y-4">
          <div>
            <label htmlFor="cancelReason" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Reason for Cancellation <span className="font-normal text-slate-400 lowercase">(optional)</span>
            </label>
            <textarea
              id="cancelReason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Scheduling conflict, sickness..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
            />
          </div>

          <div className="flex items-center justify-end space-x-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium rounded-lg text-slate-700 hover:bg-slate-100 transition-colors"
            >
              Keep Booking
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white shadow-xs transition-colors flex items-center space-x-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <SpinnerIcon className="w-4 h-4 text-white" />
                  <span>Cancelling...</span>
                </>
              ) : (
                <span>Confirm Cancellation</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

