import "server-only";

type SendGridEmailAddress = {
  email: string;
  name?: string;
};

type SendGridMessage = {
  asmGroupId?: number;
  categories?: string[];
  customArgs?: Record<string, string | number | boolean | null | undefined>;
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

function normalizeCustomArgs(
  customArgs?: Record<string, string | number | boolean | null | undefined>,
) {
  if (!customArgs) return undefined;

  const entries = Object.entries(customArgs)
    .filter((entry): entry is [string, string | number | boolean] => {
      const [, value] = entry;

      return value !== null && value !== undefined && value !== "";
    })
    .map(([key, value]) => [key, String(value)]);

  if (entries.length === 0) return undefined;

  return Object.fromEntries(entries);
}

export async function sendSendGridEmail(message: SendGridMessage) {
  const apiKey = process.env.SENDGRID_API_KEY;

  if (!apiKey) {
    throw new Error("SENDGRID_API_KEY is not configured.");
  }

  const customArgs = normalizeCustomArgs(message.customArgs);

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
          ...(customArgs ? { custom_args: customArgs } : {}),
        },
      ],
      from: message.from || getConfiguredSender(),
      ...(message.replyTo ? { reply_to: message.replyTo } : {}),
      ...(message.categories?.length ? { categories: message.categories.slice(0, 10) } : {}),
      ...(message.asmGroupId ? { asm: { group_id: message.asmGroupId } } : {}),
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

  return {
    messageId: response.headers.get("x-message-id"),
  };
}
