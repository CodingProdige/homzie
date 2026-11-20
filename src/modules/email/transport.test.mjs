import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const typescript = require("typescript");
const zod = require("zod");

// Load the actual TypeScript sources with every I/O dependency replaced. These
// tests cannot open a database, connect to SMTP, or call an external HTTP API.
function load(source, imports, environment = {}, fetch = () => {
  throw new Error("Unexpected network request in email unit test.");
}) {
  const filename = new URL(source, import.meta.url);
  const compiled = typescript.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      target: typescript.ScriptTarget.ES2020,
      module: typescript.ModuleKind.CommonJS,
      esModuleInterop: true,
    },
  }).outputText;
  const loaded = { exports: {} };
  const isolatedRequire = (name) => {
    if (name === "server-only") return {};
    if (Object.hasOwn(imports, name)) return imports[name];
    throw new Error("Unexpected module in isolated email test: " + name);
  };
  new Function("require", "module", "exports", "process", "fetch", compiled)(
    isolatedRequire, loaded, loaded.exports, { env: environment }, fetch,
  );
  return loaded.exports;
}

const settings = {
  provider: "sendgrid",
  fromEmail: "hello@example.test",
  fromName: "Homzie test",
  replyToEmail: "support@example.test",
};
const message = {
  to: { email: "recipient@example.test", name: "Recipient" },
  subject: "Isolated test",
  text: "This never leaves the test process.",
  html: "<p>This never leaves the test process.</p>",
  categories: ["broadcast"],
  customArgs: { campaign_id: "campaign-test", campaign_recipient_id: "recipient-test" },
};

function transport(provider, sendgrid, smtp, verify = async () => {}) {
  let settingsReads = 0;
  const loaded = load("./transport.ts", {
    "@/modules/platform-settings/email-settings": {
      getStoredEmailSettings: async () => {
        settingsReads += 1;
        return { ...settings, provider };
      },
    },
    "./sendgrid": { sendSendGridEmail: sendgrid },
    "./smtp": { sendSmtpEmail: smtp, verifySmtpTransportConnection: verify },
  });
  return { ...loaded, settingsReads: () => settingsReads };
}

test("SendGrid selection preserves metadata and applies shared sender settings once", async () => {
  let outgoing;
  const delivery = transport("sendgrid", async (value) => {
    outgoing = value;
    return { messageId: "sendgrid-id" };
  }, async () => assert.fail("SMTP must not be called"));
  assert.deepEqual(await delivery.sendEmail(message), { provider: "sendgrid", messageId: "sendgrid-id" });
  assert.equal(delivery.settingsReads(), 1);
  assert.deepEqual(outgoing.customArgs, message.customArgs);
  assert.deepEqual(outgoing.categories, message.categories);
  assert.deepEqual(outgoing.from, { email: settings.fromEmail, name: settings.fromName });
  assert.deepEqual(outgoing.replyTo, { email: settings.replyToEmail });
});

test("SMTP selection preserves explicit address overrides", async () => {
  let outgoing;
  const delivery = transport("smtp", async () => assert.fail("SendGrid must not be called"), async (value) => {
    outgoing = value;
    return { messageId: "smtp-id" };
  });
  const from = { email: "override@example.test" };
  const replyTo = { email: "reply@example.test" };
  assert.deepEqual(await delivery.sendEmail({ ...message, from, replyTo }), { provider: "smtp", messageId: "smtp-id" });
  assert.deepEqual(outgoing.from, from);
  assert.deepEqual(outgoing.replyTo, replyTo);
});

test("A prepared settings snapshot pins the provider across a concurrent switch", async () => {
  const delivery = transport("sendgrid", async () => assert.fail("Current provider must not replace the snapshot"),
    async () => ({ messageId: "pinned-smtp-id" }));
  assert.deepEqual(await delivery.sendEmail(message, { ...settings, provider: "smtp" }),
    { provider: "smtp", messageId: "pinned-smtp-id" });
  assert.equal(delivery.settingsReads(), 0);
});

for (const provider of ["sendgrid", "smtp"]) {
  test(`${provider} failure retains provider attribution and never falls back`, async () => {
    let fallbackCalls = 0;
    const failing = async () => { throw new Error("Acceptance is uncertain; do not retry automatically."); };
    const fallback = async () => { fallbackCalls += 1; return { messageId: "unexpected" }; };
    const delivery = transport(provider,
      provider === "sendgrid" ? failing : fallback,
      provider === "smtp" ? failing : fallback);
    await assert.rejects(delivery.sendEmail(message), (error) =>
      error instanceof delivery.EmailDeliveryError && error.provider === provider);
    assert.equal(fallbackCalls, 0);
  });
}

test("SMTP verification never invokes a send adapter", async () => {
  let checks = 0;
  const forbidden = async () => assert.fail("Verification must not send mail");
  const delivery = transport("sendgrid", forbidden, forbidden, async () => { checks += 1; });
  assert.equal(await delivery.verifySmtpConnection(), undefined);
  assert.equal(checks, 1);
  assert.equal(delivery.settingsReads(), 0);
});

const smtpEnvironment = {
  SMTP_HOST: "smtp.example.test",
  SMTP_PORT: "465",
  SMTP_USER: "hello@example.test",
  SMTP_PASSWORD: " unit-test-only-password ",
};

function smtpModule(environment = {}, behavior = {}) {
  const state = { configurations: [], messages: [], closed: 0, verified: 0 };
  const loaded = load("./smtp.ts", {
    nodemailer: {
      createTransport: (configuration) => {
        state.configurations.push(configuration);
        return {
          sendMail: async (value) => {
            state.messages.push(value);
            if (behavior.sendFailure) throw behavior.sendFailure;
            return { accepted: ["recipient@example.test"], rejected: [], messageId: "smtp-accepted" };
          },
          verify: async () => {
            state.verified += 1;
            if (behavior.verifyFailure) throw behavior.verifyFailure;
            return true;
          },
          close: () => { state.closed += 1; },
        };
      },
    },
  }, { ...smtpEnvironment, ...environment });
  return { ...loaded, state };
}

test("SMTP 465 uses immediate verified TLS, private auth, and Nodemailer address shapes", async () => {
  const smtp = smtpModule();
  await smtp.sendSmtpEmail({ ...message, from: { email: settings.fromEmail, name: settings.fromName } });
  const configuration = smtp.state.configurations[0];
  assert.equal(configuration.secure, true);
  assert.equal(configuration.requireTLS, false);
  assert.equal(configuration.tls.rejectUnauthorized, true);
  assert.equal(configuration.tls.minVersion, "TLSv1.2");
  assert.equal(configuration.auth.pass, smtpEnvironment.SMTP_PASSWORD);
  assert.equal(configuration.debug, false);
  assert.equal(configuration.disableFileAccess, true);
  assert.equal(configuration.disableUrlAccess, true);
  assert.deepEqual(smtp.state.messages[0].to, { address: message.to.email, name: message.to.name });
  assert.equal(smtp.state.closed, 1);
});

test("SMTP 587 requires STARTTLS and closes failed connections without exposing responses", async () => {
  const failure = Object.assign(new Error("server response containing unit-test-only-password"), { code: "EAUTH" });
  const smtp = smtpModule({ SMTP_PORT: "587" }, { sendFailure: failure });
  await assert.rejects(smtp.sendSmtpEmail(message), (error) =>
    error.message.includes("authentication failed") && !error.message.includes("unit-test-only-password"));
  assert.equal(smtp.state.configurations[0].secure, false);
  assert.equal(smtp.state.configurations[0].requireTLS, true);
  assert.equal(smtp.state.configurations[0].tls.rejectUnauthorized, true);
  assert.equal(smtp.state.closed, 1);
});

test("SMTP refuses unsupported ports, missing credentials, and SendGrid ASM before sending", async () => {
  for (const environment of [{ SMTP_PORT: "25" }, { SMTP_PASSWORD: "" }, { SMTP_HOST: "smtp://user:password@example.test" }]) {
    const smtp = smtpModule(environment);
    const status = smtp.getSmtpConfigurationStatus();
    assert.equal(status.smtpConfigured, false);
    if (environment.SMTP_HOST) {
      assert.equal(status.smtpHost, "");
      assert.equal(JSON.stringify(status).includes(environment.SMTP_HOST), false);
      assert.equal(JSON.stringify(status).includes("user:password"), false);
    }
    await assert.rejects(smtp.sendSmtpEmail(message));
    assert.equal(smtp.state.configurations.length, 0);
  }
  const smtp = smtpModule();
  await assert.rejects(smtp.sendSmtpEmail({ ...message, asmGroupId: 42 }), /unsubscribe groups/);
  assert.equal(smtp.state.configurations.length, 0);
});

test("SMTP connection check authenticates without constructing a message", async () => {
  const smtp = smtpModule();
  await smtp.verifySmtpTransportConnection();
  assert.equal(smtp.state.verified, 1);
  assert.equal(smtp.state.messages.length, 0);
  assert.equal(smtp.state.closed, 1);
});

test("Base64 SMTP passwords preserve dollar signs, quotes, Unicode and whitespace", async () => {
  const password = "  unit-test-$dollar-'single'-\"double\"-\\-é\n ";
  const encoded = Buffer.from(password, "utf8").toString("base64");
  const smtp = smtpModule({ SMTP_PASSWORD: "", SMTP_PASSWORD_BASE64: encoded });
  assert.equal(smtp.getSmtpConfigurationStatus().smtpConfigured, true);
  await smtp.verifySmtpTransportConnection();
  assert.equal(smtp.state.configurations[0].auth.pass, password);
  assert.equal(smtp.state.messages.length, 0);

  const plaintext = smtpModule({ SMTP_PASSWORD: "plaintext-wins", SMTP_PASSWORD_BASE64: encoded });
  await plaintext.verifySmtpTransportConnection();
  assert.equal(plaintext.state.configurations[0].auth.pass, "plaintext-wins");
});

test("SMTP errors disclose neither decoded nor encoded passwords", async () => {
  const password = "unit-test-$secret-'quote'";
  const encoded = Buffer.from(password, "utf8").toString("base64");
  const smtp = smtpModule({ SMTP_PASSWORD: "", SMTP_PASSWORD_BASE64: encoded }, {
    verifyFailure: new Error("Server echoed " + password + " and " + encoded),
  });
  await assert.rejects(smtp.verifySmtpTransportConnection(), (error) =>
    !error.message.includes(password) && !error.message.includes(encoded));
  const invalid = smtpModule({ SMTP_PASSWORD: "", SMTP_PASSWORD_BASE64: "not-valid-base64!" });
  assert.equal(invalid.getSmtpConfigurationStatus().smtpConfigured, false);
  await assert.rejects(invalid.verifySmtpTransportConnection(), /valid Base64/);
  assert.equal(invalid.state.configurations.length, 0);
});

function settingsModule(stored, environment = {}) {
  const saved = [];
  const query = {
    from() { return this; },
    where() { return this; },
    async limit() { return stored === undefined ? [] : [{ value: stored }]; },
  };
  const loaded = load("../platform-settings/email-settings.ts", {
    "drizzle-orm": { eq: () => null },
    zod,
    "@/db": {
      db: {
        select: () => query,
        insert: () => ({
          values: (value) => ({
            onConflictDoUpdate: async () => { saved.push(value); },
          }),
        }),
      },
    },
    "@/db/schema": { platformSettings: { key: "key", value: "value" } },
    "@/modules/email/smtp": {
      getSmtpConfigurationStatus: () => ({
        smtpConfigured: true, smtpHost: "smtp.example.test", smtpPort: 465, smtpUser: "hello@example.test",
      }),
    },
  }, environment);
  return { ...loaded, saved };
}

test("Settings keep credentials server-side and use environment defaults for absent values", async () => {
  const loaded = settingsModule(undefined, {
    EMAIL_PROVIDER: "smtp", EMAIL_FROM_EMAIL: "hello@example.test", EMAIL_FROM_NAME: "Test sender",
    SENDGRID_API_KEY: "unit-test-sendgrid-secret", SMTP_PASSWORD: "unit-test-smtp-secret",
  });
  const view = await loaded.getEmailSettingsView();
  assert.equal(view.provider, "smtp");
  assert.equal(view.fromEmail, "hello@example.test");
  assert.equal(view.sendgridConfigured, true);
  assert.equal(view.smtpConfigured, true);
  assert.deepEqual(Object.keys(view).sort(), [
    "provider", "fromEmail", "fromName", "replyToEmail", "sendgridConfigured", "smtpConfigured", "smtpHost", "smtpPort", "smtpUser",
  ].sort());
  assert.equal(JSON.stringify(view).includes("unit-test-"), false);
});

test("Settings preserve explicit empty reply-to and persist no transport credentials", async () => {
  const loaded = settingsModule({ ...settings, replyToEmail: "" }, { EMAIL_REPLY_TO_EMAIL: "environment@example.test" });
  assert.equal((await loaded.getStoredEmailSettings()).replyToEmail, "");
  await loaded.saveStoredEmailSettings({ ...settings, provider: "smtp", replyToEmail: "" });
  assert.deepEqual(loaded.saved[0].value, { ...settings, provider: "smtp", replyToEmail: "" });
});

test("Settings reject invalid providers and header injection without changing saved settings", async () => {
  const loaded = settingsModule();
  await assert.rejects(loaded.saveStoredEmailSettings({ ...settings, fromName: "Sender\r\nBcc: victim@example.test" }));
  assert.equal(loaded.saved.length, 0);
  await assert.rejects(settingsModule(undefined, { EMAIL_PROVIDER: "unknown" }).getStoredEmailSettings(), /EMAIL_PROVIDER/);
  await assert.rejects(settingsModule(undefined, { EMAIL_FROM_EMAIL: "\r\n" }).getStoredEmailSettings(), /Invalid email setting/);
});

test("SendGrid adapter retains correlation, categories and unsubscribe metadata", async () => {
  let payload;
  const loaded = load("./sendgrid.ts", {}, { SENDGRID_API_KEY: "unit-test-sendgrid-secret" }, async (url, request) => {
    assert.equal(url, "https://api.sendgrid.com/v3/mail/send");
    payload = JSON.parse(request.body);
    return { ok: true, headers: new Headers({ "x-message-id": "sendgrid-correlated" }) };
  });
  assert.deepEqual(await loaded.sendSendGridEmail({
    ...message, from: { email: "configured@example.test" }, asmGroupId: 42,
    customArgs: { ...message.customArgs, numeric: 9, bool: false, omitted: null },
  }), { messageId: "sendgrid-correlated" });
  assert.deepEqual(payload.categories, message.categories);
  assert.deepEqual(payload.asm, { group_id: 42 });
  assert.equal(payload.personalizations[0].custom_args.campaign_id, "campaign-test");
  assert.equal(payload.personalizations[0].custom_args.numeric, "9");
  assert.equal(payload.personalizations[0].custom_args.bool, "false");
  assert.equal(Object.hasOwn(payload.personalizations[0].custom_args, "omitted"), false);
  assert.equal(payload.from.email, "configured@example.test");
});
