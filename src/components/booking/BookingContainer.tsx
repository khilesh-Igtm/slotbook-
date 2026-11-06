"use client";

import React, { useState, useEffect, useRef } from "react";
import { DateTime } from "luxon";
import { EventDetails } from "./EventDetails";
import { BookingCalendar } from "./BookingCalendar";
import { TimeSlotList } from "./TimeSlotList";
import { GuestDetailsForm } from "./GuestDetailsForm";
import { ConfirmationView } from "./ConfirmationView";
import { AvailableSlot } from "@/lib/services/availability.service";
import { BookingResponse } from "@/lib/services/booking.service";

export interface BookingContainerProps {
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
}

export function BookingContainer({ host, eventType }: BookingContainerProps) {
  // Initial date is today in the host's timezone
  const todayHost = DateTime.now().setZone(host.timezone).toFormat("yyyy-MM-dd");

  const [selectedDate, setSelectedDate] = useState<string>(todayHost);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState<boolean>(true);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [step, setStep] = useState<"select-slot" | "enter-details" | "confirmed">("select-slot");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<BookingResponse | null>(null);
  const [refreshCounter, setRefreshCounter] = useState<number>(0);

  // Idempotency key per booking attempt
  const idempotencyKeyRef = useRef<string>("");

  useEffect(() => {
    let ignore = false;

    fetch(`/api/hosts/${host.id}/event-types/${eventType.id}/availability?date=${selectedDate}`)
      .then((res) => res.json())
      .then((data) => {
        if (!ignore) {
          if (data.slots) {
            setSlots(data.slots);
          } else {
            setSlots([]);
            setErrorMessage(data.error?.message || "Failed to load availability for this date.");
          }
          setIsLoadingSlots(false);
        }
      })
      .catch(() => {
        if (!ignore) {
          setSlots([]);
          setErrorMessage("Network error while checking available times.");
          setIsLoadingSlots(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [selectedDate, host.id, eventType.id, refreshCounter]);

  const handleDateChange = (newDate: string) => {
    setIsLoadingSlots(true);
    setSelectedDate(newDate);
    setSelectedSlot(null);
  };

  const handleSelectSlot = (slot: AvailableSlot) => {
    setSelectedSlot(slot);
    setErrorMessage(null);
  };

  const handleProceedToDetails = () => {
    if (!selectedSlot) return;
    // Generate fresh idempotency key when entering details form
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = crypto.randomUUID();
    }
    setStep("enter-details");
    setErrorMessage(null);
  };

  const handleBackToSlots = () => {
    setStep("select-slot");
    setErrorMessage(null);
  };

  const handleConfirmBooking = async (formData: { guestName: string; guestEmail: string }) => {
    if (!selectedSlot) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKeyRef.current,
        },
        body: JSON.stringify({
          hostId: host.id,
          eventTypeId: eventType.id,
          startAt: selectedSlot.startAt,
          guestName: formData.guestName,
          guestEmail: formData.guestEmail,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setConfirmedBooking(data.booking);
        setStep("confirmed");
      } else if (res.status === 409) {
        // Slot conflict (already booked or buffer overlap)
        setErrorMessage(
          "This time slot was just booked by someone else. Please choose another available slot."
        );
        setStep("select-slot");
        setSelectedSlot(null);
        // Refresh availability
        setIsLoadingSlots(true);
        setRefreshCounter((prev) => prev + 1);
        // Reset idempotency key for next attempt
        idempotencyKeyRef.current = crypto.randomUUID();
      } else {
        setErrorMessage(data.error?.message || "An error occurred while confirming your booking.");
      }
    } catch {
      setErrorMessage("Network interruption. Please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBookAnother = () => {
    setConfirmedBooking(null);
    setSelectedSlot(null);
    setStep("select-slot");
    idempotencyKeyRef.current = crypto.randomUUID();
    setIsLoadingSlots(true);
    setRefreshCounter((prev) => prev + 1);
  };

  // If in confirmation step, render dedicated full-width confirmation view
  if (step === "confirmed" && confirmedBooking) {
    return (
      <div className="w-full">
        <ConfirmationView booking={confirmedBooking} onBookAnother={handleBookAnother} />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[560px]">
        {/* Left Column: Event Details & Host Info */}
        <div className="lg:col-span-4 p-6 sm:p-8 bg-slate-50/60 border-b lg:border-b-0 lg:border-r border-slate-100 flex flex-col justify-between">
          <EventDetails host={host} eventType={eventType} showBackLink={true} />
        </div>

        {/* Right Column: Interactive Booking Stage */}
        <div className="lg:col-span-8 p-6 sm:p-8 flex flex-col justify-center">
          {step === "enter-details" && selectedSlot ? (
            <GuestDetailsForm
              slot={selectedSlot}
              eventTitle={eventType.title}
              hostName={host.name}
              timezone={host.timezone}
              isSubmitting={isSubmitting}
              errorMessage={errorMessage}
              onBack={handleBackToSlots}
              onSubmit={handleConfirmBooking}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Calendar Date Picker */}
              <div className="pr-0 md:pr-4 md:border-r border-slate-100">
                <BookingCalendar
                  selectedDate={selectedDate}
                  onSelectDate={handleDateChange}
                  timezone={host.timezone}
                />
              </div>

              {/* Time Slots List */}
              <div className="pl-0 md:pl-2">
                <TimeSlotList
                  selectedDate={selectedDate}
                  slots={slots}
                  isLoading={isLoadingSlots}
                  selectedSlot={selectedSlot}
                  onSelectSlot={handleSelectSlot}
                  onProceedToDetails={handleProceedToDetails}
                  timezone={host.timezone}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
