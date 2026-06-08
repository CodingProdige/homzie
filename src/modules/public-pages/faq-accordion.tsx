"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { agentSubscriptionPlans } from "@/modules/billing/plans";
import { CurrencyAmount } from "@/modules/currency/currency-amount";

export type FaqItem = {
  answer: ReactNode;
  question: string;
};

const contactFaqs: FaqItem[] = [
  {
    question: "How do I list my property on Homzie?",
    answer:
      "Create an account, subscribe to the Homzie Agent plan, then open Listings and choose New listing. You can add property details, photos, pricing, location, features, and publish when everything looks right.",
  },
  {
    question: "Is it free to list a property?",
    answer: (
      <>
        Buyers can browse for free. To list properties, create reels, and unlock agent tools,
        you need an active Homzie Agent subscription at{" "}
        <span className="font-black text-foreground">
          <CurrencyAmount cents={agentSubscriptionPlans.month.amountCents} />/month
        </span>
        .
      </>
    ),
  },
  {
    question: "How do I contact an agent?",
    answer:
      "Open a listing or agent profile and use the message or contact options shown there. Homzie keeps the conversation connected to the property so the context stays clear.",
  },
  {
    question: "How do property reels work?",
    answer:
      "Property reels are short, visual videos linked to listings or agent profiles. Agents can create reels to showcase a home, highlight key features, and help buyers discover properties faster.",
  },
  {
    question: "How do I update or remove my listing?",
    answer:
      "Go to your profile or Listings area, open the listing, and choose Edit. You can update details, archive the listing, or remove it from active discovery when it is no longer available.",
  },
  {
    question: "Can I save properties and reels?",
    answer:
      "Yes. Use the heart or save actions on listings and reels to keep them on your profile for later. Saved content is available from your account when you are signed in.",
  },
  {
    question: "How does Homzie verify agent performance?",
    answer:
      "Homzie tracks platform activity such as listings, reels, sales proof, and profile performance signals. Agent performance pages are designed to help buyers see proof-backed activity, not just claims.",
  },
  {
    question: "What should I do if something looks wrong on a listing?",
    answer:
      "Use the contact options or report tools where available. Include the listing, agent, and what looks incorrect so the Homzie team can review it quickly.",
  },
  {
    question: "Can I use Homzie on mobile?",
    answer:
      "Yes. Homzie is built for mobile and desktop, including mobile-friendly search, profiles, reels, messages, and saved properties.",
  },
];

export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [openQuestion, setOpenQuestion] = useState(items[0]?.question || "");

  return (
    <div className="mt-8 overflow-hidden rounded-lg border border-border bg-card">
      {items.map((item) => {
        const open = openQuestion === item.question;

        return (
          <div key={item.question} className="border-b border-border last:border-b-0">
            <button
              type="button"
              aria-expanded={open}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-black transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              onClick={() => setOpenQuestion(open ? "" : item.question)}
            >
              <span>{item.question}</span>
              <ChevronDown
                className={cn(
                  "size-4 shrink-0 text-muted-foreground transition-transform",
                  open && "rotate-180 text-primary",
                )}
              />
            </button>
            <div
              className={cn(
                "grid transition-[grid-template-rows,opacity] duration-200",
                open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
              )}
            >
              <div className="overflow-hidden">
                <div className="px-5 pb-5 text-sm font-semibold leading-6 text-muted-foreground">
                  {item.answer}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ContactFaqAccordion() {
  return <FaqAccordion items={contactFaqs} />;
}
