"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { BookingStatus } from "@prisma/client";
import {
  CalendarIcon,
  ClockIcon,
  SpinnerIcon,
} from "@/components/booking/Icons";

export interface BookingListItem {
  id: string;
  guestName: string;
  guestEmail: string;
  status: BookingStatus;
  cancellationReason: string | null;
  startAtUtc: string;
  endAtUtc: string;
  createdAtUtc: string;
  formattedDate: string;
  formattedTime: string;
  eventType: {
    id: string;
    title: string;
    slug: string;
    duration: number;
    location: string | null;
  };
}

export interface BookingsListProps {
  hostTimezone: string;
}

export function BookingsList({ hostTimezone }: BookingsListProps) {
  const [bookings, setBookings] = useState<BookingListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"upcoming" | "recent" | "created">("upcoming");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [searchSubmitted, setSearchSubmitted] = useState("");

  useEffect(() => {
    let ignore = false;

    const query = new URLSearchParams();
    query.set("page", String(page));
    query.set("limit", "10");
    query.set("sortBy", sortBy);
    if (searchSubmitted.trim()) query.set("search", searchSubmitted.trim());
    if (status !== "ALL") query.set("status", status);
    if (dateFrom) query.set("dateFrom", dateFrom);
    if (dateTo) query.set("dateTo", dateTo);

    fetch(`/api/dashboard/bookings?${query.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (!ignore) {
          setBookings(data.bookings || []);
          setTotalCount(data.pagination?.total || 0);
          setTotalPages(data.pagination?.totalPages || 1);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!ignore) {
          setBookings([]);
          setIsLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [page, searchSubmitted, status, sortBy, dateFrom, dateTo]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setSearchSubmitted(search);
    setPage(1);
  };

  const handleResetFilters = () => {
    setIsLoading(true);
    setSearch("");
    setSearchSubmitted("");
    setStatus("ALL");
    setSortBy("upcoming");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Bookings & Appointments
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Browse and manage all appointments scheduled with you. All times in {hostTimezone}.
          </p>
        </div>

        <div className="text-xs text-slate-500 bg-white px-3.5 py-1.5 rounded-xl border border-slate-200 self-start sm:self-auto font-medium">
          {totalCount} total appointment(s)
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs space-y-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Search by guest name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="COMPLETED">Completed</option>
              <option value="PENDING">Pending</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as "upcoming" | "recent" | "created");
                setPage(1);
              }}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="upcoming">Upcoming First</option>
              <option value="recent">Past / Recent First</option>
              <option value="created">Recently Created</option>
            </select>

            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors"
            >
              Search
            </button>

            {(search || status !== "ALL" || dateFrom || dateTo) && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Reset
              </button>
            )}
          </div>
        </form>

        {/* Date Range Row */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
          <span>Date Filter:</span>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-mono text-slate-700 bg-white"
            />
            <span>to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-mono text-slate-700 bg-white"
            />
          </div>
        </div>
      </div>

      {/* Bookings Table / List */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-slate-400 space-y-2">
            <SpinnerIcon className="w-6 h-6 animate-spin mx-auto text-indigo-600" />
            <p className="text-xs">Loading bookings...</p>
          </div>
        ) : bookings.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-2">
            <CalendarIcon className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs">No bookings found matching your criteria.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {bookings.map((b) => (
              <Link
                key={b.id}
                href={`/dashboard/bookings/${b.id}`}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors group"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                      {b.guestName}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        b.status === "CONFIRMED"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                          : b.status === "CANCELLED"
                          ? "bg-rose-50 text-rose-700 border border-rose-200/60"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {b.status}
                    </span>
                  </div>

                  <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-700">{b.eventType.title}</span>
                    <span>&middot;</span>
                    <span>{b.guestEmail}</span>
                  </div>

                  {b.status === "CANCELLED" && b.cancellationReason && (
                    <div className="text-[11px] text-rose-600 italic">
                      Reason: {b.cancellationReason}
                    </div>
                  )}
                </div>

                <div className="sm:text-right space-y-1 shrink-0">
                  <div className="text-xs font-bold text-slate-900 flex sm:justify-end items-center gap-1.5">
                    <ClockIcon className="w-3.5 h-3.5 text-slate-400" />
                    <span>{b.formattedDate}</span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-500">
                    {b.formattedTime}
                  </div>
                  <div className="text-[11px] font-semibold text-indigo-600 group-hover:translate-x-0.5 transition-transform">
                    View Details &rarr;
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 font-medium"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 font-medium"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
