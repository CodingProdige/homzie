"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Check, Send } from "lucide-react";

import { sendContactMessage, type ContactFormState } from "@/modules/public-pages/contact-actions";
import { cn } from "@/lib/utils";

const initialState: ContactFormState = {
  ok: false,
  message: "",
};

function Field({
  label,
  name,
  placeholder,
  type = "text",
  textarea = false,
  required = true,
}: {
  label: string;
  name: string;
  placeholder: string;
  type?: string;
  textarea?: boolean;
  required?: boolean;
}) {
  const className =
    "mt-2 w-full rounded-lg border border-border bg-background px-4 py-3 text-sm font-normal outline-none transition placeholder:text-muted-foreground/55 focus:border-primary";

  return (
    <label className="block text-xs font-normal text-muted-foreground">
      {label}
      {textarea ? (
        <textarea
          className={`${className} min-h-36 resize-y`}
          name={name}
          placeholder={placeholder}
          required={required}
          maxLength={4000}
        />
      ) : (
        <input
          className={className}
          name={name}
          type={type}
          placeholder={placeholder}
          required={required}
          maxLength={name === "phone" ? 40 : name === "subject" ? 160 : 180}
        />
      )}
    </label>
  );
}

export function ContactForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(sendContactMessage, initialState);
  const [hiddenSubmissionAt, setHiddenSubmissionAt] = useState<number | null>(null);
  const showSuccess = Boolean(
    state.ok && state.submittedAt && state.submittedAt !== hiddenSubmissionAt,
  );

  useEffect(() => {
    if (!state.ok || !state.submittedAt) {
      return;
    }

    formRef.current?.reset();

    const timeout = window.setTimeout(() => {
      setHiddenSubmissionAt(state.submittedAt || null);
    }, 4200);

    return () => window.clearTimeout(timeout);
  }, [state.ok, state.submittedAt]);

  const statusMessage = showSuccess ? state.message : state.ok ? "" : state.message;

  return (
    <form ref={formRef} action={formAction} className="mt-6 grid gap-4">
      <Field label="Full name" name="name" placeholder="Enter your full name" />
      <Field label="Email address" name="email" type="email" placeholder="Enter your email" />
      <Field
        label="Phone number (optional)"
        name="phone"
        type="tel"
        placeholder="Enter your phone number"
        required={false}
      />
      <Field label="Subject" name="subject" placeholder="What is this regarding?" />
      <Field label="Message" name="message" placeholder="Type your message here..." textarea />
      <button
        type="submit"
        disabled={pending || showSuccess}
        className={cn(
          "inline-flex h-12 items-center justify-center gap-2 rounded-md bg-[image:var(--homzie-gradient)] px-5 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(123,92,255,0.25)] transition",
          (pending || showSuccess) && "cursor-not-allowed opacity-80",
        )}
      >
        {pending ? "Sending..." : showSuccess ? "Message sent" : "Send message"}
        {showSuccess ? <Check className="size-4" /> : <Send className="size-4" />}
      </button>
      {statusMessage ? (
        <p
          className={cn(
            "rounded-md px-4 py-3 text-center text-xs font-bold",
            showSuccess
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "bg-destructive/10 text-destructive",
          )}
          aria-live="polite"
        >
          {statusMessage}
        </p>
      ) : null}
      <p className="text-center text-xs font-normal text-muted-foreground">
        Your information is safe with us. We will never share your details.
      </p>
    </form>
  );
}
