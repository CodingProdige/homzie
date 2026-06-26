"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { sql } from "@/db";
import { authOptions } from "@/modules/auth/config";

const errorLogIdSchema = z.string().uuid();

async function assertActiveAdmin() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    throw new Error("Sign in as an admin to manage error logs.");
  }

  const [admin] = await sql<
    Array<{ role: "user" | "admin"; status: string }>
  >`
    SELECT role, status
    FROM users
    WHERE id = ${session.user.id}
    LIMIT 1
  `;

  if (!admin || admin.role !== "admin" || admin.status !== "active") {
    throw new Error("Only active admins can manage error logs.");
  }
}

function parseErrorLogId(formData: FormData) {
  return errorLogIdSchema.parse(formData.get("errorLogId"));
}

function revalidateErrorLogViews() {
  revalidatePath("/admin");
  revalidatePath("/admin/logs/error-logs");
}

export async function markErrorLogReadAction(formData: FormData) {
  await assertActiveAdmin();

  const errorLogId = parseErrorLogId(formData);

  await sql`
    UPDATE error_logs
    SET status = 'read',
        read_at = COALESCE(read_at, now()),
        updated_at = now()
    WHERE id = ${errorLogId}::uuid
  `;

  revalidateErrorLogViews();
}

export async function markErrorLogUnreadAction(formData: FormData) {
  await assertActiveAdmin();

  const errorLogId = parseErrorLogId(formData);

  await sql`
    UPDATE error_logs
    SET status = 'unread',
        read_at = NULL,
        updated_at = now()
    WHERE id = ${errorLogId}::uuid
  `;

  revalidateErrorLogViews();
}

export async function pinErrorLogAction(formData: FormData) {
  await assertActiveAdmin();

  const errorLogId = parseErrorLogId(formData);

  await sql`
    UPDATE error_logs
    SET pinned = true,
        updated_at = now()
    WHERE id = ${errorLogId}::uuid
  `;

  revalidateErrorLogViews();
}

export async function unpinErrorLogAction(formData: FormData) {
  await assertActiveAdmin();

  const errorLogId = parseErrorLogId(formData);

  await sql`
    UPDATE error_logs
    SET pinned = false,
        updated_at = now()
    WHERE id = ${errorLogId}::uuid
  `;

  revalidateErrorLogViews();
}

export async function markAllErrorLogsReadAction() {
  await assertActiveAdmin();

  await sql`
    UPDATE error_logs
    SET status = 'read',
        read_at = COALESCE(read_at, now()),
        updated_at = now()
    WHERE status = 'unread'
  `;

  revalidateErrorLogViews();
}
