import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { prisma } from "../src/lib/prisma";
import { GET as getEventTypes } from "../src/app/api/hosts/[hostId]/event-types/route";
import { GET as getAvailability } from "../src/app/api/hosts/[hostId]/event-types/[eventTypeId]/availability/route";
import { POST as createBookingRoute } from "../src/app/api/bookings/route";
import { GET as getBookingRoute } from "../src/app/api/bookings/[bookingId]/route";
import { POST as cancelBookingRoute } from "../src/app/api/bookings/[bookingId]/cancel/route";

describe("API Routes Integration", () => {
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
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.notification.deleteMany();
    await prisma.idempotencyKey.deleteMany();
    await prisma.booking.deleteMany();
  });

  it("GET /api/hosts/[hostId]/event-types returns active event types", async () => {
    const req = new NextRequest(`http://localhost:3000/api/hosts/${demoHostId}/event-types`);
    const res = await getEventTypes(req, { params: Promise.resolve({ hostId: demoHostId }) });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.host.id, demoHostId);
    assert.ok(Array.isArray(data.eventTypes));
    assert.ok(data.eventTypes.length >= 2);
  });

  it("GET /api/hosts/[hostId]/event-types returns 404 for unknown host", async () => {
    const req = new NextRequest("http://localhost:3000/api/hosts/unknown-host/event-types");
    const res = await getEventTypes(req, { params: Promise.resolve({ hostId: "unknown-host" }) });

    assert.equal(res.status, 404);
    const data = await res.json();
    assert.equal(data.error.code, "NOT_FOUND");
  });

  it("GET /api/hosts/[hostId]/event-types/[eventTypeId]/availability returns slot array", async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/hosts/${demoHostId}/event-types/${meeting30Id}/availability?date=2026-11-23`
    );
    const res = await getAvailability(req, {
      params: Promise.resolve({ hostId: demoHostId, eventTypeId: meeting30Id }),
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.date, "2026-11-23");
    assert.ok(Array.isArray(data.slots));
  });

  it("POST /api/bookings and GET /api/bookings/[bookingId] lifecycle", async () => {
    const startAt = "2026-11-23T04:30:00.000Z";
    const postReq = new NextRequest("http://localhost:3000/api/bookings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "api-idem-key-01",
      },
      body: JSON.stringify({
        hostId: demoHostId,
        eventTypeId: meeting30Id,
        startAt,
        guestName: "API Tester",
        guestEmail: "apitester@example.com",
      }),
    });

    const postRes = await createBookingRoute(postReq);
    assert.equal(postRes.status, 201);
    const postData = await postRes.json();
    assert.equal(postData.booking.guestName, "API Tester");
    assert.equal(postData.isIdempotentReplay, false);
    const bookingId = postData.booking.id;
    const cancellationKey = postData.booking.cancellationKey;

    // GET /api/bookings/[bookingId]
    const getReq = new NextRequest(`http://localhost:3000/api/bookings/${bookingId}`);
    const getRes = await getBookingRoute(getReq, { params: Promise.resolve({ bookingId }) });
    assert.equal(getRes.status, 200);
    const getData = await getRes.json();
    assert.equal(getData.booking.id, bookingId);
    assert.equal(getData.booking.cancellationKey, undefined, "Public GET endpoint must not expose cancellationKey");

    // POST /api/bookings/[bookingId]/cancel
    const cancelReq = new NextRequest(`http://localhost:3000/api/bookings/${bookingId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cancellationKey,
        reason: "Cancelled via API endpoint",
      }),
    });

    const cancelRes = await cancelBookingRoute(cancelReq, { params: Promise.resolve({ bookingId }) });
    assert.equal(cancelRes.status, 200);
    const cancelData = await cancelRes.json();
    assert.equal(cancelData.booking.status, "CANCELLED");
  });
});

