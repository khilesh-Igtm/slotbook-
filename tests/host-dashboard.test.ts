import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { DayOfWeek, BookingStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { encryptSession } from "../src/lib/auth/session";
import { loginHost } from "../src/lib/services/auth.service";
import {
  listEventTypesForHost,
  createEventTypeForHost,
  updateEventTypeForHost,
  deleteOrArchiveEventTypeForHost,
} from "../src/lib/services/event-type.service";
import {
  getHostWeeklyAvailability,
  updateHostWeeklyAvailability,
} from "../src/lib/services/host-availability.service";
import {
  listDateOverridesForHost,
  createDateOverrideForHost,
  deleteDateOverrideForHost,
} from "../src/lib/services/date-override.service";
import {
  listBookingsForHost,
  getBookingDetailsForHost,
  cancelBookingAsHost,
} from "../src/lib/services/host-booking.service";
import { getAvailableSlots } from "../src/lib/services/availability.service";
import { createBooking } from "../src/lib/services/booking.service";
import { UnauthorizedError, ValidationError, InvalidStateTransitionError } from "../src/lib/errors";

describe("Phase 4: Host Dashboard & Scheduling Management", () => {
  let primaryHostId: string;
  let primaryHostEmail: string;
  let secondaryHostId: string;
  let secondaryEventId: string;
  let meeting30Id: string;

  const testPassword = "HostSecurePass2026!";

  before(async () => {
    // 1. Ensure primary host has passwordHash
    const passwordHash = await bcrypt.hash(testPassword, 10);
    const host = await prisma.host.upsert({
      where: { email: "alex.slotbook@example.com" },
      update: { passwordHash },
      create: {
        name: "Alex Sharma",
        email: "alex.slotbook@example.com",
        slug: "alex-sharma",
        timezone: "Asia/Kolkata",
        passwordHash,
      },
    });
    primaryHostId = host.id;
    primaryHostEmail = host.email;

    // 2. Load 30-min meeting event type
    const eventType = await prisma.eventType.findUniqueOrThrow({
      where: {
        hostId_slug: {
          hostId: primaryHostId,
          slug: "30-min-meeting",
        },
      },
    });
    meeting30Id = eventType.id;

    // 3. Create a secondary independent host for cross-host authorization testing
    const secondaryHash = await bcrypt.hash("OtherHostPass123!", 10);
    const secondaryHost = await prisma.host.upsert({
      where: { email: "secondary.host@example.com" },
      update: { passwordHash: secondaryHash },
      create: {
        name: "Secondary Host",
        email: "secondary.host@example.com",
        slug: "secondary-host",
        timezone: "America/New_York",
        passwordHash: secondaryHash,
      },
    });
    secondaryHostId = secondaryHost.id;

    // 4. Create an event type for secondaryHost to support isolated availability testing
    const secondaryEvent = await prisma.eventType.create({
      data: {
        hostId: secondaryHostId,
        title: "Secondary 30-Min Call",
        slug: "secondary-30-min",
        duration: 30,
        bufferBefore: 0,
        bufferAfter: 0,
        isActive: true,
      },
    });
    secondaryEventId = secondaryEvent.id;
  });

  after(async () => {
    // 1. Clean up test records created for secondary host
    await prisma.booking.deleteMany({ where: { hostId: secondaryHostId } });
    await prisma.eventType.deleteMany({ where: { hostId: secondaryHostId } });
    await prisma.dateOverride.deleteMany({ where: { hostId: secondaryHostId } });
    await prisma.availability.deleteMany({ where: { hostId: secondaryHostId } });
    await prisma.host.deleteMany({ where: { id: secondaryHostId } });

    // 2. Clean up test records created for primary host during testing
    await prisma.notification.deleteMany({ where: { booking: { guestEmail: "hostaction@example.com" } } });
    await prisma.booking.deleteMany({ where: { guestEmail: "hostaction@example.com" } });
    await prisma.dateOverride.deleteMany({
      where: {
        hostId: primaryHostId,
        date: new Date("2026-11-30T00:00:00.000Z"),
      },
    });

    // 3. Restore standard Monday-Friday 09:00-17:00 schedule for primaryHostId
    await updateHostWeeklyAvailability(primaryHostId, {
      schedules: [
        { dayOfWeek: DayOfWeek.MONDAY, isEnabled: true, windows: [{ startTime: "09:00", endTime: "17:00" }] },
        { dayOfWeek: DayOfWeek.TUESDAY, isEnabled: true, windows: [{ startTime: "09:00", endTime: "17:00" }] },
        { dayOfWeek: DayOfWeek.WEDNESDAY, isEnabled: true, windows: [{ startTime: "09:00", endTime: "17:00" }] },
        { dayOfWeek: DayOfWeek.THURSDAY, isEnabled: true, windows: [{ startTime: "09:00", endTime: "17:00" }] },
        { dayOfWeek: DayOfWeek.FRIDAY, isEnabled: true, windows: [{ startTime: "09:00", endTime: "17:00" }] },
        { dayOfWeek: DayOfWeek.SATURDAY, isEnabled: false, windows: [] },
        { dayOfWeek: DayOfWeek.SUNDAY, isEnabled: false, windows: [] },
      ],
    });
  });

  // ==========================================
  // 1. Host Authentication & Security Tests
  // ==========================================
  describe("1. Host Authentication & Security", () => {
    it("successfully authenticates with valid email and password", async () => {
      const result = await loginHost({
        email: primaryHostEmail,
        password: testPassword,
      });

      assert.equal(result.id, primaryHostId);
      assert.equal(result.email, primaryHostEmail);
      assert.equal(result.slug, "alex-sharma");
      assert.equal("passwordHash" in result, false, "passwordHash must never be exposed");
    });

    it("rejects login attempt with invalid password", async () => {
      await assert.rejects(
        async () => {
          await loginHost({
            email: primaryHostEmail,
            password: "WrongPassword123!",
          });
        },
        UnauthorizedError,
        "Should throw UnauthorizedError for incorrect password"
      );
    });

    it("rejects login attempt for non-existent email", async () => {
      await assert.rejects(
        async () => {
          await loginHost({
            email: "doesnotexist@example.com",
            password: "AnyPassword123!",
          });
        },
        UnauthorizedError,
        "Should throw UnauthorizedError for non-existent email"
      );
    });

    it("generates a valid signed JWT session token with HS256", async () => {
      const token = await encryptSession({
        hostId: primaryHostId,
        email: primaryHostEmail,
        name: "Alex Sharma",
        slug: "alex-sharma",
        timezone: "Asia/Kolkata",
      });

      assert.ok(token);
      assert.equal(typeof token, "string");
      assert.equal(token.split(".").length, 3, "JWT must consist of three parts");
    });
  });

  // ==========================================
  // 2. Event Type Management Tests
  // ==========================================
  describe("2. Event Type Management", () => {
    let createdEventId: string;

    it("lists all event types for the host", async () => {
      const eventTypes = await listEventTypesForHost(primaryHostId);
      assert.ok(Array.isArray(eventTypes));
      assert.ok(eventTypes.length >= 2);
      assert.ok(eventTypes.some((e) => e.slug === "30-min-meeting"));
    });

    it("creates a new event type with buffers and custom duration", async () => {
      const newEvent = await createEventTypeForHost(primaryHostId, {
        title: "Architecture Strategy Review",
        slug: "arch-strategy-review",
        description: "Deep dive system design and scale consultation.",
        duration: 45,
        bufferBefore: 15,
        bufferAfter: 15,
        location: "Zoom Video Call",
        isActive: true,
      });

      createdEventId = newEvent.id;
      assert.ok(newEvent.id);
      assert.equal(newEvent.title, "Architecture Strategy Review");
      assert.equal(newEvent.duration, 45);
      assert.equal(newEvent.bufferBefore, 15);
      assert.equal(newEvent.bufferAfter, 15);
    });

    it("rejects duplicate event slug within the same host", async () => {
      await assert.rejects(
        async () => {
          await createEventTypeForHost(primaryHostId, {
            title: "Duplicate Slug Meeting",
            slug: "arch-strategy-review",
            description: null,
            duration: 30,
            bufferBefore: 0,
            bufferAfter: 0,
            location: null,
            isActive: true,
          });
        },
        ValidationError,
        "Should reject duplicate slug for the same host"
      );
    });

    it("updates existing event type duration and buffer intervals", async () => {
      const updated = await updateEventTypeForHost(primaryHostId, createdEventId, {
        title: "Updated Architecture Review",
        duration: 50,
        bufferBefore: 10,
      });

      assert.equal(updated.title, "Updated Architecture Review");
      assert.equal(updated.duration, 50);
      assert.equal(updated.bufferBefore, 10);
    });

    it("prevents host from modifying another host's event type (cross-host security)", async () => {
      await assert.rejects(
        async () => {
          await updateEventTypeForHost(secondaryHostId, createdEventId, {
            title: "Hacked Title",
          });
        },
        UnauthorizedError,
        "Host must not be allowed to modify an event type owned by another host"
      );
    });

    it("safely deletes event type when no bookings exist", async () => {
      const res = await deleteOrArchiveEventTypeForHost(primaryHostId, createdEventId);
      assert.equal(res.action, "deleted");
    });

    it("archives (deactivates) event type instead of deleting when bookings exist", async () => {
      // 30-min meeting has bookings; deleting it should archive it
      const res = await deleteOrArchiveEventTypeForHost(primaryHostId, meeting30Id);
      assert.equal(res.action, "archived");
      assert.equal(res.eventType?.isActive, false);

      // Restore active status
      await prisma.eventType.update({
        where: { id: meeting30Id },
        data: { isActive: true },
      });
    });
  });

  // ==========================================
  // 3. Weekly Availability Management Tests
  // ==========================================
  describe("3. Weekly Availability & Multi-Window Schedules", () => {
    it("retrieves weekly availability for all 7 days", async () => {
      const data = await getHostWeeklyAvailability(primaryHostId);
      assert.equal(data.schedules.length, 7);
      const monday = data.schedules.find((s) => s.dayOfWeek === DayOfWeek.MONDAY);
      assert.ok(monday);
      assert.equal(monday.isEnabled, true);
    });

    it("updates weekly schedule supporting multiple windows on the same weekday", async () => {
      // Configure Monday with morning window (09:00 - 12:00) and afternoon window (13:00 - 17:00) on secondaryHost
      const updated = await updateHostWeeklyAvailability(secondaryHostId, {
        schedules: [
          {
            dayOfWeek: DayOfWeek.MONDAY,
            isEnabled: true,
            windows: [
              { startTime: "09:00", endTime: "12:00" },
              { startTime: "13:00", endTime: "17:00" },
            ],
          },
          {
            dayOfWeek: DayOfWeek.TUESDAY,
            isEnabled: true,
            windows: [{ startTime: "09:00", endTime: "17:00" }],
          },
          {
            dayOfWeek: DayOfWeek.WEDNESDAY,
            isEnabled: true,
            windows: [{ startTime: "09:00", endTime: "17:00" }],
          },
          {
            dayOfWeek: DayOfWeek.THURSDAY,
            isEnabled: true,
            windows: [{ startTime: "09:00", endTime: "17:00" }],
          },
          {
            dayOfWeek: DayOfWeek.FRIDAY,
            isEnabled: true,
            windows: [{ startTime: "09:00", endTime: "17:00" }],
          },
          {
            dayOfWeek: DayOfWeek.SATURDAY,
            isEnabled: false,
            windows: [],
          },
          {
            dayOfWeek: DayOfWeek.SUNDAY,
            isEnabled: false,
            windows: [],
          },
        ],
      });

      const monday = updated.schedules.find((s) => s.dayOfWeek === DayOfWeek.MONDAY);
      assert.ok(monday);
      assert.equal(monday.windows.length, 2);
      assert.equal(monday.windows[0].startTime, "09:00");
      assert.equal(monday.windows[0].endTime, "12:00");
      assert.equal(monday.windows[1].startTime, "13:00");
      assert.equal(monday.windows[1].endTime, "17:00");

      // Verify that public slot generation strictly respects the multi-window lunch break on Monday
      // 2026-11-23 is a Monday
      const { slots } = await getAvailableSlots({
        hostId: secondaryHostId,
        eventTypeId: secondaryEventId,
        date: "2026-11-23",
      });

      // Assert slots exist in morning and afternoon, and NO slots are generated during lunch (12:00 - 13:00)
      const lunchSlots = slots.filter((s) => s.localStart >= "12:00" && s.localStart < "13:00");
      assert.equal(lunchSlots.length, 0, "No slots should be generated during lunch break (12:00 - 13:00)");
      assert.ok(slots.some((s) => s.localStart === "09:00"));
      assert.ok(slots.some((s) => s.localStart === "13:00"));
    });
  });

  // ==========================================
  // 4. Date Exceptions & Special Days Tests
  // ==========================================
  describe("4. Date Exceptions & Special Days", () => {
    let overrideId: string;

    it("lists all date overrides for the host", async () => {
      const overrides = await listDateOverridesForHost(primaryHostId);
      assert.ok(Array.isArray(overrides));
      assert.ok(overrides.length >= 1);
    });

    it("creates a full-day unavailable date exception (blocking slots)", async () => {
      const res = await createDateOverrideForHost(primaryHostId, "Asia/Kolkata", {
        date: "2026-11-30",
        isUnavailable: true,
        force: false,
      });

      assert.equal(res.requiresConfirmation, false);
      assert.ok(res.override);
      overrideId = res.override.id;

      // Verify public slot generation returns 0 slots for this blocked day
      const { slots } = await getAvailableSlots({
        hostId: primaryHostId,
        eventTypeId: meeting30Id,
        date: "2026-11-30",
      });
      assert.equal(slots.length, 0, "Full day exception must return 0 available slots");
    });

    it("removes a date exception and restores weekly availability", async () => {
      const res = await deleteDateOverrideForHost(primaryHostId, overrideId);
      assert.equal(res.success, true);

      // Verify slots are restored for 2026-11-30 (Monday)
      const { slots } = await getAvailableSlots({
        hostId: primaryHostId,
        eventTypeId: meeting30Id,
        date: "2026-11-30",
      });
      assert.ok(slots.length > 0, "Slots must be restored after exception removal");
    });

    it("warns host when adding exception conflicts with existing confirmed booking", async () => {
      // 1. Create a booking on 2026-12-07 (Monday at 10:00)
      const bookingRes = await createBooking({
        hostId: primaryHostId,
        eventTypeId: meeting30Id,
        startAt: "2026-12-07T04:30:00.000Z", // 10:00 IST
        guestName: "Exception Conflict Guest",
        guestEmail: "conflict.guest@example.com",
      });

      assert.ok(bookingRes.booking.id);

      // 2. Try to add a full-day exception on 2026-12-07 without force
      const checkRes = await createDateOverrideForHost(primaryHostId, "Asia/Kolkata", {
        date: "2026-12-07",
        isUnavailable: true,
        force: false,
      });

      assert.equal(checkRes.requiresConfirmation, true);
      assert.ok(checkRes.conflicts && checkRes.conflicts.length > 0);
      assert.equal(checkRes.conflicts[0].guestName, "Exception Conflict Guest");

      // Verify that confirmed booking was NOT cancelled or modified
      const bookingAfter = await prisma.booking.findUnique({
        where: { id: bookingRes.booking.id },
      });
      assert.equal(bookingAfter?.status, BookingStatus.CONFIRMED);

      // Clean up test booking
      await prisma.notification.deleteMany({ where: { bookingId: bookingRes.booking.id } });
      await prisma.booking.delete({ where: { id: bookingRes.booking.id } });
    });
  });

  // ==========================================
  // 5. Booking Management & Host Actions Tests
  // ==========================================
  describe("5. Booking Management & Host Actions", () => {
    let testBookingId: string;

    it("creates a test booking and lists it under host bookings", async () => {
      const bookingRes = await createBooking({
        hostId: primaryHostId,
        eventTypeId: meeting30Id,
        startAt: "2026-12-14T04:30:00.000Z", // 10:00 IST
        guestName: "Host Action Attendee",
        guestEmail: "hostaction@example.com",
      });

      testBookingId = bookingRes.booking.id;

      const listRes = await listBookingsForHost({
        hostId: primaryHostId,
        hostTimezone: "Asia/Kolkata",
        search: "Host Action Attendee",
      });

      assert.ok(listRes.bookings.length > 0);
      const found = listRes.bookings.find((b) => b.id === testBookingId);
      assert.ok(found);
      assert.equal(found.guestName, "Host Action Attendee");
      assert.equal("cancellationKey" in found, false, "cancellationKey must NEVER be leaked in list view");
    });

    it("retrieves full booking details for host without leaking cancellationKey", async () => {
      const details = await getBookingDetailsForHost(primaryHostId, testBookingId, "Asia/Kolkata");
      assert.equal(details.id, testBookingId);
      assert.equal(details.guestName, "Host Action Attendee");
      assert.equal("cancellationKey" in details, false, "cancellationKey must NEVER be leaked in details view");
      assert.ok(details.notifications.length > 0);
    });

    it("prevents host from viewing another host's booking", async () => {
      await assert.rejects(
        async () => {
          await getBookingDetailsForHost(secondaryHostId, testBookingId, "America/New_York");
        },
        UnauthorizedError,
        "Cross-host booking access must be rejected"
      );
    });

    it("allows host to cancel confirmed booking and releases time slot", async () => {
      const cancelRes = await cancelBookingAsHost(
        primaryHostId,
        testBookingId,
        "Host had an urgent conflicting schedule."
      );

      assert.equal(cancelRes.success, true);
      assert.equal(cancelRes.booking.status, BookingStatus.CANCELLED);
      assert.equal(cancelRes.booking.cancellationReason, "Host had an urgent conflicting schedule.");

      // Check in database that reminders were cancelled and cancellation notification created
      const reminder = await prisma.notification.findFirst({
        where: { bookingId: testBookingId, type: "REMINDER" },
      });
      assert.equal(reminder?.status, "CANCELLED");

      const cancellationNotif = await prisma.notification.findFirst({
        where: { bookingId: testBookingId, type: "CANCELLATION" },
      });
      assert.ok(cancellationNotif);
      assert.equal(cancellationNotif.status, "PENDING");

      // Verify slot is immediately available again on 2026-12-14
      const { slots } = await getAvailableSlots({
        hostId: primaryHostId,
        eventTypeId: meeting30Id,
        date: "2026-12-14",
      });

      const releasedSlot = slots.find((s) => s.localStart === "10:00");
      assert.ok(releasedSlot, "The 10:00 time slot must be released back to availability after cancellation");
    });

    it("rejects attempt to cancel an already cancelled booking", async () => {
      await assert.rejects(
        async () => {
          await cancelBookingAsHost(primaryHostId, testBookingId, "Duplicate cancel attempt");
        },
        InvalidStateTransitionError,
        "Should reject invalid state transition on already cancelled booking"
      );
    });
  });
});
