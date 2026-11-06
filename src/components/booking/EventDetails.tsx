import React from "react";
import Link from "next/link";
import { ClockIcon, GlobeIcon, VideoIcon, ArrowLeftIcon } from "./Icons";

export interface EventDetailsProps {
  host: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
  };
  eventType: {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    duration: number;
    location: string | null;
  };
  showBackLink?: boolean;
}

export function EventDetails({ host, eventType, showBackLink = true }: EventDetailsProps) {
  const initials = host.name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex flex-col space-y-6">
      {showBackLink && (
        <Link
          href={`/book/${host.slug}`}
          className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors w-fit gap-1.5"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          <span>All events</span>
        </Link>
      )}

      {/* Host Profile Header */}
      <div className="flex items-center space-x-3.5">
        <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white flex items-center justify-center font-semibold text-sm shadow-sm ring-2 ring-white">
          {initials || "SB"}
        </div>
        <div>
          <div className="text-xs font-semibold tracking-wider uppercase text-slate-400">Host</div>
          <div className="text-base font-semibold text-slate-900">{host.name}</div>
        </div>
      </div>

      {/* Event Details */}
      <div className="space-y-3">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {eventType.title}
        </h1>

        {eventType.description && (
          <p className="text-sm leading-relaxed text-slate-600">
            {eventType.description}
          </p>
        )}
      </div>

      {/* Meta Pills */}
      <div className="flex flex-col space-y-2.5 pt-2 border-t border-slate-100">
        <div className="flex items-center text-sm font-medium text-slate-700 gap-2.5">
          <ClockIcon className="w-4 h-4 text-slate-400 shrink-0" />
          <span>{eventType.duration} minutes</span>
        </div>

        {eventType.location && (
          <div className="flex items-center text-sm font-medium text-slate-700 gap-2.5">
            <VideoIcon className="w-4 h-4 text-slate-400 shrink-0" />
            <span>{eventType.location}</span>
          </div>
        )}

        <div className="flex items-center text-sm font-medium text-slate-600 gap-2.5">
          <GlobeIcon className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="truncate">{host.timezone}</span>
        </div>
      </div>
    </div>
  );
}

