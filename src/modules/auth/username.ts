export const usernamePattern = /^[a-z0-9][a-z0-9._]{1,28}[a-z0-9]$/;

export const reservedUsernames = new Set([
  "admin",
  "api",
  "auth",
  "billing",
  "book-viewing",
  "dashboard",
  "discover",
  "for-you",
  "help",
  "homzie",
  "login",
  "logout",
  "register",
  "search",
  "settings",
  "sign-in",
  "sign-up",
  "support",
  "users",
]);

export function normalizeUsername(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._]/g, "")
    .replace(/[._]{2,}/g, ".")
    .replace(/^[._]+|[._]+$/g, "")
    .slice(0, 30);
}

export function usernameFromName(name: string) {
  return normalizeUsername(name.replace(/\s+/g, ""));
}

export function validateUsername(username: string) {
  if (!usernamePattern.test(username)) {
    return "Username must be 3-30 characters and can use lowercase letters, numbers, dots, and underscores.";
  }

  if (reservedUsernames.has(username)) {
    return "That username is reserved.";
  }

  return null;
}
