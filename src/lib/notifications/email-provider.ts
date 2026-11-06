import { ConsoleEmailProvider } from "./providers/console.provider";
import { ResendEmailProvider } from "./providers/resend.provider";

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey?: string;
  from?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId: string;
  provider: string;
}

export interface EmailProvider {
  name: string;
  sendEmail(payload: EmailPayload): Promise<SendEmailResult>;
}

let customProvider: EmailProvider | null = null;

/**
 * Sets an explicit email provider (primarily used for unit & integration testing).
 */
export function setEmailProvider(provider: EmailProvider | null): void {
  customProvider = provider;
}

/**
 * Resolves the active email provider based on configuration.
 */
export function getEmailProvider(): EmailProvider {
  if (customProvider) {
    return customProvider;
  }

  const configured = (process.env.EMAIL_PROVIDER || "console").trim().toLowerCase();

  if (configured === "resend") {
    return new ResendEmailProvider();
  }

  return new ConsoleEmailProvider();
}

