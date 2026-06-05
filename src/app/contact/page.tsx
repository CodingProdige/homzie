import type { Metadata } from "next";
import {
  ChevronRight,
  Clock3,
  Headphones,
  Mail,
  MapPin,
  MessageCircle,
  Send,
  ShieldCheck,
  UsersRound,
} from "lucide-react";

import {
  Eyebrow,
  GradientWord,
  PrimaryLink,
  PublicPageShell,
  publicHeroImage,
  RoundedImage,
} from "@/modules/public-pages/page-shell";

export const metadata: Metadata = {
  title: "Contact Homzie",
  description: "Contact the Homzie team for help, support, and platform questions.",
};

const reachOptions = [
  { icon: Clock3, title: "Phone", detail: "+27 10 123 4567", meta: "Mon - Fri, 8am - 5pm" },
  { icon: Mail, title: "Email", detail: "hello@homzie.co.za", meta: "We reply within 24 hours" },
  { icon: MessageCircle, title: "Live chat", detail: "Chat with our support team", meta: "Available on our website" },
  { icon: MapPin, title: "Head office", detail: "125 Rivonia Road, Sandton", meta: "Johannesburg, 2196" },
  { icon: UsersRound, title: "Follow us", detail: "Stay updated on socials", meta: "Instagram, Facebook, TikTok and more" },
];

const faqs = [
  "How do I list my property on Homzie?",
  "Is it free to list a property?",
  "How do I contact an agent?",
  "How do property reels work?",
  "How do I update or remove my listing?",
];

function Field({
  label,
  placeholder,
  textarea = false,
}: {
  label: string;
  placeholder: string;
  textarea?: boolean;
}) {
  const className =
    "mt-2 w-full rounded-lg border border-border bg-background px-4 py-3 text-sm font-semibold outline-none transition focus:border-primary";

  return (
    <label className="block text-xs font-bold text-muted-foreground">
      {label}
      {textarea ? (
        <textarea className={`${className} min-h-36 resize-y`} placeholder={placeholder} />
      ) : (
        <input className={className} placeholder={placeholder} />
      )}
    </label>
  );
}

export default function ContactPage() {
  return (
    <PublicPageShell>
      <section className="page-body grid gap-8 py-8 sm:py-14 lg:grid-cols-[0.82fr_1.18fr] lg:items-center lg:gap-16 lg:py-20">
        <div className="mx-auto max-w-xl text-center lg:mx-0 lg:text-left">
          <Eyebrow>Contact Us</Eyebrow>
          <h1 className="mt-4 text-balance text-5xl font-black tracking-tight sm:text-6xl">
            We&apos;re here to <GradientWord>help.</GradientWord>
          </h1>
          <p className="mx-auto mt-5 max-w-md text-sm font-semibold leading-7 text-muted-foreground lg:mx-0 lg:text-base">
            Have a question, need support, or want to learn more about Homzie?
            Get in touch with our team. We would love to hear from you.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {[
              ["Quick response", "We reply within 24 hours"],
              ["Human support", "Speak to real people"],
            ].map(([title, text]) => (
              <div key={title} className="flex items-center justify-center gap-3 lg:justify-start">
                <span className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
                  <ShieldCheck className="size-5" />
                </span>
                <span className="text-left">
                  <strong className="block text-sm font-black">{title}</strong>
                  <span className="text-xs font-semibold text-muted-foreground">{text}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="relative aspect-[1.55] overflow-hidden rounded-lg">
          <RoundedImage alt="Modern property exterior" src={publicHeroImage} />
        </div>
      </section>

      <section className="page-body border-t border-border py-8 lg:py-12">
        <div className="grid gap-8 lg:grid-cols-[1fr_0.95fr] lg:gap-16">
          <div>
            <h2 className="text-2xl font-black">Send us a message</h2>
            <p className="mt-2 text-sm font-semibold text-muted-foreground">
              Fill in the form and our team will get back to you.
            </p>
            <form className="mt-6 grid gap-4">
              <Field label="Full name" placeholder="Enter your full name" />
              <Field label="Email address" placeholder="Enter your email" />
              <Field label="Phone number (optional)" placeholder="Enter your phone number" />
              <Field label="Subject" placeholder="What is this regarding?" />
              <Field label="Message" placeholder="Type your message here..." textarea />
              <button
                type="button"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-[image:var(--homzie-gradient)] px-5 text-sm font-black text-white shadow-[0_14px_30px_rgba(123,92,255,0.25)]"
              >
                Send message
                <Send className="size-4" />
              </button>
              <p className="text-center text-xs font-semibold text-muted-foreground">
                Your information is safe with us. We will never share your details.
              </p>
            </form>
          </div>

          <div>
            <h2 className="text-2xl font-black">Other ways to reach us</h2>
            <div className="mt-6 overflow-hidden rounded-lg border border-border bg-card">
              {reachOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <div
                    key={option.title}
                    className="flex items-center gap-4 border-b border-border px-5 py-5 last:border-b-0"
                  >
                    <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-black">{option.title}</h3>
                      <p className="mt-1 text-sm font-semibold text-foreground">{option.detail}</p>
                      <p className="text-xs font-semibold text-muted-foreground">{option.meta}</p>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="page-body py-10 lg:py-16">
        <div className="mx-auto max-w-4xl">
          <div className="text-center">
            <Eyebrow>FAQ</Eyebrow>
            <h2 className="mt-3 text-3xl font-black">Frequently asked questions</h2>
            <p className="mt-2 text-sm font-semibold text-muted-foreground">
              Quick answers to the most common questions.
            </p>
          </div>
          <div className="mt-8 overflow-hidden rounded-lg border border-border bg-card">
            {faqs.map((faq) => (
              <button
                key={faq}
                type="button"
                className="flex w-full items-center justify-between border-b border-border px-5 py-4 text-left text-sm font-black last:border-b-0"
              >
                {faq}
                <ChevronRight className="size-4 text-muted-foreground" />
              </button>
            ))}
          </div>
          <div className="mt-8 flex flex-col gap-4 rounded-lg bg-primary/8 p-6 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
            <div className="flex items-center justify-center gap-4 sm:justify-start">
              <Headphones className="size-10 text-primary" />
              <div>
                <h3 className="text-xl font-black">Still have a question?</h3>
                <p className="text-sm font-semibold text-muted-foreground">
                  Our support team is ready to help you.
                </p>
              </div>
            </div>
            <PrimaryLink href="/messages">Start a live chat</PrimaryLink>
          </div>
        </div>
      </section>
    </PublicPageShell>
  );
}
