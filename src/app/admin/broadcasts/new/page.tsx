import type { Metadata } from "next";

import { BackButton } from "@/components/back-button";
import { defaultBroadcastBlocks } from "@/modules/broadcasts/types";

import { BroadcastComposer } from "../broadcast-composer";

export const metadata: Metadata = {
  title: "New Broadcast | Homzie Admin",
  description: "Create a Homzie broadcast campaign.",
};

export default function NewBroadcastPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-12 pt-8 sm:px-6 lg:px-8 lg:py-10">
      <BackButton href="/admin/broadcasts" label="Broadcasts" className="mb-6" />

      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
          Broadcasts
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          New broadcast
        </h1>
        <p className="mt-3 max-w-3xl text-sm font-normal leading-7 text-muted-foreground">
          Save the draft to calculate the eligible audience and unlock send
          controls.
        </p>
      </div>

      <BroadcastComposer
        initialBlocks={defaultBroadcastBlocks}
        initialName="Untitled broadcast"
        initialSubject="A fresh Homzie update"
      />
    </main>
  );
}
