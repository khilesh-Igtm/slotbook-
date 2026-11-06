import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { DateTime } from "luxon";
import { prisma } from "../src/lib/prisma";
import { createBooking, getBookingById } from "../src/lib/services/booking.service";
import { cancelBooking } from "../src/lib/services/cancellation.service";
import { BookingStatus, NotificationStatus, NotificationType } from "@prisma/client";
import {
  SlotUnavailableError,
  ValidationError,
  UnauthorizedError,
  InvalidStateTransitionError,
} from "../src/lib/errors";

describe("Booking Service & Cancellation", () => {
  let demoHostId: string;
  let meeting30Id: string;
  let inactiveEventId: string;

  before(async () => {
    const host = await prisma.host.findUniqueOrThrow({
      where: { email: "alex.slotbook@example.com" },
      include: { eventTypes: true },
    });

    demoHostId = host.id;
    const m30 = host.eventTypes.find((e) => e.slug === "30-min-meeting");
    assert.ok(m30);
    meeting30Id = m30.id;

    // Create an inactive event type to test validation
    const inactive = await prisma.eventType.create({
      data: {
        hostId: demoHostId,
        title: "Inactive Service",
        slug: "inactive-service",
        duration: 30,
        isActive: false,
      },
    });
    inactiveEventId = inactive.id;
  });

  after(async () => {
    await prisma.eventType.delete({ where: { id: inactiveEventId } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up non-seed bookings before each test
    await prisma.notification.deleteMany();
    await prisma.idempotencyKey.deleteMany();
    await prisma.booking.deleteMany();
  });

  it("creates a booking with accurate bounds, buffer calculations, and notifications", async () => {
    // 2026-11-23 is Monday. 10:00 in Asia/Kolkata is 04:30 UTC.
    const startAtIso = "2026-11-23T04:30:00.000Z";
    const mockNow = DateTime.fromISO("2026-11-01T00:00:00Z");

    const { booking, isIdempotentReplay } = await createBooking(
      {
        hostId: demoHostId,
        eventTypeId: meeting30Id,
        startAt: startAtIso,
        guestName: "John Doe",
        guestEmail: "john@example.com",
      },
      null,
      mockNow
    );

    assert.equal(isIdempotentReplay, false);
    assert.equal(booking.status, BookingStatus.CONFIRMED);
    assert.equal(booking.guestName, "John Doe");
    assert.equal(booking.guestEmail, "john@example.com");
    assert.equal(booking.startAt, startAtIso);
    // 30 min duration => endAt is 05:00 UTC
    assert.equal(booking.endAt, "2026-11-23T05:00:00.000Z");
    // bufferBefore = 5m => reservedStartAt is 04:25 UTC
    assert.equal(booking.reservedStartAt, "2026-11-23T04:25:00.000Z");
    // bufferAfter = 5m => reservedEndAt is 05:05 UTC
    assert.equal(booking.reservedEndAt, "2026-11-23T05:05:00.000Z");
    assert.ok(booking.cancellationKey, "Must generate secure cancellation key");

    // Verify notifications were created
    const notifications = await prisma.notification.findMany({
      where: { bookingId: booking.id },
      orderBy: { type: "asc" },
    });

    assert.equal(notifications.length, 2);
    const confirmation = notifications.find((n) => n.type === NotificationType.CONFIRMATION);
    const reminder = notifications.find((n) => n.type === NotificationType.REMINDER);

    assert.ok(confirmation);
    assert.equal(confirmation.status, NotificationStatus.SENT);
    assert.ok(reminder);
    assert.equal(reminder.status, NotificationStatus.SCHEDULED);

    // Verify getBookingById retrieval
    const fetched = await getBookingById(booking.id);
    assert.equal(fetched.id, booking.id);
  });

  it("rejects booking attempts in the past", async () => {
    const pastSlot = "2026-11-20T04:30:00.000Z";
    const nowAfterSlot = DateTime.fromISO("2026-11-20T06:00:00Z");

    await assert.rejects(
      async () => {
        await createBooking(
          {
            hostId: demoHostId,
            eventTypeId: meeting30Id,
            startAt: pastSlot,
            guestName: "Time Traveler",
            guestEmail: "past@example.com",
          },
          null,
          nowAfterSlot
        );
      },
      SlotUnavailableError
    );
  });

  it("rejects booking attempts for inactive event types", async () => {
    const futureSlot = "2026-11-23T04:30:00.000Z";
    const mockNow = DateTime.fromISO("2026-11-01T00:00:00Z");

    await assert.rejects(
      async () => {
        await createBooking(
          {
            hostId: demoHostId,
            eventTypeId: inactiveEventId,
            startAt: futureSlot,
            guestName: "Jane Doe",
            guestEmail: "jane@example.com",
          },
          null,
          mockNow
        );
      },
      ValidationError
    );
  });

  it("rejects booking attempts outside host availability schedule", async () => {
    // 02:00 UTC is 07:30 local time in Asia/Kolkata (host starts at 09:00 local)
    const earlySlot = "2026-11-23T02:00:00.000Z";
    const mockNow = DateTime.fromISO("2026-11-01T00:00:00Z");

    await assert.rejects(
      async () => {
        await createBooking(
          {
            hostId: demoHostId,
            eventTypeId: meeting30Id,
            startAt: earlySlot,
            guestName: "Early Bird",
            guestEmail: "early@example.com",
          },
          null,
          mockNow
        );
      },
      SlotUnavailableError
    );
  });

  it("successfully cancels a booking with authorization and releases the occupied slot", async () => {
    const startAtIso = "2026-11-24T04:30:00.000Z"; // 10:00 local
    const mockNow = DateTime.fromISO("2026-11-01T00:00:00Z");

    // 1. Create booking
    const { booking } = await createBooking(
      {
        hostId: demoHostId,
        eventTypeId: meeting30Id,
        startAt: startAtIso,
        guestName: "Alice",
        guestEmail: "alice@example.com",
      },
      null,
      mockNow
    );

    // 2. Cancel with valid key
    const cancelled = await cancelBooking(booking.id, {
      cancellationKey: booking.cancellationKey,
      reason: "Conflict with personal schedule",
    });

    assert.equal(cancelled.status, BookingStatus.CANCELLED);

    // Verify notifications: reminder cancelled, cancellation notification sent
    const reminder = await prisma.notification.findFirst({
      where: { bookingId: booking.id, type: NotificationType.REMINDER },
    });
    assert.equal(reminder?.status, NotificationStatus.CANCELLED);

    const cancellationNotif = await prisma.notification.findFirst({
      where: { bookingId: booking.id, type: NotificationType.CANCELLATION },
    });
    assert.ok(cancellationNotif);
    assert.equal(cancellationNotif.status, NotificationStatus.SENT);

    // 3. Confirm slot is released: Another guest can now book the exact same slot!
    const { booking: rebooked } = await createBooking(
      {
        hostId: demoHostId,
        eventTypeId: meeting30Id,
        startAt: startAtIso,
        guestName: "Bob",
        guestEmail: "bob@example.com",
      },
      null,
      mockNow
    );

    assert.equal(rebooked.status, BookingStatus.CONFIRMED);
    assert.notEqual(rebooked.id, booking.id);
  });

  it("rejects unauthorized cancellation attempts with invalid key", async () => {
    const startAtIso = "2026-11-25T04:30:00.000Z";
    const mockNow = DateTime.fromISO("2026-11-01T00:00:00Z");

    const { booking } = await createBooking(
      {
        hostId: demoHostId,
        eventTypeId: meeting30Id,
        startAt: startAtIso,
        guestName: "Charlie",
        guestEmail: "charlie@example.com",
      },
      null,
      mockNow
    );

    await assert.rejects(
      async () => {
        await cancelBooking(booking.id, {
          cancellationKey: "wrong-cancellation-key-12345",
        });
      },
      UnauthorizedError
    );
  });

  it("rejects duplicate cancellation attempts with InvalidStateTransitionError", async () => {
    const startAtIso = "2026-11-26T04:30:00.000Z";
    const mockNow = DateTime.fromISO("2026-11-01T00:00:00Z");

    const { booking } = await createBooking(
      {
        hostId: demoHostId,
        eventTypeId: meeting30Id,
        startAt: startAtIso,
        guestName: "Dana",
        guestEmail: "dana@example.com",
      },
      null,
      mockNow
    );

    // First cancellation succeeds
    await cancelBooking(booking.id, { cancellationKey: booking.cancellationKey });

    // Second cancellation fails
    await assert.rejects(
      async () => {
        await cancelBooking(booking.id, { cancellationKey: booking.cancellationKey });
      },
      InvalidStateTransitionError
    );
  });
});
