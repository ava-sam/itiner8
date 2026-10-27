"use client";

import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { useCallback, useRef, useState } from "react";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/**
 * Turnstile state for a form. When NEXT_PUBLIC_TURNSTILE_SITE_KEY is unset the
 * widget is not rendered and `token` stays null, so callers pass
 * `captchaToken: token ?? undefined` and everything works with Supabase
 * CAPTCHA protection switched off. Tokens are single-use: call `reset()` after
 * every attempt that reached Supabase.
 */
export function useTurnstile() {
  const ref = useRef<TurnstileInstance>(null);
  const [token, setToken] = useState<string | null>(null);

  const reset = useCallback(() => {
    setToken(null);
    ref.current?.reset();
  }, []);

  return { ref, token, setToken, reset, enabled: Boolean(SITE_KEY) };
}

export type TurnstileState = ReturnType<typeof useTurnstile>;

export function TurnstileField({ state }: { state: TurnstileState }) {
  if (!SITE_KEY) return null;

  return (
    <Turnstile
      ref={state.ref}
      siteKey={SITE_KEY}
      onSuccess={state.setToken}
      onExpire={() => state.setToken(null)}
      onError={() => state.setToken(null)}
      options={{ theme: "light", size: "flexible" }}
    />
  );
}
