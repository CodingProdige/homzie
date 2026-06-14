import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "Reservation Settings | Homzie Admin",
  description: "Manage listing reservation fees and checkout settings.",
};

export default function AdminReservationSettingsPage() {
  notFound();
}
