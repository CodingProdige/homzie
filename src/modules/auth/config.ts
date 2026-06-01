import { eq } from "drizzle-orm";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { z } from "zod";

import { db } from "@/db";
import { users } from "@/db/schema";
import { ingestGoogleAvatar } from "@/media/avatar-ingest";
import { toPublicMediaUrl, toStoredMediaPath } from "@/media/paths";
import { verifyPassword } from "./password";
import { authCookieOptions, authSessionCookieName } from "./session-cookie";

if (!process.env.NEXTAUTH_URL && process.env.AUTH_URL) {
  process.env.NEXTAUTH_URL = process.env.AUTH_URL;
}

const credentialsSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1),
});

const providers: NextAuthOptions["providers"] = [
  CredentialsProvider({
    name: "Email and password",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const parsed = credentialsSchema.safeParse(credentials);

      if (!parsed.success) {
        return null;
      }

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, parsed.data.email))
        .limit(1);

      if (!user || user.status !== "active" || !user.passwordHash) {
        return null;
      }

      const isValidPassword = await verifyPassword(
        parsed.data.password,
        user.passwordHash,
      );

      if (!isValidPassword) {
        return null;
      }

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        image: toPublicMediaUrl(user.avatarUrl) || undefined,
        username: user.username || undefined,
        role: user.role,
      };
    },
  }),
];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  );
}

export const authOptions: NextAuthOptions = {
  secret: process.env.AUTH_SECRET,
  pages: {
    signIn: "/sign-in",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  cookies: {
    sessionToken: {
      name: authSessionCookieName,
      options: {
        ...authCookieOptions,
      },
    },
  },
  providers,
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google" || !user.email) {
        return true;
      }

      const email = user.email.toLowerCase();
      const storedGoogleAvatarPath = await ingestGoogleAvatar(user.image);
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existingUser) {
        const avatarUrl =
          storedGoogleAvatarPath || toStoredMediaPath(existingUser.avatarUrl);

        await db
          .update(users)
          .set({
            name: user.name || existingUser.name,
            avatarUrl,
            emailVerified: true,
            updatedAt: new Date(),
          })
          .where(eq(users.id, existingUser.id));

        user.id = existingUser.id;
        user.image = toPublicMediaUrl(avatarUrl) || undefined;
        user.username = existingUser.username || undefined;
        user.role = existingUser.role;
        return true;
      }

      const [createdUser] = await db
        .insert(users)
        .values({
          name: user.name || email.split("@")[0] || "Homzie User",
          email,
          avatarUrl: storedGoogleAvatarPath,
          emailVerified: true,
        })
        .returning();

      user.id = createdUser.id;
      user.image = toPublicMediaUrl(storedGoogleAvatarPath) || undefined;
      user.username = undefined;
      user.role = createdUser.role;
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.username = user.username;
        token.picture = toPublicMediaUrl(user.image) || null;
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub || "";
        session.user.role = token.role;
        session.user.username = token.username;
        session.user.image = toPublicMediaUrl(token.picture) || null;
      }

      return session;
    },
  },
};
