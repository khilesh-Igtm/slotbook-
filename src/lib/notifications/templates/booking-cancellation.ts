import { escapeHtml, renderBaseEmailLayout } from "./base-layout";

export interface BookingCancellationTemplateData {
  guestName: string;
  hostName: string;
  eventTitle: string;
  formattedDate: string;
  formattedTime: string;
  hostTimezone: string;
  duration: number;
  location?: string | null;
  bookingId: string;
  cancellationReason?: string | null;
  cancelledBy?: "guest" | "host";
  baseUrl?: string;
  rebookUrl?: string | null;
}

export function renderBookingCancellationEmail(data: BookingCancellationTemplateData) {
  const baseUrl = data.baseUrl || process.env.APP_BASE_URL || "http://localhost:3000";
  const bookingUrl = `${baseUrl.replace(/\/$/, "")}/bookings/${encodeURIComponent(data.bookingId)}`;

  const safeGuest = escapeHtml(data.guestName);
  const safeHost = escapeHtml(data.hostName);
  const safeTitle = escapeHtml(data.eventTitle);
  const safeDate = escapeHtml(data.formattedDate);
  const safeTime = escapeHtml(data.formattedTime);
  const safeTimezone = escapeHtml(data.hostTimezone);
  const safeLocation = data.location ? escapeHtml(data.location) : "Online Meeting / Web Call";
  const safeBookingId = escapeHtml(data.bookingId);
  const safeReason = data.cancellationReason ? escapeHtml(data.cancellationReason) : null;

  const subject = `Cancelled: ${data.eventTitle} with ${data.hostName}`;

  const contentHtml = `
    <!-- Cancellation Banner -->
    <div style="background-color: #fef2f2; border: 1px solid #fee2e2; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
      <h1 style="margin: 0 0 4px 0; font-size: 18px; font-weight: 700; color: #991b1b;">
        Appointment Cancelled
      </h1>
      <p style="margin: 0; font-size: 14px; color: #b91c1c;">
        This appointment has been removed from the schedule.
      </p>
    </div>

    <p style="margin: 0 0 20px 0; font-size: 15px; color: #475569;">
      Hi ${safeGuest}, your upcoming <strong>${safeTitle}</strong> with <strong>${safeHost}</strong> originally scheduled for <strong>${safeDate} at ${safeTime}</strong> has been cancelled.
    </p>

    ${
      safeReason
        ? `
      <div style="background-color: #f8fafc; border-left: 4px solid #94a3b8; padding: 12px 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
        <span style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em;">Reason Provided</span>
        <p style="margin: 4px 0 0 0; font-size: 14px; color: #334155; font-style: italic;">
          "${safeReason}"
        </p>
      </div>
      `
        : ""
    }

    <!-- Appointment Summary Card -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 28px;">
      <tr>
        <td style="padding: 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: #64748b; width: 110px;">Event</td>
              <td style="padding: 6px 0; font-size: 14px; font-weight: 600; color: #0f172a;">${safeTitle}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: #64748b;">Host</td>
              <td style="padding: 6px 0; font-size: 14px; color: #0f172a;">${safeHost}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: #64748b;">Original Date</td>
              <td style="padding: 6px 0; font-size: 14px; color: #0f172a;">${safeDate}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: #64748b;">Original Time</td>
              <td style="padding: 6px 0; font-size: 14px; color: #0f172a;">${safeTime} <span style="font-size: 12px; color: #64748b;">(${safeTimezone})</span></td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: #64748b;">Location</td>
              <td style="padding: 6px 0; font-size: 14px; color: #0f172a;">${safeLocation}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: #64748b;">Ref #</td>
              <td style="padding: 6px 0; font-size: 12px; font-family: monospace; color: #64748b;">${safeBookingId}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <div style="text-align: center; margin-bottom: 24px;">
      ${
        data.rebookUrl
          ? `<a href="${data.rebookUrl}" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">Book Another Time</a>`
          : `<a href="${bookingUrl}" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">View Booking Status</a>`
      }
    </div>
  `;

  const html = renderBaseEmailLayout({
    title: subject,
    previewText: `Cancelled: ${data.eventTitle} with ${data.hostName} on ${data.formattedDate}`,
    contentHtml,
  });

  const text = `
APPOINTMENT CANCELLED

Event: ${data.eventTitle}
Host: ${data.hostName}
Guest: ${data.guestName}
Original Date: ${data.formattedDate}
Original Time: ${data.formattedTime} (${data.hostTimezone})
${data.cancellationReason ? `Reason: ${data.cancellationReason}\n` : ""}Reference #: ${data.bookingId}

View status:
${bookingUrl}

Sent via Slotbook appointment scheduling.
`.trim();

  return { subject, html, text };
}
