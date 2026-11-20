export type EmailProvider = "sendgrid" | "smtp";

export type EmailAddress = {
  email: string;
  name?: string;
};

export type EmailMessage = {
  asmGroupId?: number;
  categories?: string[];
  customArgs?: Record<string, string | number | boolean | null | undefined>;
  to: EmailAddress | EmailAddress[];
  from?: EmailAddress;
  replyTo?: EmailAddress;
  subject: string;
  text: string;
  html?: string;
};

export type EmailDelivery = {
  provider: EmailProvider;
  messageId: string | null;
};
