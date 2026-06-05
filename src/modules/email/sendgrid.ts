import "server-only";

type SendGridEmailAddress = {
  email: string;
  name?: string;
};

type SendGridMessage = {
  to: SendGridEmailAddress | SendGridEmailAddress[];
  from?: SendGridEmailAddress;
  replyTo?: SendGridEmailAddress;
  subject: string;
  text: string;
  html?: string;
};

const sendGridEndpoint = "https://api.sendgrid.com/v3/mail/send";

function getConfiguredSender(): SendGridEmailAddress {
  const email =
    process.env.SENDGRID_FROM_EMAIL ||
    process.env.CONTACT_FROM_EMAIL ||
    process.env.SUPPORT_EMAIL ||
    "hello@homzie.co.za";

  return {
    email,
    name: process.env.SENDGRID_FROM_NAME || "Homzie",
  };
}

function normalizeRecipients(
  recipients: SendGridEmailAddress | SendGridEmailAddress[],
): SendGridEmailAddress[] {
  return Array.isArray(recipients) ? recipients : [recipients];
}

export async function sendSendGridEmail(message: SendGridMessage) {
  const apiKey = process.env.SENDGRID_API_KEY;

  if (!apiKey) {
    throw new Error("SENDGRID_API_KEY is not configured.");
  }

  const response = await fetch(sendGridEndpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [
        {
          to: normalizeRecipients(message.to),
        },
      ],
      from: message.from || getConfiguredSender(),
      ...(message.replyTo ? { reply_to: message.replyTo } : {}),
      subject: message.subject,
      content: [
        { type: "text/plain", value: message.text },
        ...(message.html ? [{ type: "text/html", value: message.html }] : []),
      ],
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`SendGrid request failed with ${response.status}: ${details}`);
  }
}
