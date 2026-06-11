import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { getStoredMusicApiSettings } from "@/modules/platform-settings/music-api-settings";
import {
  AdminMusicApiSettingsForm,
  type AdminMusicApiSettingsView,
} from "../../admin-music-api-settings-form";

export const metadata: Metadata = {
  title: "Music API Settings | Homzie Admin",
  description: "Manage Jamendo and Freesound API credentials for Homzie.",
};

export default async function AdminMusicSettingsPage() {
  const settings = await getStoredMusicApiSettings();

  const view: AdminMusicApiSettingsView = {
    jamendoClientId: settings.jamendoClientId,
    freesoundApiKey: settings.freesoundApiKey,
  };

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-12 pt-8 sm:px-6 lg:px-8 lg:py-10">
      <Link
        href="/admin/settings"
        className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground transition-colors hover:text-primary"
      >
        <ChevronLeft className="size-4" />
        Settings
      </Link>

      <div className="mt-6">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-primary">
          Music
        </p>
        <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
          Music APIs
        </h1>
        <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-muted-foreground">
          Configure API credentials for Jamendo and Freesound so reel creators
          can browse and preview tracks from these libraries.
        </p>
      </div>

      <section className="mt-8 rounded-lg border border-border bg-card p-5 shadow-sm">
        <AdminMusicApiSettingsForm settings={view} />
      </section>
    </main>
  );
}
