export const authSessionCookieName =
  process.env.NODE_ENV === "production"
    ? "__Secure-homzie.session-token"
    : "homzie.session-token";

export const authCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
};
