import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { DateTime } from "luxon";
import { prisma } from "../src/lib/prisma";
import { createBooking } from "../src/lib/services/booking.service";
import { SlotConflictError } from "../src/lib/errors";
import { DayOfWeek } from "@prisma/client";

describe("PostgreSQL Concurrency & GiST Exclusion Integration", () => {
  let demoHostId: string;
  let meeting30Id: string;
  let secondHostId: string;
  let secondEventId: string;

  before(async () => {
    // 1. Load primary demo host
    const host = await prisma.host.findUniqueOrThrow({
      where: { email: "alex.slotbook@example.com" },
      include: { eventTypes: true },
    });
    demoHostId = host.id;
    const m30 = host.eventTypes.find((e) => e.slug === "30-min-meeting");
    assert.ok(m30);
    meeting30Id = m30.id;

    // 2. Create a second independent host to test parallel independent booking concurrency
    const secondHost = await prisma.host.create({
      data: {
        name: "Second Host",
        email: "second-host@example.com",
        timezone: "Asia/Kolkata",
      },
    });
    secondHostId = secondHost.id;

    const secondEvent = await prisma.eventType.create({
      data: {
        hostId: secondHost.id,
        title: "Second Event",
        slug: "second-event",
        duration: 30,
      },
    });
    secondEventId = secondEvent.id;

    await prisma.availability.create({
      data: {
        hostId: secondHost.id,
        dayOfWeek: DayOfWeek.MONDAY,
        startTime: new Date("1970-01-01T09:00:00.000Z"),
        endTime: new Date("1970-01-01T17:00:00.000Z"),
      },
    });
  });

  after(async () => {
    await prisma.availability.deleteMany({ where: { hostId: secondHostId } });
    await prisma.eventType.deleteMany({ where: { hostId: secondHostId } });
    await prisma.host.delete({ where: { id: secondHostId } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.notification.deleteMany();
    await prisma.idempotencyKey.deleteMany();
    await prisma.booking.deleteMany();
  });

  it("handles concurrent requests for the EXACT SAME slot: exactly one succeeds and one fails with SlotConflictError", async () => {
    const slotStart = "2026-11-23T04:30:00.000Z"; // 10:00 local time
    const mockNow = DateTime.fromISO("2026-11-01T00:00:00Z");

    const reqA = createBooking(
      {
        hostId: demoHostId,
        eventTypeId: meeting30Id,
        startAt: slotStart,
        guestName: "Guest Alpha",
        guestEmail: "alpha@example.com",
      },
      null,
      mockNow
    );

    const reqB = createBooking(
      {
        hostId: demoHostId,
        eventTypeId: meeting30Id,
        startAt: slotStart,
        guestName: "Guest Beta",
        guestEmail: "beta@example.com",
      },
      null,
      mockNow
    );

    const results = await Promise.allSettled([reqA, reqB]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    assert.equal(fulfilled.length, 1, "Exactly one booking must succeed");
    assert.equal(rejected.length, 1, "Exactly one booking must be rejected");

    const error = (rejected[0] as PromiseRejectedResult).reason;
    assert.ok(
      error instanceof SlotConflictError,
      `Expected SlotConflictError, got ${error.constructor.name}: ${error.message}`
    );

    // Confirm database has exactly 1 booking
    const count = await prisma.booking.count({ where: { hostId: demoHostId } });
    assert.equal(count, 1);
  });

  it("handles concurrent requests for OVERLAPPING buffer-adjusted intervals: exactly one succeeds", async () => {
    // 30 min meeting with 5m buffer before + 5m buffer after
    // Slot 1: 10:00 local (04:30 UTC) => reserved [04:25, 05:05)
    // Slot 2: 10:15 local (04:45 UTC) => reserved [04:40, 05:20)
    // Overlap: [04:40, 05:05) overlaps!
    const slot1 = "2026-11-23T04:30:00.000Z";
    const slot2 = "2026-11-23T04:45:00.000Z";
    const mockNow = DateTime.fromISO("2026-11-01T00:00:00Z");

    const req1 = createBooking(
      {
        hostId: demoHostId,
        eventTypeId: meeting30Id,
        startAt: slot1,
        guestName: "Guest 1",
        guestEmail: "g1@example.com",
      },
      null,
      mockNow
    );

    const req2 = createBooking(
      {
        hostId: demoHostId,
        eventTypeId: meeting30Id,
        startAt: slot2,
        guestName: "Guest 2",
        guestEmail: "g2@example.com",
      },
      null,
      mockNow
    );

    const results = await Promise.allSettled([req1, req2]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    assert.equal(fulfilled.length, 1, "Exactly one overlapping booking must succeed");
    assert.equal(rejected.length, 1, "Exactly one overlapping booking must fail");

    const error = (rejected[0] as PromiseRejectedResult).reason;
    assert.ok(
      error instanceof SlotConflictError,
      `Expected SlotConflictError for overlap, got: ${error.message}`
    );
  });

  it("allows simultaneous concurrent bookings for INDEPENDENT hosts at the identical timestamp", async () => {
    const slotStart = "2026-11-23T04:30:00.000Z";
    const mockNow = DateTime.fromISO("2026-11-01T00:00:00Z");

    // Guest A books Host 1, Guest B books Host 2 simultaneously
    const reqHost1 = createBooking(
      {
        hostId: demoHostId,
        eventTypeId: meeting30Id,
        startAt: slotStart,
        guestName: "Guest for Host 1",
        guestEmail: "g-host1@example.com",
      },
      null,
      mockNow
    );

    const reqHost2 = createBooking(
      {
        hostId: secondHostId,
        eventTypeId: secondEventId,
        startAt: slotStart,
        guestName: "Guest for Host 2",
        guestEmail: "g-host2@example.com",
      },
      null,
      mockNow
    );

    const [res1, res2] = await Promise.all([reqHost1, reqHost2]);

    assert.ok(res1.booking.id);
    assert.ok(res2.booking.id);
    assert.equal(res1.booking.hostId, demoHostId);
    assert.equal(res2.booking.hostId, secondHostId);

    const total = await prisma.booking.count();
    assert.equal(total, 2, "Both independent host bookings must succeed");
  });

  it("enforces PostgreSQL GiST exclusion constraint (no_overlapping_reserved_bookings) at database engine level", async () => {
    // 1. Insert a booking normally
    const startAt = "2026-11-23T06:00:00.000Z";
    const mockNow = DateTime.fromISO("2026-11-01T00:00:00Z");

    const { booking } = await createBooking(
      {
        hostId: demoHostId,
        eventTypeId: meeting30Id,
        startAt,
        guestName: "Legit Guest",
        guestEmail: "legit@example.com",
      },
      null,
      mockNow
    );

    assert.ok(booking.id);

    // 2. Attempt a raw SQL insert bypassing application row locks that overlaps reservedStartAt/reservedEndAt
    // reserved interval is 05:55 to 06:35
    await assert.rejects(
      async () => {
        await prisma.$executeRawUnsafe(`
          INSERT INTO "Booking" (
            "id", "hostId", "eventTypeId", "guestName", "guestEmail",
            "startAt", "endAt", "reservedStartAt", "reservedEndAt",
            "status", "cancellationKey", "createdAt", "updatedAt"
          ) VALUES (
            'ffffffff-ffff-ffff-ffff-ffffffffffff',
            '${demoHostId}',
            '${meeting30Id}',
            'Rogue SQL Inserter',
            'rogue@example.com',
            '2026-11-23 06:15:00+00',
            '2026-11-23 06:45:00+00',
            '2026-11-23 06:10:00+00',
            '2026-11-23 06:50:00+00',
            'CONFIRMED',
            'cancellation-key-rogue-12345',
            NOW(),
            NOW()
          );
        `);
      },
      (err: unknown) => {
        // Must fail with PostgreSQL exclusion_violation (code 23P01)
        const errorObj = err as { message?: string; code?: string };
        const msg = String(errorObj?.message || "");
        return (
          msg.includes("no_overlapping_reserved_bookings") ||
          msg.includes("exclusion_violation") ||
          errorObj?.code === "23P01"
        );
      }
    );
  });
});
