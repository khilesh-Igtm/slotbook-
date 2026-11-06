import { Resend } from "resend";
import { EmailPayload, EmailProvider, SendEmailResult } from "../email-provider";

/**
 * Production Email Provider using the official Resend SDK.
 */
export class ResendEmailProvider implements EmailProvider {
  public readonly name = "resend";
  private resend: Resend;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) {
      throw new Error(
        "RESEND_API_KEY environment variable is required when EMAIL_PROVIDER is set to 'resend'."
      );
    }
    this.resend = new Resend(apiKey);
  }

  async sendEmail(payload: EmailPayload): Promise<SendEmailResult> {
    const from =
      payload.from ||
      process.env.EMAIL_FROM ||
      "Slotbook <onboarding@resend.dev>";

    try {
      const { data, error } = await this.resend.emails.send(
        {
          from,
          to: payload.to,
          subject: payload.subject,
          html: payload.html,
          text: payload.text,
        },
        payload.idempotencyKey
          ? {
              // Resend SDK supports headers including Idempotency-Key
              headers: {
                "Idempotency-Key": payload.idempotencyKey,
              },
            }
          : undefined
      );

      if (error) {
        throw new Error(`Resend provider error [${error.name}]: ${error.message}`);
      }

      if (!data || !data.id) {
        throw new Error("Resend provider returned empty message ID.");
      }

      return {
        success: true,
        messageId: data.id,
        provider: this.name,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      // Ensure raw API keys or secrets are never propagated in error messages
      const safeMessage = message.replace(/re_[a-zA-Z0-9_]+/g, "re_***");
      throw new Error(`Failed to deliver email via Resend: ${safeMessage}`);
    }
  }
}

