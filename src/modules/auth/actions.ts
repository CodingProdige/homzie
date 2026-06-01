"use server";

import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { users } from "@/db/schema";
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
    await db.insert(users).values({
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
      emailVerified: false,
    });
  } catch {
    return {
      ok: false,
      error: "Could not create your account. Please try again.",
    };
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
