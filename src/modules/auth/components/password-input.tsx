"use client";

import { useState } from "react";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";

import { Input } from "@/components/ui/input";

export function PasswordInput({
  isRegister,
}: {
  isRegister: boolean;
}) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative">
      <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
      <Input
        id="password"
        name="password"
        type={isVisible ? "text" : "password"}
        placeholder={isRegister ? "Create a password" : "Enter your password"}
        autoComplete={isRegister ? "new-password" : "current-password"}
        className="h-12 rounded-md pl-12 pr-12 text-base"
      />
      <button
        type="button"
        aria-label={isVisible ? "Hide password" : "Show password"}
        aria-pressed={isVisible}
        onClick={() => setIsVisible((current) => !current)}
        className="absolute right-4 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
      >
        {isVisible ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
      </button>
    </div>
  );
}
