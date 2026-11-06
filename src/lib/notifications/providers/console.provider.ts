import { randomUUID } from "node:crypto";
import { EmailPayload, EmailProvider, SendEmailResult } from "../email-provider";

/**
 * Development & Local Testing Email Provider.
 * Safely outputs email dispatch metadata to the local console without contacting external networks.
 * Delivery is marked successful for local development verification only.
 */
export class ConsoleEmailProvider implements EmailProvider {
  public readonly name = "console";

  async sendEmail(payload: EmailPayload): Promise<SendEmailResult> {
    const messageId = `console-${randomUUID()}`;
    const timestamp = new Date().toISOString();

    // Safely log operational metadata (avoid logging secrets or full HTML)
    console.log(
      `[EMAIL DEV CONSOLE ${timestamp}] Delivered locally | ID: ${messageId} | To: ${payload.to} | Subject: "${payload.subject}"`
    );

    return {
      success: true,
      messageId,
      provider: this.name,
    };
  }
}

