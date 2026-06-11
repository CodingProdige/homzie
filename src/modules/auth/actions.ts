"use server";

import { createHash, randomBytes } from "node:crypto";

import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { passwordResetTokens, users } from "@/db/schema";
import {
  absoluteAppUrl,
  sendTemplatedEmailToUser,
} from "@/modules/email/server";
import { authOptions } from "./config";
import { hashPassword } from "./password";
import { authCookieOptions, authSessionCookieName } from "./session-cookie";
import { normalizeUsername, validateUsername } from "./username";

export type UsernameAvailability =
  | { status: "empty"; username: "" }
  | { status: "invalid"; username: string; message: string }
  | { status: "taken"; username: string; message: string }
  | { status: "available"; username: string; message: string };

export type AuthActionResult =
  | { ok: true }
  | { ok: false; error: string };

export type UsernameActionResult =
  | { ok: true; username: string }
  | { ok: false; error: string };

const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name."),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

const usernameSchema = z.object({
  username: z.string().trim().min(1, "Choose a username."),
});

const passwordResetRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
});

const resetPasswordSchema = z
  .object({
    confirmPassword: z.string().min(1, "Confirm your new password."),
    password: z.string().min(8, "Password must be at least 8 characters."),
    token: z.string().min(32, "This password reset link is invalid."),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

const passwordResetTokenLifetimeMs = 30 * 60 * 1000;

function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function getFirstName(name: string) {
  return name.split(/\s+/)[0] || name;
}

export async function checkUsernameAvailability(
  value: string,
): Promise<UsernameAvailability> {
  const username = normalizeUsername(value);

  if (!username) {
    return { status: "empty", username: "" };
  }

  const validationMessage = validateUsername(username);

  if (validationMessage) {
    return {
      status: "invalid",
      username,
      message: validationMessage,
    };
  }

  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (existingUser) {
    return {
      status: "taken",
      username,
      message: "That username is already taken.",
    };
  }

  return {
    status: "available",
    username,
    message: "Username is available.",
  };
}

export async function registerWithEmail(input: {
  name: string;
  email: string;
  password: string;
}): Promise<AuthActionResult> {
  const parsed = registerSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message || "Check your details and try again.",
    };
  }

  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, parsed.data.email))
    .limit(1);

  if (existingUser) {
    return {
      ok: false,
      error: "An account already exists for that email address.",
    };
  }

  const passwordHash = await hashPassword(parsed.data.password);

  try {
    const [createdUser] = await db
      .insert(users)
      .values({
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash,
        emailVerified: false,
      })
      .returning({ id: users.id, name: users.name });

    if (createdUser) {
      await sendTemplatedEmailToUser({
        bypassPreferences: true,
        eventKey: "auth.welcome",
        templateKey: "auth.welcome",
        userId: createdUser.id,
        variables: {
          app: {
            name: "Homzie",
            url: absoluteAppUrl("/"),
          },
          dashboardUrl: absoluteAppUrl("/"),
          user: {
            firstName: createdUser.name.split(/\s+/)[0] || createdUser.name,
            name: createdUser.name,
          },
        },
      }).catch((error) => {
        console.error("[email] welcome failed", error);
      });
    }
  } catch {
    return {
      ok: false,
      error: "Could not create your account. Please try again.",
    };
  }

  return { ok: true };
}

export async function requestPasswordReset(
  _previousState: AuthActionResult,
  formData: FormData,
): Promise<AuthActionResult> {
  const parsed = passwordResetRequestSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message || "Enter a valid email address.",
    };
  }

  const genericSuccess = { ok: true } satisfies AuthActionResult;
  const [user] = await db
    .select({
      email: users.email,
      id: users.id,
      name: users.name,
      passwordHash: users.passwordHash,
      status: users.status,
    })
    .from(users)
    .where(eq(users.email, parsed.data.email))
    .limit(1);

  if (!user || user.status !== "active" || !user.passwordHash) {
    return genericSuccess;
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashResetToken(token);
  const expiresAt = new Date(Date.now() + passwordResetTokenLifetimeMs);
  const now = new Date();

  await db
    .update(passwordResetTokens)
    .set({ usedAt: now })
    .where(
      and(
        eq(passwordResetTokens.userId, user.id),
        isNull(passwordResetTokens.usedAt),
      ),
    );

  await db.insert(passwordResetTokens).values({
    expiresAt,
    tokenHash,
    userId: user.id,
  });

  await sendTemplatedEmailToUser({
    bypassPreferences: true,
    eventKey: "security.password_reset_requested",
    templateKey: "security.password_reset_requested",
    userId: user.id,
    variables: {
      app: {
        name: "Homzie",
        url: absoluteAppUrl("/"),
      },
      reset: {
        expiresIn: "30 minutes",
        url: absoluteAppUrl(`/reset-password?token=${encodeURIComponent(token)}`),
      },
      user: {
        firstName: getFirstName(user.name),
        name: user.name,
      },
    },
  }).catch((error) => {
    console.error("[email] password reset link failed", error);
  });

  return genericSuccess;
}

export async function validatePasswordResetToken(token: string) {
  if (!token || token.length < 32) {
    return null;
  }

  const [resetToken] = await db
    .select({
      expiresAt: passwordResetTokens.expiresAt,
      userId: passwordResetTokens.userId,
    })
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.tokenHash, hashResetToken(token)),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);

  return resetToken || null;
}

export async function resetPasswordWithToken(
  _previousState: AuthActionResult,
  formData: FormData,
): Promise<AuthActionResult> {
  const parsed = resetPasswordSchema.safeParse({
    confirmPassword: formData.get("confirmPassword"),
    password: formData.get("password"),
    token: formData.get("token"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message || "Check your new password.",
    };
  }

  const tokenHash = hashResetToken(parsed.data.token);
  const [resetToken] = await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, new Date()),
      ),
    )
    .returning({ userId: passwordResetTokens.userId });

  if (!resetToken) {
    return {
      ok: false,
      error: "This password reset link has expired or has already been used.",
    };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const [updatedUser] = await db
    .update(users)
    .set({
      passwordHash,
      updatedAt: new Date(),
    })
    .where(eq(users.id, resetToken.userId))
    .returning({
      id: users.id,
      name: users.name,
    });

  if (updatedUser) {
    await db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(passwordResetTokens.userId, updatedUser.id),
          isNull(passwordResetTokens.usedAt),
        ),
      );

    await sendTemplatedEmailToUser({
      bypassPreferences: true,
      eventKey: "security.password_changed",
      templateKey: "security.password_changed",
      userId: updatedUser.id,
      variables: {
        app: {
          name: "Homzie",
          url: absoluteAppUrl("/"),
        },
        user: {
          firstName: getFirstName(updatedUser.name),
          name: updatedUser.name,
        },
      },
    }).catch((error) => {
      console.error("[email] password changed failed", error);
    });
  }

  return { ok: true };
}

export async function setSessionCookiePersistence(keepSignedIn: boolean) {
  if (keepSignedIn) {
    return { ok: true };
  }

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(authSessionCookieName);

  if (!sessionCookie?.value) {
    return { ok: true };
  }

  cookieStore.set(authSessionCookieName, sessionCookie.value, {
    ...authCookieOptions,
  });

  return { ok: true };
}

export async function completeUsername(input: {
  username: string;
}): Promise<UsernameActionResult> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return {
      ok: false,
      error: "Sign in to finish setting up your account.",
    };
  }

  const parsed = usernameSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message || "Choose a username.",
    };
  }

  const username = normalizeUsername(parsed.data.username);
  const validationMessage = validateUsername(username);

  if (validationMessage) {
    return {
      ok: false,
      error: validationMessage,
    };
  }

  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (existingUser && existingUser.id !== session.user.id) {
    return {
      ok: false,
      error: "That username is already taken.",
    };
  }

  try {
    await db
      .update(users)
      .set({
        username,
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.user.id));
  } catch {
    return {
      ok: false,
      error: "Could not save that username. Please try again.",
    };
  }

  return {
    ok: true,
    username,
  };
}
