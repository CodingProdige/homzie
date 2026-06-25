import type { Metadata } from "next";
import { getServerSession } from "next-auth";

import { GlobalFooter } from "@/components/global-footer";
import { GlobalHeader } from "@/components/global-header";
import { authOptions } from "@/modules/auth/config";
import { getViewerChrome } from "@/modules/auth/viewer";
import { PwaInstallFlow } from "@/modules/pwa/components/pwa-install";

export const metadata: Metadata = {
  title: "Install Homzie",
  description: "Install Homzie for faster access, buyer alerts, messages, and app-like property discovery.",
};

async function getViewer() {
  const session = await getServerSession(authOptions);

  return getViewerChrome(session?.user?.id);
}

export default async function InstallPage() {
  const viewer = await getViewer();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <GlobalHeader
        viewerHasAgencyWorkspace={viewer.hasAgencyWorkspace}
        viewerRole={viewer.role}
        viewerUsername={viewer.username}
      />
      <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-28 sm:px-6 lg:px-8 lg:pt-32">
        <PwaInstallFlow />
      </main>
      <GlobalFooter viewerRole={viewer.role} viewerUsername={viewer.username} />
    </div>
  );
}
