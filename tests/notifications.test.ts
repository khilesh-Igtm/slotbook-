import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { DateTime } from "luxon";
import { prisma } from "../src/lib/prisma";
import { NotificationStatus, NotificationType, BookingStatus } from "@prisma/client";
import { createBooking } from "../src/lib/services/booking.service";
import { cancelBooking } from "../src/lib/services/cancellation.service";
import {
  claimDueNotifications,
  processNotification,
  buildNotificationPayload,
  renderNotificationEmail,
} from "../src/lib/notifications/notification.service";
import { setEmailProvider, EmailProvider, EmailPayload, SendEmailResult } from "../src/lib/notifications/email-provider";
import { ConsoleEmailProvider } from "../src/lib/notifications/providers/console.provider";
import { ResendEmailProvider } from "../src/lib/notifications/providers/resend.provider";
import { retryNotificationAsHost, getBookingDetailsForHost } from "../src/lib/services/host-booking.service";
import { UnauthorizedError, ValidationError } from "../src/lib/errors";

class MockEmailProvider implements EmailProvider {
  public readonly name = "mock";
  public sentEmails: EmailPayload[] = [];
  public shouldFail = false;
  public failureError = new Error("Simulated transient network failure");

  async sendEmail(payload: EmailPayload): Promise<SendEmailResult> {
    if (this.shouldFail) {
      throw this.failureError;
    }
    this.sentEmails.push(payload);
    return {
      success: true,
      messageId: `mock-msg-${this.sentEmails.length}`,
      provider: this.name,
    };
  }

  reset() {
    this.sentEmails = [];
    this.shouldFail = false;
    this.failureError = new Error("Simulated transient network failure");
  }
}

describe("Phase 5: Email Notifications & Background Job Processing", () => {
  let demoHostId: string;
  let meeting30Id: string;
  let secondaryHostId: string;
  let mockProvider: MockEmailProvider;

  before(async () => {
    mockProvider = new MockEmailProvider();
    setEmailProvider(mockProvider);

    const host = await prisma.host.findUniqueOrThrow({
      where: { email: "alex.slotbook@example.com" },
      include: { eventTypes: true },
    });

    demoHostId = host.id;
    const m30 = host.eventTypes.find((e) => e.slug === "30-min-meeting");
    assert.ok(m30);
    meeting30Id = m30.id;

    // Create a secondary host to test authorization bounds
    const secondary = await prisma.host.upsert({
      where: { email: "phase5.secondary@example.com" },
      update: {},
      create: {
        name: "Phase 5 Secondary Host",
        email: "phase5.secondary@example.com",
        slug: "phase5-secondary",
        timezone: "America/Chicago",
      },
    });
    secondaryHostId = secondary.id;
  });

  after(async () => {
    setEmailProvider(null);
    await prisma.notification.deleteMany({ where: { booking: { hostId: secondaryHostId } } });
    await prisma.booking.deleteMany({ where: { hostId: secondaryHostId } });
    await prisma.host.deleteMany({ where: { id: secondaryHostId } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    mockProvider.reset();
  });

  // ==========================================
  // 1. Transactional Notification Creation
  // ==========================================
  describe("1. Transactional Notification Creation & Scheduling", () => {
    it("creates confirmation (PENDING) and reminder (SCHEDULED) when appointment is >24h away", async () => {
      // 2026-11-25 10:00 IST (04:30 UTC), mock now is 2026-11-01 (24 days prior)
      const startAt = "2026-11-25T04:30:00.000Z";
      const mockNow = DateTime.fromISO("2026-11-01T00:00:00Z");

      const { booking } = await createBooking(
        {
          hostId: demoHostId,
          eventTypeId: meeting30Id,
          startAt,
          guestName: "Notification Tester",
          guestEmail: "notif.tester@example.com",
        },
        null,
        mockNow
      );

      const notifications = await prisma.notification.findMany({
        where: { bookingId: booking.id },
        orderBy: { type: "asc" },
      });

      assert.equal(notifications.length, 2);

      // Confirmation: PENDING, scheduled at mockNow
      const confirmation = notifications.find((n) => n.type === NotificationType.CONFIRMATION);
      assert.ok(confirmation);
      assert.equal(confirmation.status, NotificationStatus.PENDING);
      assert.equal(confirmation.recipientEmail, "notif.tester@example.com");
      assert.equal(confirmation.recipientType, "GUEST");
      assert.ok(confirmation.subject?.includes("Confirmed:"));
      assert.ok(confirmation.payload !== null);

      // Reminder: SCHEDULED, scheduled at startAt - 24 hours
      const reminder = notifications.find((n) => n.type === NotificationType.REMINDER);
      assert.ok(reminder);
      assert.equal(reminder.status, NotificationStatus.SCHEDULED);
      assert.equal(reminder.recipientEmail, "notif.tester@example.com");

      const expectedReminderTime = DateTime.fromISO(startAt).minus({ hours: 24 }).toJSDate();
      assert.equal(reminder.scheduledAt.toISOString(), expectedReminderTime.toISOString());

      // Clean up
      await prisma.notification.deleteMany({ where: { bookingId: booking.id } });
      await prisma.booking.delete({ where: { id: booking.id } });
    });

    it("skips scheduling reminder when appointment is too close (<24h from now)", async () => {
      // 2026-11-26 10:00 IST (04:30 UTC), mock now is 2026-11-25 18:00 UTC (10.5 hours prior)
      const startAt = "2026-11-26T04:30:00.000Z";
      const mockNow = DateTime.fromISO("2026-11-25T18:00:00Z");

      const { booking } = await createBooking(
        {
          hostId: demoHostId,
          eventTypeId: meeting30Id,
          startAt,
          guestName: "Short Notice Guest",
          guestEmail: "shortnotice@example.com",
        },
        null,
        mockNow
      );

      const notifications = await prisma.notification.findMany({
        where: { bookingId: booking.id },
      });

      // Only confirmation should exist; reminder is skipped
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0].type, NotificationType.CONFIRMATION);
      assert.equal(notifications[0].status, NotificationStatus.PENDING);

      // Clean up
      await prisma.notification.deleteMany({ where: { bookingId: booking.id } });
      await prisma.booking.delete({ where: { id: booking.id } });
    });

    it("cancels pending reminders and creates CANCELLATION notification when booking is cancelled", async () => {
      // 2026-11-27 10:00 IST (04:30 UTC), mock now is 2026-11-01
      const startAt = "2026-11-27T04:30:00.000Z";
      const mockNow = DateTime.fromISO("2026-11-01T00:00:00Z");

      const { booking } = await createBooking(
        {
          hostId: demoHostId,
          eventTypeId: meeting30Id,
          startAt,
          guestName: "Cancelling Attendee",
          guestEmail: "cancelling@example.com",
        },
        null,
        mockNow
      );

      // Cancel booking
      const cancelled = await cancelBooking(
        booking.id,
        {
          cancellationKey: booking.cancellationKey,
          reason: "Emergency meeting reschedule",
        },
        mockNow
      );

      assert.equal(cancelled.status, BookingStatus.CANCELLED);

      const notifications = await prisma.notification.findMany({
        where: { bookingId: booking.id },
        orderBy: { type: "asc" },
      });

      // Reminder must be CANCELLED
      const reminder = notifications.find((n) => n.type === NotificationType.REMINDER);
      assert.ok(reminder);
      assert.equal(reminder.status, NotificationStatus.CANCELLED);

      // Cancellation notification must be PENDING
      const cancellationNotif = notifications.find((n) => n.type === NotificationType.CANCELLATION);
      assert.ok(cancellationNotif);
      assert.equal(cancellationNotif.status, NotificationStatus.PENDING);
      assert.equal(cancellationNotif.recipientEmail, "cancelling@example.com");

      const payload = cancellationNotif.payload as { cancellationReason?: string };
      assert.equal(payload?.cancellationReason, "Emergency meeting reschedule");

      // Clean up
      await prisma.notification.deleteMany({ where: { bookingId: booking.id } });
      await prisma.booking.delete({ where: { id: booking.id } });
    });
  });

  // ==========================================
  // 2. Email Templates & HTML Escaping
  // ==========================================
  describe("2. Email Templates & Security Sanitization", () => {
    it("escapes user-provided malicious HTML/XSS content in confirmation template", () => {
      const maliciousPayload = buildNotificationPayload({
        bookingId: "test-booking-id",
        guestName: "<script>alert('XSS-Guest')</script>",
        guestEmail: "victim@example.com",
        hostName: "Host <b onmouseover='alert(1)'>Bold</b>",
        hostEmail: "host@example.com",
        hostSlug: "host-slug",
        hostTimezone: "Asia/Kolkata",
        eventTitle: "Meeting & Consultation \"Quotes\"",
        eventSlug: "meeting-consultation",
        duration: 30,
        location: "<iframe src='evil.com'></iframe>",
        startAt: new Date("2026-11-23T04:30:00.000Z"),
        endAt: new Date("2026-11-23T05:00:00.000Z"),
      });

      const rendered = renderNotificationEmail(NotificationType.CONFIRMATION, maliciousPayload);

      // Verify dangerous tags are fully escaped
      assert.equal(rendered.html.includes("<script>"), false, "Must not contain raw script tags");
      assert.equal(rendered.html.includes("<iframe>"), false, "Must not contain raw iframe tags");
      assert.ok(rendered.html.includes("&lt;script&gt;"));
      assert.ok(rendered.html.includes("&lt;iframe"));
      assert.ok(rendered.html.includes("&quot;Quotes&quot;"));

      // Verify no secrets or cancellationKey in rendered HTML or URLs
      assert.equal(rendered.html.includes("cancellationKey"), false);
      assert.ok(rendered.html.includes("/bookings/test-booking-id"));
    });

    it("renders cancellation email with reason and link to view status", () => {
      const payload = buildNotificationPayload({
        bookingId: "cancel-test-id",
        guestName: "Sarah Connor",
        guestEmail: "sarah@example.com",
        hostName: "Alex Sharma",
        hostEmail: "alex@example.com",
        hostSlug: "alex-sharma",
        hostTimezone: "Asia/Kolkata",
        eventTitle: "Strategy Review",
        eventSlug: "strategy-review",
        duration: 45,
        location: "Zoom Video Call",
        startAt: new Date("2026-11-23T04:30:00.000Z"),
        endAt: new Date("2026-11-23T05:15:00.000Z"),
        cancellationReason: "Schedule conflict due to travel",
      });

      const rendered = renderNotificationEmail(NotificationType.CANCELLATION, payload);

      assert.ok(rendered.subject.includes("Cancelled:"));
      assert.ok(rendered.html.includes("Schedule conflict due to travel"));
      assert.ok(rendered.html.includes("/book/alex-sharma/strategy-review"));
      assert.ok(rendered.text.includes("Reason: Schedule conflict due to travel"));
    });
  });

  // ==========================================
  // 3. Email Provider Abstraction
  // ==========================================
  describe("3. Email Provider Abstraction", () => {
    it("ConsoleEmailProvider outputs safely and generates mock message ID", async () => {
      const consoleProvider = new ConsoleEmailProvider();
      assert.equal(consoleProvider.name, "console");

      const res = await consoleProvider.sendEmail({
        to: "guest@example.com",
        subject: "Test Console Subject",
        html: "<p>Hello</p>",
        text: "Hello",
      });

      assert.equal(res.success, true);
      assert.equal(res.provider, "console");
      assert.ok(res.messageId.startsWith("console-"));
    });

    it("ResendEmailProvider validates missing API key on instantiation", () => {
      const originalKey = process.env.RESEND_API_KEY;
      delete process.env.RESEND_API_KEY;

      try {
        assert.throws(
          () => new ResendEmailProvider(),
          /RESEND_API_KEY environment variable is required/
        );
      } finally {
        if (originalKey !== undefined) {
          process.env.RESEND_API_KEY = originalKey;
        }
      }
    });
  });

  // ==========================================
  // 4. Background Worker Processing & Concurrency
  // ==========================================
  describe("4. Background Worker Job Processing & Concurrency", () => {
    let testBookingId: string;
    let dueNotifId: string;
    let futureNotifId: string;

    before(async () => {
      const startAt = "2026-12-01T04:30:00.000Z";
      const { booking } = await createBooking({
        hostId: demoHostId,
        eventTypeId: meeting30Id,
        startAt,
        guestName: "Worker Test Guest",
        guestEmail: "workertest@example.com",
      });

      testBookingId = booking.id;

      // Update the existing confirmation notification to be due (scheduled 10s ago)
      const dueNotif = await prisma.notification.update({
        where: {
          bookingId_type_recipientType: {
            bookingId: testBookingId,
            type: NotificationType.CONFIRMATION,
            recipientType: "GUEST",
          },
        },
        data: {
          scheduledAt: new Date(Date.now() - 10000), // 10s ago
        },
      });
      dueNotifId = dueNotif.id;

      // The reminder notification was automatically scheduled for 24h prior to appointment (future)
      const futureNotif = await prisma.notification.findUniqueOrThrow({
        where: {
          bookingId_type_recipientType: {
            bookingId: testBookingId,
            type: NotificationType.REMINDER,
            recipientType: "GUEST",
          },
        },
      });
      futureNotifId = futureNotif.id;
    });

    after(async () => {
      await prisma.notification.deleteMany({ where: { bookingId: testBookingId } });
      await prisma.booking.delete({ where: { id: testBookingId } });
    });

    it("claims due notifications and ignores future scheduled notifications", async () => {
      const claimedIds = await claimDueNotifications(10, 300000);

      // dueNotifId should be claimed, futureNotifId should NOT be claimed
      assert.ok(claimedIds.includes(dueNotifId), "Due notification must be claimed");
      assert.equal(claimedIds.includes(futureNotifId), false, "Future notification must not be claimed");

      // Verify claimed notification is now in PROCESSING status with lockedAt set
      const claimedRow = await prisma.notification.findUniqueOrThrow({
        where: { id: dueNotifId },
      });
      assert.equal(claimedRow.status, NotificationStatus.PROCESSING);
      assert.ok(claimedRow.lockedAt !== null);
    });

    it("processes claimed job successfully and marks it SENT with messageId", async () => {
      const processRes = await processNotification(dueNotifId);

      assert.equal(processRes.success, true);
      assert.equal(processRes.status, NotificationStatus.SENT);

      const updated = await prisma.notification.findUniqueOrThrow({
        where: { id: dueNotifId },
      });
      assert.equal(updated.status, NotificationStatus.SENT);
      assert.ok(updated.sentAt !== null);
      assert.ok(updated.providerMessageId !== null);
      assert.equal(updated.lockedAt, null, "Lock must be released on success");
      assert.equal(mockProvider.sentEmails.length, 1);
      assert.equal(mockProvider.sentEmails[0].to, "workertest@example.com");
    });

    it("handles provider failure: increments attemptCount, records lastError, and sets nextAttemptAt", async () => {
      // Create a failed job to test retry backoff
      const retryJob = await prisma.notification.create({
        data: {
          bookingId: testBookingId,
          type: NotificationType.CANCELLATION,
          status: NotificationStatus.PROCESSING,
          recipientEmail: "workertest@example.com",
          scheduledAt: new Date(Date.now() - 5000),
          lockedAt: new Date(),
          attemptCount: 1,
        },
      });

      mockProvider.shouldFail = true;
      mockProvider.failureError = new Error("503 Service Unavailable: upstream timeout");

      const processRes = await processNotification(retryJob.id);

      assert.equal(processRes.success, false);
      assert.equal(processRes.status, NotificationStatus.FAILED);

      const afterFailure = await prisma.notification.findUniqueOrThrow({
        where: { id: retryJob.id },
      });

      assert.equal(afterFailure.status, NotificationStatus.FAILED);
      assert.equal(afterFailure.attemptCount, 2);
      assert.ok(afterFailure.lastError?.includes("503 Service Unavailable"));
      assert.ok(afterFailure.nextAttemptAt !== null);
      assert.equal(afterFailure.lockedAt, null);

      await prisma.notification.delete({ where: { id: retryJob.id } });
    });

    it("recovers abandoned PROCESSING jobs past lease timeout", async () => {
      // Set the confirmation job to stale PROCESSING locked 10 minutes ago with 5-minute lease
      const staleJob = await prisma.notification.update({
        where: {
          bookingId_type_recipientType: {
            bookingId: testBookingId,
            type: NotificationType.CONFIRMATION,
            recipientType: "GUEST",
          },
        },
        data: {
          status: NotificationStatus.PROCESSING,
          scheduledAt: new Date(Date.now() - 600000),
          lockedAt: new Date(Date.now() - 600000), // 10 minutes ago
        },
      });

      // Claim jobs with 5-minute lease (300,000ms)
      const claimedIds = await claimDueNotifications(10, 300000);

      assert.ok(claimedIds.includes(staleJob.id), "Stale processing job must be reclaimed");
    });

    it("cancels reminder job without sending email if booking was cancelled while queued", async () => {
      // Create an active booking and then cancel it
      const startAt = "2026-12-08T04:30:00.000Z";
      const { booking } = await createBooking({
        hostId: demoHostId,
        eventTypeId: meeting30Id,
        startAt,
        guestName: "Late Cancellation Guest",
        guestEmail: "latecancel@example.com",
      });

      // Update the existing reminder job to PROCESSING status
      const reminderJob = await prisma.notification.update({
        where: {
          bookingId_type_recipientType: {
            bookingId: booking.id,
            type: NotificationType.REMINDER,
            recipientType: "GUEST",
          },
        },
        data: {
          status: NotificationStatus.PROCESSING,
          scheduledAt: new Date(Date.now() - 1000),
          lockedAt: new Date(),
        },
      });

      // Cancel the booking in DB
      await prisma.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.CANCELLED },
      });

      mockProvider.reset();

      // Process the reminder
      const result = await processNotification(reminderJob.id);

      assert.equal(result.status, NotificationStatus.CANCELLED);
      assert.equal(mockProvider.sentEmails.length, 0, "No email should be dispatched for a cancelled booking");

      const finalNotif = await prisma.notification.findUniqueOrThrow({
        where: { id: reminderJob.id },
      });
      assert.equal(finalNotif.status, NotificationStatus.CANCELLED);

      // Clean up
      await prisma.notification.deleteMany({ where: { bookingId: booking.id } });
      await prisma.booking.delete({ where: { id: booking.id } });
    });
  });

  // ==========================================
  // 5. Host Dashboard Notification Management & Manual Retry
  // ==========================================
  describe("5. Host Dashboard Notification Management & Manual Retry", () => {
    let dashboardBookingId: string;
    let failedNotifId: string;

    before(async () => {
      const startAt = "2026-12-15T04:30:00.000Z";
      const { booking } = await createBooking({
        hostId: demoHostId,
        eventTypeId: meeting30Id,
        startAt,
        guestName: "Dashboard Notif Attendee",
        guestEmail: "dashnotif@example.com",
      });

      dashboardBookingId = booking.id;

      // Update the confirmation notification created by createBooking to FAILED
      const failed = await prisma.notification.update({
        where: {
          bookingId_type_recipientType: {
            bookingId: dashboardBookingId,
            type: NotificationType.CONFIRMATION,
            recipientType: "GUEST",
          },
        },
        data: {
          status: NotificationStatus.FAILED,
          scheduledAt: new Date(Date.now() - 3600000),
          attemptCount: 5,
          lastError: "Rate limit exceeded from provider",
        },
      });
      failedNotifId = failed.id;
    });

    after(async () => {
      await prisma.notification.deleteMany({ where: { bookingId: dashboardBookingId } });
      await prisma.booking.delete({ where: { id: dashboardBookingId } });
    });

    it("retrieves enhanced notification history for host", async () => {
      const details = await getBookingDetailsForHost(demoHostId, dashboardBookingId, "Asia/Kolkata");

      assert.ok(details.notifications.length > 0);
      const notif = details.notifications.find((n) => n.id === failedNotifId);
      assert.ok(notif);
      assert.equal(notif.status, NotificationStatus.FAILED);
      assert.equal(notif.recipientEmail, "dashnotif@example.com");
      assert.equal(notif.attemptCount, 5);
      assert.equal(notif.lastError, "Rate limit exceeded from provider");
    });

    it("allows authorized host to manually retry a FAILED notification", async () => {
      const retryRes = await retryNotificationAsHost(
        demoHostId,
        dashboardBookingId,
        failedNotifId
      );

      assert.equal(retryRes.success, true);
      assert.equal(retryRes.notification.status, NotificationStatus.PENDING);
      assert.equal(retryRes.notification.attemptCount, 0);

      const inDb = await prisma.notification.findUniqueOrThrow({
        where: { id: failedNotifId },
      });
      assert.equal(inDb.status, NotificationStatus.PENDING);
      assert.equal(inDb.attemptCount, 0);
      assert.equal(inDb.lastError, null);
    });

    it("rejects unauthorized host attempt to retry another host's notification (cross-host security)", async () => {
      await assert.rejects(
        async () => {
          await retryNotificationAsHost(
            secondaryHostId,
            dashboardBookingId,
            failedNotifId
          );
        },
        UnauthorizedError,
        "Cross-host retry must be rejected"
      );
    });

    it("rejects retry attempt on a notification that is not in FAILED status", async () => {
      // Notification is now PENDING (from previous test), attempting to retry it should fail
      await assert.rejects(
        async () => {
          await retryNotificationAsHost(
            demoHostId,
            dashboardBookingId,
            failedNotifId
          );
        },
        ValidationError,
        "Only FAILED notifications should be allowed for manual retry"
      );
    });
  });
});
