import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "Reservation Details | Homzie Admin",
  description: "Review a listing reservation and record settlement proof.",
};

export default function AdminReservationDetailsPage() {
  notFound();
}
