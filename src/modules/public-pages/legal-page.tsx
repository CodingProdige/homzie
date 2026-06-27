import type { Metadata } from "next";

import { Eyebrow, PublicPageShell } from "@/modules/public-pages/page-shell";

export type LegalSection = {
  body: string[];
  title: string;
};

export function legalMetadata(title: string, description: string): Metadata {
  return { title, description };
}

export function LegalPage({
  description,
  sections,
  title,
}: {
  description: string;
  sections: LegalSection[];
  title: string;
}) {
  return (
    <PublicPageShell>
      <section className="page-body py-10 lg:py-16">
        <div className="mx-auto max-w-4xl">
          <Eyebrow>Homzie Policy</Eyebrow>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
          <p className="mt-5 max-w-2xl text-sm font-normal leading-7 text-muted-foreground sm:text-base">
            {description}
          </p>
          <p className="mt-4 text-xs font-normal uppercase tracking-[0.08em] text-muted-foreground">
            Last updated: 5 June 2026
          </p>
        </div>
      </section>

      <section className="page-body pb-14 lg:pb-20">
        <div className="mx-auto grid max-w-4xl gap-5">
          {sections.map((section, index) => (
            <article key={section.title} className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <p className="text-xs font-semibold text-primary">
                {String(index + 1).padStart(2, "0")}
              </p>
              <h2 className="mt-2 text-2xl font-semibold">{section.title}</h2>
              <div className="mt-4 space-y-3 text-sm font-normal leading-7 text-muted-foreground">
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </PublicPageShell>
  );
}
