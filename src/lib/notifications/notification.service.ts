import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { NotificationStatus, NotificationType, BookingStatus } from "@prisma/client";
import { getEmailProvider } from "./email-provider";
import { renderBookingConfirmationEmail } from "./templates/booking-confirmation";
import { renderBookingReminderEmail } from "./templates/booking-reminder";
import { renderBookingCancellationEmail } from "./templates/booking-cancellation";

export interface NotificationPayload {
  guestName: string;
  guestEmail: string;
  hostName: string;
  hostEmail: string;
  hostSlug: string;
  eventTitle: string;
  eventSlug: string;
  location?: string | null;
  duration: number;
  formattedDate: string;
  formattedTime: string;
  hostTimezone: string;
  startAtUtc: string;
  endAtUtc: string;
  bookingId: string;
  cancellationReason?: string | null;
  cancelledBy?: "guest" | "host";
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/**
 * Builds standard notification payload metadata from booking entities.
 */
export function buildNotificationPayload(data: {
  bookingId: string;
  guestName: string;
  guestEmail: string;
  hostName: string;
  hostEmail: string;
  hostSlug: string;
  hostTimezone: string;
  eventTitle: string;
  eventSlug: string;
  duration: number;
  location?: string | null;
  startAt: Date;
  endAt: Date;
  cancellationReason?: string | null;
  cancelledBy?: "guest" | "host";
}): NotificationPayload {
  const startDt = DateTime.fromJSDate(data.startAt, { zone: data.hostTimezone });
  const endDt = DateTime.fromJSDate(data.endAt, { zone: data.hostTimezone });

  return {
    bookingId: data.bookingId,
    guestName: data.guestName,
    guestEmail: data.guestEmail,
    hostName: data.hostName,
    hostEmail: data.hostEmail,
    hostSlug: data.hostSlug,
    hostTimezone: data.hostTimezone,
    eventTitle: data.eventTitle,
    eventSlug: data.eventSlug,
    duration: data.duration,
    location: data.location || null,
    formattedDate: startDt.toFormat("EEEE, MMMM d, yyyy"),
    formattedTime: `${startDt.toFormat("HH:mm")} – ${endDt.toFormat("HH:mm")}`,
    startAtUtc: DateTime.fromJSDate(data.startAt, { zone: "utc" }).toISO()!,
    endAtUtc: DateTime.fromJSDate(data.endAt, { zone: "utc" }).toISO()!,
    cancellationReason: data.cancellationReason || null,
    cancelledBy: data.cancelledBy,
  };
}

/**
 * Renders the appropriate email template for a given notification type and payload.
 */
export function renderNotificationEmail(
  type: NotificationType,
  payload: NotificationPayload,
  baseUrl?: string
): RenderedEmail {
  const appBaseUrl = baseUrl || process.env.APP_BASE_URL || "http://localhost:3000";

  switch (type) {
    case NotificationType.CONFIRMATION:
      return renderBookingConfirmationEmail({
        guestName: payload.guestName,
        hostName: payload.hostName,
        eventTitle: payload.eventTitle,
        formattedDate: payload.formattedDate,
        formattedTime: payload.formattedTime,
        hostTimezone: payload.hostTimezone,
        duration: payload.duration,
        location: payload.location,
        bookingId: payload.bookingId,
        baseUrl: appBaseUrl,
      });

    case NotificationType.REMINDER:
      return renderBookingReminderEmail({
        guestName: payload.guestName,
        hostName: payload.hostName,
        eventTitle: payload.eventTitle,
        formattedDate: payload.formattedDate,
        formattedTime: payload.formattedTime,
        hostTimezone: payload.hostTimezone,
        duration: payload.duration,
        location: payload.location,
        bookingId: payload.bookingId,
        baseUrl: appBaseUrl,
      });

    case NotificationType.CANCELLATION: {
      const rebookUrl = payload.hostSlug && payload.eventSlug
        ? `${appBaseUrl.replace(/\/$/, "")}/book/${encodeURIComponent(payload.hostSlug)}/${encodeURIComponent(payload.eventSlug)}`
        : null;

      return renderBookingCancellationEmail({
        guestName: payload.guestName,
        hostName: payload.hostName,
        eventTitle: payload.eventTitle,
        formattedDate: payload.formattedDate,
        formattedTime: payload.formattedTime,
        hostTimezone: payload.hostTimezone,
        duration: payload.duration,
        location: payload.location,
        bookingId: payload.bookingId,
        cancellationReason: payload.cancellationReason,
        cancelledBy: payload.cancelledBy,
        baseUrl: appBaseUrl,
        rebookUrl,
      });
    }

    default:
      throw new Error(`Unsupported notification type: ${type}`);
  }
}

/**
 * Claims a bounded batch of due notification jobs using PostgreSQL FOR UPDATE SKIP LOCKED.
 * Also reclaims abandoned PROCESSING jobs older than lockTimeoutMs.
 */
export async function claimDueNotifications(
  limit = 10,
  lockTimeoutMs = 300000
): Promise<string[]> {
  const maxAttempts = parseInt(process.env.NOTIFICATION_MAX_ATTEMPTS || "5", 10);

  return prisma.$transaction(async (tx) => {
    // 1. Select IDs of due jobs with row-level locks skipping already locked rows
    const claimedRows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Notification"
      WHERE (
        ("status" = 'PENDING'::"NotificationStatus" AND "scheduledAt" <= NOW())
        OR ("status" = 'SCHEDULED'::"NotificationStatus" AND "scheduledAt" <= NOW())
        OR ("status" = 'FAILED'::"NotificationStatus" AND "nextAttemptAt" IS NOT NULL AND "nextAttemptAt" <= NOW() AND "attemptCount" < ${maxAttempts})
        OR ("status" = 'PROCESSING'::"NotificationStatus" AND "lockedAt" IS NOT NULL AND "lockedAt" < (NOW() - (${lockTimeoutMs} * INTERVAL '1 millisecond')))
      )
      ORDER BY "scheduledAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    `;

    if (claimedRows.length === 0) {
      return [];
    }

    const ids = claimedRows.map((r) => r.id);

    // 2. Mark claimed rows as PROCESSING and set lock timestamp
    await tx.notification.updateMany({
      where: { id: { in: ids } },
      data: {
        status: NotificationStatus.PROCESSING,
        lockedAt: new Date(),
      },
    });

    return ids;
  });
}

/**
 * Determines whether an error is permanent (non-retryable) or transient.
 */
function isPermanentError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  // Permanent validation or auth errors should not be retried endlessly
  return (
    message.includes("invalid_recipient") ||
    message.includes("unregistered_domain") ||
    message.includes("missing_required_fields") ||
    message.includes("api key is invalid") ||
    message.includes("unauthorized")
  );
}

/**
 * Processes a single claimed notification record.
 * Handles template rendering, provider invocation, idempotency, retry backoff, and terminal failure.
 */
export async function processNotification(notificationId: string): Promise<{
  success: boolean;
  notificationId: string;
  status: NotificationStatus;
  error?: string;
}> {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
    include: {
      booking: {
        include: {
          host: true,
          eventType: true,
        },
      },
    },
  });

  if (!notification) {
    return { success: false, notificationId, status: NotificationStatus.FAILED, error: "Record not found" };
  }

  // Handle case where booking was cancelled while a reminder was scheduled/claimed
  if (
    notification.type === NotificationType.REMINDER &&
    notification.booking.status === BookingStatus.CANCELLED
  ) {
    await prisma.notification.update({
      where: { id: notification.id },
      data: {
        status: NotificationStatus.CANCELLED,
        lockedAt: null,
      },
    });
    return {
      success: true,
      notificationId: notification.id,
      status: NotificationStatus.CANCELLED,
    };
  }

  // Resolve or reconstruct payload
  let payload = notification.payload as unknown as NotificationPayload | null;
  if (!payload) {
    payload = buildNotificationPayload({
      bookingId: notification.booking.id,
      guestName: notification.booking.guestName,
      guestEmail: notification.booking.guestEmail,
      hostName: notification.booking.host.name,
      hostEmail: notification.booking.host.email,
      hostSlug: notification.booking.host.slug,
      hostTimezone: notification.booking.host.timezone,
      eventTitle: notification.booking.eventType.title,
      eventSlug: notification.booking.eventType.slug,
      duration: notification.booking.eventType.duration,
      location: notification.booking.eventType.location,
      startAt: notification.booking.startAt,
      endAt: notification.booking.endAt,
      cancellationReason: notification.booking.cancellationReason,
    });
  }

  const recipientEmail = notification.recipientEmail || notification.booking.guestEmail;

  try {
    const rendered = renderNotificationEmail(notification.type, payload);
    const provider = getEmailProvider();

    // Call provider with notification ID as idempotency key and strict 25s network timeout
    const sendPromise = provider.sendEmail({
      to: recipientEmail,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      idempotencyKey: notification.id,
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      const timer = setTimeout(() => reject(new Error("Email provider network request timed out after 25s")), 25000);
      if (typeof timer.unref === "function") timer.unref();
    });

    const sendResult = await Promise.race([sendPromise, timeoutPromise]);

    // Mark as SENT only after provider confirms acceptance
    const now = new Date();
    await prisma.notification.update({
      where: { id: notification.id },
      data: {
        status: NotificationStatus.SENT,
        sentAt: now,
        providerMessageId: sendResult.messageId,
        recipientEmail,
        subject: rendered.subject,
        payload: payload as object,
        lockedAt: null,
        lastError: null,
      },
    });

    return {
      success: true,
      notificationId: notification.id,
      status: NotificationStatus.SENT,
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    // Sanitize any secrets
    const safeError = errorMessage.replace(/re_[a-zA-Z0-9_]+/g, "re_***").slice(0, 500);

    const maxAttempts = parseInt(process.env.NOTIFICATION_MAX_ATTEMPTS || "5", 10);
    const newAttemptCount = notification.attemptCount + 1;
    const permanent = isPermanentError(err) || newAttemptCount >= maxAttempts;

    // Exponential backoff: 30s, 60s, 120s, 240s... capped at 1 hour
    const backoffSeconds = Math.min(3600, Math.pow(2, newAttemptCount) * 15);
    const nextAttemptAt = permanent ? null : new Date(Date.now() + backoffSeconds * 1000);

    const targetStatus = permanent ? NotificationStatus.FAILED : NotificationStatus.FAILED;
    // Note: status is set to FAILED if permanent or waiting for retry with nextAttemptAt set
    // A record with status = FAILED and nextAttemptAt <= NOW() is claimed by claimDueNotifications for retry

    await prisma.notification.update({
      where: { id: notification.id },
      data: {
        status: targetStatus,
        attemptCount: newAttemptCount,
        lastError: safeError,
        nextAttemptAt,
        lockedAt: null,
      },
    });

    return {
      success: false,
      notificationId: notification.id,
      status: targetStatus,
      error: safeError,
    };
  }
}

