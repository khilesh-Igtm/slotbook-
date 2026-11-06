import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { DateTime } from "luxon";
import { prisma } from "../src/lib/prisma";
import { getAvailableSlots } from "../src/lib/services/availability.service";
import { BookingStatus, DayOfWeek } from "@prisma/client";

describe("Availability Engine & Slot Generation", () => {
  let demoHostId: string;
  let meeting30Id: string;
  let consultation60Id: string;

  before(async () => {
    // Retrieve the demo host and event types created in seed
    const host = await prisma.host.findUniqueOrThrow({
      where: { email: "alex.slotbook@example.com" },
      include: { eventTypes: true },
    });

    demoHostId = host.id;
    const m30 = host.eventTypes.find((e) => e.slug === "30-min-meeting");
    const c60 = host.eventTypes.find((e) => e.slug === "60-min-consultation");

    assert.ok(m30, "30-min meeting event type must exist");
    assert.ok(c60, "60-min consultation event type must exist");

    meeting30Id = m30.id;
    consultation60Id = c60.id;
  });

  after(async () => {
    await prisma.$disconnect();
  });

  it("generates valid slots within weekly schedule for 30-min meeting (09:00 - 17:00)", async () => {
    // Pick a future Monday: 2026-11-16 (Monday)
    const result = await getAvailableSlots({
      hostId: demoHostId,
      eventTypeId: meeting30Id,
      date: "2026-11-16",
      nowUtc: DateTime.fromISO("2026-11-01T00:00:00Z"),
    });

    assert.equal(result.date, "2026-11-16");
    assert.ok(result.slots.length > 0, "Should generate slots on a regular Monday");

    // Host operates 09:00 to 17:00 => 8 hours * 2 slots/hr = 16 slots of 30 min
    assert.equal(result.slots.length, 16);
    assert.equal(result.slots[0].localStart, "09:00");
    assert.equal(result.slots[0].localEnd, "09:30");
    assert.equal(result.slots[result.slots.length - 1].localStart, "16:30");
    assert.equal(result.slots[result.slots.length - 1].localEnd, "17:00");
  });

  it("generates valid slots within weekly schedule for 60-min consultation", async () => {
    // 2026-11-17 (Tuesday)
    const result = await getAvailableSlots({
      hostId: demoHostId,
      eventTypeId: consultation60Id,
      date: "2026-11-17",
      nowUtc: DateTime.fromISO("2026-11-01T00:00:00Z"),
    });

    // 09:00 to 17:00 => 8 slots of 60 min
    assert.equal(result.slots.length, 8);
    assert.equal(result.slots[0].localStart, "09:00");
    assert.equal(result.slots[0].localEnd, "10:00");
    assert.equal(result.slots[result.slots.length - 1].localStart, "16:00");
    assert.equal(result.slots[result.slots.length - 1].localEnd, "17:00");
  });

  it("returns zero slots on a weekend day with no availability (Sunday)", async () => {
    // 2026-11-15 is Sunday
    const result = await getAvailableSlots({
      hostId: demoHostId,
      eventTypeId: meeting30Id,
      date: "2026-11-15",
      nowUtc: DateTime.fromISO("2026-11-01T00:00:00Z"),
    });

    assert.equal(result.slots.length, 0, "No slots should be available on Sunday");
  });

  it("respects DateOverride full-day unavailability (Christmas Day 2026-12-25)", async () => {
    // 2026-12-25 was seeded with isUnavailable = true
    const result = await getAvailableSlots({
      hostId: demoHostId,
      eventTypeId: meeting30Id,
      date: "2026-12-25",
      nowUtc: DateTime.fromISO("2026-11-01T00:00:00Z"),
    });

    assert.equal(result.slots.length, 0, "Date override should block Christmas Day completely");
  });

  it("respects DateOverride custom window hours (Christmas Eve 2026-12-24: 09:00 - 13:00)", async () => {
    // 2026-12-24 was seeded with custom window 09:00 to 13:00
    const result = await getAvailableSlots({
      hostId: demoHostId,
      eventTypeId: meeting30Id,
      date: "2026-12-24",
      nowUtc: DateTime.fromISO("2026-11-01T00:00:00Z"),
    });

    // 09:00 to 13:00 is 4 hours => 8 slots of 30 min
    assert.equal(result.slots.length, 8);
    assert.equal(result.slots[0].localStart, "09:00");
    assert.equal(result.slots[result.slots.length - 1].localStart, "12:30");
    assert.equal(result.slots[result.slots.length - 1].localEnd, "13:00");
  });

  it("filters out past slots relative to nowUtc", async () => {
    // On 2026-11-16 in Asia/Kolkata (UTC+05:30):
    // 11:00 local is 05:30 UTC.
    // If nowUtc is 05:45 UTC (11:15 local), slots starting at 11:00 or earlier must be filtered out!
    const mockNowUtc = DateTime.fromISO("2026-11-16T05:45:00Z");

    const result = await getAvailableSlots({
      hostId: demoHostId,
      eventTypeId: meeting30Id,
      date: "2026-11-16",
      nowUtc: mockNowUtc,
    });

    // First slot should be 11:30 local (06:00 UTC)
    assert.ok(result.slots.length > 0);
    assert.equal(result.slots[0].localStart, "11:30");
    for (const slot of result.slots) {
      assert.ok(DateTime.fromISO(slot.startAt) > mockNowUtc, "Slot must be strictly in the future");
    }
  });

  it("filters out slots overlapping existing active bookings and buffer intervals", async () => {
    // Create a temporary booking for 2026-11-18 from 10:00 to 10:30 local (Asia/Kolkata is UTC+05:30)
    // 10:00 local = 04:30 UTC
    // 10:30 local = 05:00 UTC
    const startAt = DateTime.fromISO("2026-11-18T10:00:00", { zone: "Asia/Kolkata" }).toUTC();
    const endAt = startAt.plus({ minutes: 30 });
    // bufferBefore: 5, bufferAfter: 5 => reserved: [09:55, 10:35) local = [04:25, 05:05) UTC
    const reservedStartAt = startAt.minus({ minutes: 5 });
    const reservedEndAt = endAt.plus({ minutes: 5 });

    const tempBooking = await prisma.booking.create({
      data: {
        hostId: demoHostId,
        eventTypeId: meeting30Id,
        guestName: "Buffer Test Guest",
        guestEmail: "buffertest@example.com",
        startAt: startAt.toJSDate(),
        endAt: endAt.toJSDate(),
        reservedStartAt: reservedStartAt.toJSDate(),
        reservedEndAt: reservedEndAt.toJSDate(),
        status: BookingStatus.CONFIRMED,
      },
    });

    try {
      const result = await getAvailableSlots({
        hostId: demoHostId,
        eventTypeId: meeting30Id,
        date: "2026-11-18",
        nowUtc: DateTime.fromISO("2026-11-01T00:00:00Z"),
      });

      // 10:00 slot must be missing
      const slot1000 = result.slots.find((s) => s.localStart === "10:00");
      assert.equal(slot1000, undefined, "10:00 slot must not be available");

      // 10:30 slot has bufferBefore = 5 => reservedStart is 10:25, which overlaps [09:55, 10:35)
      // So 10:30 must ALSO be filtered out!
      const slot1030 = result.slots.find((s) => s.localStart === "10:30");
      assert.equal(slot1030, undefined, "10:30 slot must be filtered out due to buffer collision");

      // 11:00 slot has bufferBefore = 5 => reservedStart is 10:55, which does NOT overlap 10:35
      // So 11:00 MUST be available!
      const slot1100 = result.slots.find((s) => s.localStart === "11:00");
      assert.ok(slot1100, "11:00 slot must be available after buffer window");
    } finally {
      await prisma.booking.delete({ where: { id: tempBooking.id } });
    }
  });

  it("handles host in US timezone across Daylight Saving Time (DST) transitions", async () => {
    // Create a host in America/New_York (where DST ended on Nov 1, 2026: UTC-4 -> UTC-5)
    const dstHost = await prisma.host.create({
      data: {
        name: "DST Host",
        email: "dst-host@example.com",
        slug: "dst-host",
        timezone: "America/New_York",
      },
    });

    const dstEvent = await prisma.eventType.create({
      data: {
        hostId: dstHost.id,
        title: "DST Meeting",
        slug: "dst-meeting",
        duration: 60,
      },
    });

    // Add Friday availability 09:00 - 11:00
    await prisma.availability.create({
      data: {
        hostId: dstHost.id,
        dayOfWeek: DayOfWeek.FRIDAY,
        startTime: new Date("1970-01-01T09:00:00.000Z"),
        endTime: new Date("1970-01-01T11:00:00.000Z"),
      },
    });

    try {
      // Date in Summer EDT (UTC-4): 2026-06-12 (Friday)
      const summerResult = await getAvailableSlots({
        hostId: dstHost.id,
        eventTypeId: dstEvent.id,
        date: "2026-06-12",
        nowUtc: DateTime.fromISO("2026-01-01T00:00:00Z"),
      });

      assert.equal(summerResult.slots.length, 2);
      // In EDT (UTC-4), 09:00 is 13:00 UTC
      assert.equal(summerResult.slots[0].startAt, "2026-06-12T13:00:00.000Z");

      // Date in Winter EST (UTC-5): 2026-12-11 (Friday)
      const winterResult = await getAvailableSlots({
        hostId: dstHost.id,
        eventTypeId: dstEvent.id,
        date: "2026-12-11",
        nowUtc: DateTime.fromISO("2026-01-01T00:00:00Z"),
      });

      assert.equal(winterResult.slots.length, 2);
      // In EST (UTC-5), 09:00 is 14:00 UTC
      assert.equal(winterResult.slots[0].startAt, "2026-12-11T14:00:00.000Z");
    } finally {
      await prisma.availability.deleteMany({ where: { hostId: dstHost.id } });
      await prisma.eventType.deleteMany({ where: { hostId: dstHost.id } });
      await prisma.host.delete({ where: { id: dstHost.id } });
    }
  });
});

