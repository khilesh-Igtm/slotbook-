import { escapeHtml, renderBaseEmailLayout } from "./base-layout";

export interface BookingConfirmationTemplateData {
  guestName: string;
  hostName: string;
  eventTitle: string;
  formattedDate: string;
  formattedTime: string;
  hostTimezone: string;
  duration: number;
  location?: string | null;
  bookingId: string;
  baseUrl?: string;
}

export function renderBookingConfirmationEmail(data: BookingConfirmationTemplateData) {
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

  const subject = `Confirmed: ${data.eventTitle} with ${data.hostName}`;

  const contentHtml = `
    <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; color: #0f172a;">
      Your appointment is confirmed!
    </h1>
    <p style="margin: 0 0 24px 0; font-size: 15px; color: #475569;">
      Hi ${safeGuest}, your <strong>${safeTitle}</strong> with <strong>${safeHost}</strong> has been successfully booked.
    </p>

    <!-- Appointment Summary Card -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 28px;">
      <tr>
        <td style="padding: 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: #64748b; width: 110px;">Event</td>
              <td style="padding: 6px 0; font-size: 14px; font-weight: 600; color: #0f172a;">${safeTitle} (${data.duration} min)</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: #64748b;">Host</td>
              <td style="padding: 6px 0; font-size: 14px; color: #0f172a;">${safeHost}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: #64748b;">Date</td>
              <td style="padding: 6px 0; font-size: 14px; font-weight: 600; color: #0f172a;">${safeDate}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: #64748b;">Time</td>
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

    <!-- Call to Action -->
    <div style="text-align: center; margin-bottom: 24px;">
      <a href="${bookingUrl}" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">
        View Appointment Details
      </a>
    </div>

    <p style="margin: 0; font-size: 13px; color: #64748b; text-align: center;">
      Need to make changes? You can view or cancel this appointment from your booking management page.
    </p>
  `;

  const html = renderBaseEmailLayout({
    title: subject,
    previewText: `Confirmed: ${data.eventTitle} with ${data.hostName} on ${data.formattedDate}`,
    contentHtml,
  });

  const text = `
YOUR APPOINTMENT IS CONFIRMED!

Event: ${data.eventTitle} (${data.duration} min)
Host: ${data.hostName}
Guest: ${data.guestName}
Date: ${data.formattedDate}
Time: ${data.formattedTime} (${data.hostTimezone})
Location: ${data.location || "Online Meeting / Web Call"}
Reference #: ${data.bookingId}

View details or manage your appointment:
${bookingUrl}

Sent via Slotbook appointment scheduling.
`.trim();

  return { subject, html, text };
}

