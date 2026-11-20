import "server-only";

import nodemailer from "nodemailer";

import type { EmailAddress, EmailMessage } from "./types";

function smtpEnvironment() {
  return {
    host: process.env.SMTP_HOST?.trim() || "",
    port: Number(process.env.SMTP_PORT || "465"),
    user: process.env.SMTP_USER?.trim() || "",
  };
}

function smtpPassword() {
  // Passwords may contain meaningful whitespace. Base64 avoids Compose/env-file
  // interpolation of dollar signs and quotes; it is encoding, not encryption.
  if (process.env.SMTP_PASSWORD) return process.env.SMTP_PASSWORD;
  const encoded = process.env.SMTP_PASSWORD_BASE64?.trim();
  if (!encoded) return "";

  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
    throw new Error("SMTP_PASSWORD_BASE64 must contain valid Base64-encoded UTF-8.");
  }
  try {
    const bytes = Buffer.from(encoded, "base64");
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (Buffer.from(decoded, "utf8").toString("base64") !== encoded) throw new Error();
    return decoded;
  } catch {
    throw new Error("SMTP_PASSWORD_BASE64 must contain valid Base64-encoded UTF-8.");
  }
}

function validHost(host: string) {
  return /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(host);
}

export function getSmtpConfigurationStatus() {
  const configuration = smtpEnvironment();
  let hasPassword = false;
  try {
    hasPassword = Boolean(smtpPassword());
  } catch {
    // Invalid inactive SMTP settings must not make the provider switch page
    // unavailable while SendGrid remains selected.
  }

  return {
    smtpConfigured: Boolean(
      validHost(configuration.host) &&
        (configuration.port === 465 || configuration.port === 587) &&
        configuration.user &&
        hasPassword,
    ),
    // A misconfigured connection URL may contain credentials. Only expose a
    // validated hostname in the admin DTO, never the raw rejected value.
    smtpHost: validHost(configuration.host) ? configuration.host : "",
    smtpPort: Number.isInteger(configuration.port) ? configuration.port : 465,
    smtpUser: configuration.user,
  };
}

function createSmtpTransport() {
  const configuration = smtpEnvironment();
  const password = smtpPassword();

  if (!validHost(configuration.host)) {
    throw new Error("Set SMTP_HOST to the mail provider's server hostname.");
  }
  if (configuration.port !== 465 && configuration.port !== 587) {
    throw new Error("SMTP_PORT must be 465 for TLS or 587 for required STARTTLS.");
  }
  if (!configuration.user || !password) {
    throw new Error("Configure SMTP_USER and SMTP_PASSWORD or SMTP_PASSWORD_BASE64 on the server.");
  }

  return nodemailer.createTransport({
    host: configuration.host,
    port: configuration.port,
    secure: configuration.port === 465,
    requireTLS: configuration.port === 587,
    auth: { user: configuration.user, pass: password },
    tls: { rejectUnauthorized: true, minVersion: "TLSv1.2" },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
    logger: false,
    debug: false,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
}

function smtpFailure(error: unknown) {
  const code =
    error && typeof error === "object" && "code" in error && typeof error.code === "string"
      ? error.code
      : "";

  if (code === "EAUTH") {
    return new Error("SMTP authentication failed. Check the mailbox username and password.");
  }
  if (["ETLS", "ESOCKET", "ECONNECTION", "ETIMEDOUT", "EDNS"].includes(code)) {
    return new Error("Could not establish a verified, encrypted SMTP connection. Check the mail server, port, and certificate.");
  }
  // SMTP library errors can contain server responses or private configuration.
  return new Error("SMTP did not confirm email acceptance. Check the mailbox configuration before retrying.");
}

export async function sendSmtpEmail(message: EmailMessage) {
  if (message.asmGroupId !== undefined) {
    throw new Error("SendGrid unsubscribe groups are not supported by the SMTP provider.");
  }

  const transport = createSmtpTransport();

  try {
    const address = (recipient: EmailAddress) => ({
      address: recipient.email,
      name: recipient.name || "",
    });
    const delivery = await transport.sendMail({
      from: message.from ? address(message.from) : undefined,
      to: Array.isArray(message.to) ? message.to.map(address) : address(message.to),
      replyTo: message.replyTo ? address(message.replyTo) : undefined,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });

    if (!delivery.accepted?.length || delivery.rejected?.length) {
      throw new Error("SMTP did not accept every recipient.");
    }

    return { messageId: delivery.messageId || null };
  } catch (error) {
    throw smtpFailure(error);
  } finally {
    transport.close();
  }
}

export async function verifySmtpTransportConnection() {
  const transport = createSmtpTransport();

  try {
    await transport.verify();
  } catch (error) {
    throw smtpFailure(error);
  } finally {
    transport.close();
  }
}
