"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ClockIcon, VideoIcon, AlertCircleIcon, SpinnerIcon } from "@/components/booking/Icons";

export interface EventTypeItem {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  duration: number;
  bufferBefore: number;
  bufferAfter: number;
  location: string | null;
  isActive: boolean;
  _count: {
    bookings: number;
  };
}

export interface EventTypesListProps {
  initialEventTypes: EventTypeItem[];
  hostSlug: string;
}

export function EventTypesList({
  initialEventTypes,
  hostSlug,
}: EventTypesListProps) {
  const [eventTypes, setEventTypes] = useState<EventTypeItem[]>(initialEventTypes);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Toggle active/inactive in-place
  const handleToggleActive = async (item: EventTypeItem) => {
    setLoadingId(item.id);
    setNotification(null);
    try {
      const res = await fetch(`/api/dashboard/events/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !item.isActive }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to update status.");
      }

      setEventTypes((prev) =>
        prev.map((e) => (e.id === item.id ? { ...e, isActive: !e.isActive } : e))
      );
      setNotification({
        type: "success",
        message: `Event '${item.title}' is now ${!item.isActive ? "active and visible to guests" : "inactive and hidden from booking"}.`,
      });
    } catch (err: unknown) {
      setNotification({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to toggle status.",
      });
    } finally {
      setLoadingId(null);
    }
  };

  // Delete or archive
  const handleDeleteOrArchive = async (item: EventTypeItem) => {
    const isArchive = item._count.bookings > 0;
    const confirmPrompt = isArchive
      ? `This event type has ${item._count.bookings} booking(s). It cannot be permanently deleted without breaking booking records. Would you like to deactivate it instead?`
      : `Are you sure you want to delete '${item.title}'?`;

    if (!window.confirm(confirmPrompt)) {
      return;
    }

    setLoadingId(item.id);
    setNotification(null);
    try {
      const res = await fetch(`/api/dashboard/events/${item.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to delete event type.");
      }

      if (data.action === "archived") {
        setEventTypes((prev) =>
          prev.map((e) => (e.id === item.id ? { ...e, isActive: false } : e))
        );
      } else {
        setEventTypes((prev) => prev.filter((e) => e.id !== item.id));
      }

      setNotification({
        type: "success",
        message: data.message,
      });
    } catch (err: unknown) {
      setNotification({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to delete event type.",
      });
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Event Types ({eventTypes.length})
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure meeting durations, pre/post buffer intervals, and public booking URLs.
          </p>
        </div>

        <Link
          href="/dashboard/events/new"
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors shadow-xs inline-flex items-center gap-1.5 self-start sm:self-auto"
        >
          <span>+ New Event Type</span>
        </Link>
      </div>

      {notification && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center justify-between border ${
            notification.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          <div className="flex items-center gap-2">
            <AlertCircleIcon className="w-4 h-4 shrink-0" />
            <span>{notification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-xs opacity-60 hover:opacity-100"
          >
            &times;
          </button>
        </div>
      )}

      {/* Grid of Event Cards */}
      {eventTypes.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center space-y-4">
          <VideoIcon className="w-10 h-10 text-slate-300 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900">No event types created yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Create your first appointment type to share your availability calendar with guests.
            </p>
          </div>
          <Link
            href="/dashboard/events/new"
            className="inline-block px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors shadow-xs"
          >
            Create Event Type
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {eventTypes.map((item) => (
            <div
              key={item.id}
              className={`bg-white rounded-3xl border transition-all p-6 shadow-xs flex flex-col justify-between space-y-4 ${
                item.isActive ? "border-slate-200/80" : "border-slate-200/40 opacity-75 bg-slate-50/40"
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h2 className="text-base font-bold text-slate-900">
                      {item.title}
                    </h2>
                    <div className="text-[11px] font-mono text-slate-400">
                      /book/{hostSlug}/{item.slug}
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      item.isActive
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                        : "bg-slate-100 text-slate-500 border border-slate-200"
                    }`}
                  >
                    {item.isActive ? "Active" : "Inactive"}
                  </span>
                </div>

                {item.description && (
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>
                )}

                {/* Duration & Buffer Details */}
                <div className="flex flex-wrap items-center gap-2 pt-2 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100 text-slate-700 font-semibold">
                    <ClockIcon className="w-3.5 h-3.5 text-slate-400" />
                    {item.duration} mins
                  </span>

                  {(item.bufferBefore > 0 || item.bufferAfter > 0) && (
                    <span className="inline-flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100 text-slate-500 text-[11px]">
                      Buffers: +{item.bufferBefore}m / +{item.bufferAfter}m
                    </span>
                  )}

                  {item.location && (
                    <span className="inline-flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100 text-slate-500 text-[11px]">
                      <VideoIcon className="w-3.5 h-3.5 text-slate-400" />
                      {item.location}
                    </span>
                  )}

                  <span className="text-[11px] text-slate-400 ml-auto">
                    {item._count.bookings} booking(s)
                  </span>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/book/${hostSlug}/${item.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                  >
                    Public Link &nearr;
                  </Link>
                  <span className="text-slate-300">&middot;</span>
                  <Link
                    href={`/dashboard/events/${item.id}`}
                    className="font-semibold text-slate-600 hover:text-slate-900 transition-colors"
                  >
                    Edit
                  </Link>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleActive(item)}
                    disabled={loadingId === item.id}
                    className="text-[11px] font-medium text-slate-500 hover:text-slate-800 transition-colors disabled:opacity-50"
                  >
                    {item.isActive ? "Deactivate" : "Activate"}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteOrArchive(item)}
                    disabled={loadingId === item.id}
                    className="text-[11px] font-medium text-rose-500 hover:text-rose-700 transition-colors disabled:opacity-50"
                  >
                    {loadingId === item.id ? (
                      <SpinnerIcon className="w-3.5 h-3.5 animate-spin" />
                    ) : item._count.bookings > 0 ? (
                      "Archive"
                    ) : (
                      "Delete"
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

