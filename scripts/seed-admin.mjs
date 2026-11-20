import { createHash, randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";
import postgres from "postgres";

const scryptAsync = promisify(scrypt);
const databaseUrl = process.env.DATABASE_URL;
const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;
const adminName = process.env.ADMIN_NAME || "Homzie Admin";
const adminUsername = "homzie.admin";

if (!databaseUrl || !adminEmail || !adminPassword) {
  console.error("DATABASE_URL, ADMIN_EMAIL, and ADMIN_PASSWORD are required.");
  process.exit(1);
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = await scryptAsync(password, salt, 64);

  return `scrypt:${salt}:${Buffer.from(derivedKey).toString("hex")}`;
}

const sql = postgres(databaseUrl, { max: 1 });
const normalizedEmail = adminEmail.toLowerCase();

function fallbackAdminUsername(email) {
  return `${adminUsername}${createHash("sha256").update(email).digest("hex").slice(0, 8)}`;
}

try {
  const passwordHash = await hashPassword(adminPassword);
  const [existingAdmin] = await sql`
    SELECT id
    FROM users
    WHERE email = ${normalizedEmail}
    LIMIT 1
  `;

  if (existingAdmin) {
    await sql`
      UPDATE users
      SET
        name = ${adminName},
        password_hash = ${passwordHash},
        role = 'admin',
        status = 'active',
        email_verified = true,
        updated_at = now()
      WHERE id = ${existingAdmin.id}
    `;
  } else {
    const [existingUsername] = await sql`
      SELECT id
      FROM users
      WHERE username = ${adminUsername}
      LIMIT 1
    `;
    const username = existingUsername
      ? fallbackAdminUsername(normalizedEmail)
      : adminUsername;

    await sql`
      INSERT INTO users (name, username, email, password_hash, role, status, email_verified, updated_at)
      VALUES (
        ${adminName},
        ${username},
        ${normalizedEmail},
        ${passwordHash},
        'admin',
        'active',
        true,
        now()
      )
    `;
  }

  console.log(`Admin user seeded: ${normalizedEmail}`);
} finally {
  await sql.end();
}
