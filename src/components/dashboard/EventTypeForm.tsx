"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircleIcon, SpinnerIcon, CheckCircleIcon } from "@/components/booking/Icons";

export interface EventTypeFormProps {
  initialData?: {
    id?: string;
    title: string;
    slug: string;
    description: string | null;
    duration: number;
    bufferBefore: number;
    bufferAfter: number;
    location: string | null;
    isActive: boolean;
  };
  hostSlug: string;
  isEdit?: boolean;
}

export function EventTypeForm({
  initialData,
  hostSlug,
  isEdit = false,
}: EventTypeFormProps) {
  const router = useRouter();

  const [title, setTitle] = useState(initialData?.title || "");
  const [slug, setSlug] = useState(initialData?.slug || "");
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(Boolean(initialData?.slug));
  const [description, setDescription] = useState(initialData?.description || "");
  const [duration, setDuration] = useState(initialData?.duration || 30);
  const [bufferBefore, setBufferBefore] = useState(initialData?.bufferBefore ?? 0);
  const [bufferAfter, setBufferAfter] = useState(initialData?.bufferAfter ?? 0);
  const [location, setLocation] = useState(initialData?.location || "Google Meet");
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Auto-generate slug from title if user hasn't edited slug directly
  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!isSlugManuallyEdited) {
      const generated = val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      setSlug(generated);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const payload = {
      title: title.trim(),
      slug: slug.trim(),
      description: description.trim() || null,
      duration: Number(duration),
      bufferBefore: Number(bufferBefore),
      bufferAfter: Number(bufferAfter),
      location: location.trim() || null,
      isActive,
    };

    try {
      const url = isEdit
        ? `/api/dashboard/events/${initialData?.id}`
        : "/api/dashboard/events";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to save event type.");
      }

      setSuccessMessage(
        isEdit ? "Event type updated successfully." : "Event type created successfully."
      );

      setTimeout(() => {
        router.push("/dashboard/events");
        router.refresh();
      }, 700);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "An error occurred while saving."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            {isEdit ? "Edit Event Type" : "Create New Event Type"}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure appointment duration, buffer intervals, and public booking settings.
          </p>
        </div>
        <Link
          href="/dashboard/events"
          className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
        >
          Cancel
        </Link>
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

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-xs space-y-6"
      >
        {/* Title */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-800">
            Event Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            placeholder="e.g. 30-Minute Meeting"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Slug */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-800">
            URL Slug <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center rounded-xl border border-slate-200 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500">
            <span className="bg-slate-50 px-3 py-2.5 text-xs text-slate-400 border-r border-slate-200 shrink-0 font-mono">
              /book/{hostSlug}/
            </span>
            <input
              type="text"
              required
              placeholder="30-min-call"
              value={slug}
              onChange={(e) => {
                setIsSlugManuallyEdited(true);
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
              }}
              className="w-full px-3 py-2.5 text-xs font-mono text-slate-800 focus:outline-none"
            />
          </div>
          <p className="text-[11px] text-slate-400">
            Unique identifier for your public booking link. Lowercase letters, numbers, and hyphens only.
          </p>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-800">
            Description
          </label>
          <textarea
            rows={3}
            placeholder="Brief overview of the meeting agenda or what attendees should prepare."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Duration & Buffers */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-800">
              Duration (minutes) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min={5}
              max={720}
              required
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-800">
              Buffer Before (mins)
            </label>
            <input
              type="number"
              min={0}
              max={120}
              value={bufferBefore}
              onChange={(e) => setBufferBefore(Number(e.target.value))}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-800">
              Buffer After (mins)
            </label>
            <input
              type="number"
              min={0}
              max={120}
              value={bufferAfter}
              onChange={(e) => setBufferAfter(Number(e.target.value))}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
        <p className="text-[11px] text-slate-400 -mt-2">
          Buffers prevent back-to-back fatigue. Slots are automatically isolated from adjacent appointments by buffer intervals.
        </p>

        {/* Location */}
        <div className="space-y-1.5 pt-2 border-t border-slate-100">
          <label className="block text-xs font-bold text-slate-800">
            Location or Meeting Link
          </label>
          <input
            type="text"
            placeholder="e.g. Google Meet, Zoom, or In-person Address"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Status Toggle */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-800">Active Status</div>
            <div className="text-[11px] text-slate-500">
              When inactive, guests cannot book new slots for this event type.
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
          </label>
        </div>

        {/* Actions */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
          <Link
            href="/dashboard/events"
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors flex items-center gap-2 shadow-xs disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <SpinnerIcon className="w-4 h-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <span>{isEdit ? "Update Event Type" : "Create Event Type"}</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

