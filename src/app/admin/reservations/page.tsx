import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "Reservations | Homzie Admin",
  description: "Review paid listing reservations and settlement status.",
};

export default function AdminReservationsPage() {
  notFound();
}
