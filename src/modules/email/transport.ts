import "server-only";

import { getStoredEmailSettings } from "@/modules/platform-settings/email-settings";
import type { EmailSettings } from "@/modules/platform-settings/email-settings";

import { sendSendGridEmail } from "./sendgrid";
import { sendSmtpEmail, verifySmtpTransportConnection } from "./smtp";
import type { EmailDelivery, EmailMessage, EmailProvider } from "./types";

export type { EmailAddress, EmailDelivery, EmailMessage, EmailProvider } from "./types";

export class EmailDeliveryError extends Error {
  readonly provider: EmailProvider;

  constructor(provider: EmailProvider, message: string) {
    super(message);
    this.name = "EmailDeliveryError";
    this.provider = provider;
  }
}

export async function sendEmail(
  message: EmailMessage,
  preparedSettings?: EmailSettings,
): Promise<EmailDelivery> {
  // Internal callers may pass the validated settings snapshot they used to log
  // or claim a delivery, so a concurrent provider switch cannot split the two.
  const settings = preparedSettings || await getStoredEmailSettings();
  const provider = settings.provider;
  const outgoing = {
    ...message,
    from: message.from || { email: settings.fromEmail, name: settings.fromName },
    replyTo: message.replyTo || (settings.replyToEmail ? { email: settings.replyToEmail } : undefined),
  };

  try {
    // Choose one provider for this attempt. Never retry through another provider:
    // a timeout can occur after acceptance, and a fallback could duplicate mail.
    const delivery = provider === "smtp"
      ? await sendSmtpEmail(outgoing)
      : await sendSendGridEmail(outgoing);

    return { provider, messageId: delivery.messageId };
  } catch (error) {
    throw new EmailDeliveryError(
      provider,
      error instanceof Error ? error.message : "The email provider did not confirm acceptance.",
    );
  }
}

export async function verifySmtpConnection(): Promise<void> {
  try {
    await verifySmtpTransportConnection();
  } catch (error) {
    throw new EmailDeliveryError(
      "smtp",
      error instanceof Error ? error.message : "Could not verify the SMTP connection.",
    );
  }
}
