import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getServerSession } from "next-auth";

import { sql } from "@/db";
import { authOptions } from "@/modules/auth/config";
import { AdminShell } from "./admin-shell";

type AdminUser = {
  email: string;
  role: "user" | "admin";
  status: string;
};

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
};

async function getAdminUser(userId: string) {
  const [admin] = await sql<AdminUser[]>`
    SELECT email, role, status
    FROM users
    WHERE id = ${userId}
    LIMIT 1
  `;

  return admin;
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/sign-in?callbackUrl=/admin");
  }

  const admin = await getAdminUser(session.user.id);

  if (!admin || admin.role !== "admin" || admin.status !== "active") {
    redirect("/");
  }

  return <AdminShell adminEmail={admin.email}>{children}</AdminShell>;
}
