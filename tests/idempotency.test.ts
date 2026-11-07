import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { DateTime } from "luxon";
import { prisma } from "../src/lib/prisma";
import { createBooking } from "../src/lib/services/booking.service";
import { IdempotencyConflictError } from "../src/lib/errors";

describe("Idempotency Service", () => {
  let demoHostId: string;
  let meeting30Id: string;

  before(async () => {
    const host = await prisma.host.findUniqueOrThrow({
      where: { email: "alex.slotbook@example.com" },
      include: { eventTypes: true },
    });
    demoHostId = host.id;
    const m30 = host.eventTypes.find((e) => e.slug === "30-min-meeting");
    assert.ok(m30);
    meeting30Id = m30.id;
  });

  after(async () => {
    await prisma.notification.deleteMany();
    await prisma.idempotencyKey.deleteMany();
    await prisma.booking.deleteMany();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.notification.deleteMany();
    await prisma.idempotencyKey.deleteMany();
    await prisma.booking.deleteMany();
  });

  it("returns original booking response on identical replay with same Idempotency-Key", async () => {
    const key = "idem-key-test-001";
    const startAt = "2026-11-23T04:30:00.000Z";
    const mockNow = DateTime.fromISO("2026-11-01T00:00:00Z");

    const payload = {
      hostId: demoHostId,
      eventTypeId: meeting30Id,
      startAt,
      guestName: "Emma Watson",
      guestEmail: "emma@example.com",
    };

    // First call: initial creation
    const firstResult = await createBooking(payload, key, mockNow);
    assert.equal(firstResult.isIdempotentReplay, false);
    assert.ok(firstResult.booking.id);

    // Second call: idempotent retry with same key & identical payload
    const secondResult = await createBooking(payload, key, mockNow);
    assert.equal(secondResult.isIdempotentReplay, true);
    assert.equal(secondResult.booking.id, firstResult.booking.id);
    assert.equal(secondResult.booking.startAt, firstResult.booking.startAt);

    // Verify only ONE booking was created in database
    const totalBookings = await prisma.booking.count();
    assert.equal(totalBookings, 1);
  });

  it("throws IdempotencyConflictError when same key is used with different request parameters", async () => {
    const key = "idem-key-test-002";
    const startAt1 = "2026-11-23T04:30:00.000Z";
    const startAt2 = "2026-11-23T05:30:00.000Z";
    const mockNow = DateTime.fromISO("2026-11-01T00:00:00Z");

    const payload1 = {
      hostId: demoHostId,
      eventTypeId: meeting30Id,
      startAt: startAt1,
      guestName: "Emma Watson",
      guestEmail: "emma@example.com",
    };

    const payload2 = {
      hostId: demoHostId,
      eventTypeId: meeting30Id,
      startAt: startAt2, // different time slot!
      guestName: "Emma Watson",
      guestEmail: "emma@example.com",
    };

    await createBooking(payload1, key, mockNow);

    await assert.rejects(
      async () => {
        await createBooking(payload2, key, mockNow);
      },
      IdempotencyConflictError
    );
  });
});

