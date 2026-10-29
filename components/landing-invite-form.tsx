"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";

import { fieldInputClass } from "@/components/ui/field";
import { cn } from "@/lib/utils";

/** "got an invite code?" -> /join?code=… (no backend call here). */
export function LandingInviteForm({
  placeholder,
  buttonLabel,
  className,
}: {
  placeholder: string;
  buttonLabel: string;
  className?: string;
}) {
  const router = useRouter();
  const id = useId();
  const [code, setCode] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = code.trim().toUpperCase();
    router.push(clean ? `/join?code=${encodeURIComponent(clean)}` : "/join");
  };

  return (
    <form onSubmit={handleSubmit} className={cn("flex gap-2 md:gap-3", className)}>
      <label htmlFor={id} className="sr-only">
        invite code
      </label>
      <input
        id={id}
        type="text"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        placeholder={placeholder}
        value={code}
        onChange={(e) => setCode(e.target.value)}
        className={cn(fieldInputClass, "min-w-0 flex-1")}
      />
      <button
        type="submit"
        className="box-border flex-none whitespace-nowrap border-2 border-ink bg-ink px-4 font-grotesk text-xs font-bold uppercase tracking-[0.1em] text-bg transition-opacity hover:opacity-85 md:px-6 md:text-[13px]"
      >
        {buttonLabel}
      </button>
    </form>
  );
}
