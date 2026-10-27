"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** Invite code with a COPY button (copies the bare code). */
export function InviteCodeChip({
  code,
  className,
}: {
  code: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (insecure context / denied): nothing to do.
    }
  };

  return (
    <div
      className={cn(
        "flex items-stretch border-2 border-ink bg-input-white",
        className,
      )}
    >
      <div className="flex items-center px-2.5 font-grotesk text-[9px] font-bold uppercase tracking-[0.1em] text-[#4a5158] md:px-3 md:text-[11px] md:tracking-[0.12em]">
        invite code
      </div>
      <div className="flex-1 border-x-2 border-ink px-3.5 py-2 text-center font-grotesk text-sm font-bold uppercase tracking-[0.18em] md:flex-none md:py-[9px] md:text-[15px]">
        {code}
      </div>
      <button
        type="button"
        onClick={copy}
        className="flex min-w-[64px] items-center justify-center bg-ink px-3 font-grotesk text-[10px] font-bold uppercase tracking-[0.1em] text-bg md:px-3.5 md:text-[11px]"
      >
        {copied ? "copied" : "copy"}
      </button>
    </div>
  );
}
