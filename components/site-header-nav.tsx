"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { LogoutButton } from "@/components/logout-button";

export type HeaderAuthState = {
  signedIn: boolean;
  isAnonymous: boolean;
  userId: string | null;
  displayName: string | null;
};

const buttonBase =
  "box-border inline-flex h-8 items-center justify-center border-2 border-ink px-3 font-grotesk text-[11px] font-bold uppercase tracking-[0.08em] transition-opacity hover:opacity-85 md:h-9 md:px-4 md:text-xs";
export const headerPrimary = cn(buttonBase, "bg-ink text-bg");
export const headerSecondary = cn(buttonBase, "bg-input-white text-ink");

/**
 * The header lives in the root layout, which Next.js does not re-render on
 * client-side navigation — so after logging in (or out) a purely
 * server-rendered header keeps showing the old state until a hard reload.
 * The server passes the initial state (no flash on first paint); this
 * component then follows the browser's auth session.
 */
export function SiteHeaderNav({ initial }: { initial: HeaderAuthState }) {
  const [auth, setAuth] = useState(initial);

  useEffect(() => {
    const { data } = createClient().auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setAuth({ signedIn: false, isAnonymous: false, userId: null, displayName: null });
        return;
      }
      // INITIAL_SESSION without a session says nothing new; trust the server state.
      if (!session) return;
      setAuth((prev) => ({
        signedIn: true,
        isAnonymous: Boolean(session.user.is_anonymous),
        userId: session.user.id,
        displayName: prev.userId === session.user.id ? prev.displayName : null,
      }));
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // Fetched outside the auth callback (supabase-js can deadlock if you call
  // back into the client from inside it).
  const { signedIn, userId, displayName } = auth;
  useEffect(() => {
    if (!signedIn || !userId || displayName) return;
    let cancelled = false;
    createClient()
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .single()
      .then(({ data }) => {
        if (!cancelled && data?.display_name) {
          setAuth((prev) =>
            prev.userId === userId
              ? { ...prev, displayName: data.display_name }
              : prev,
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [signedIn, userId, displayName]);

  if (!auth.signedIn) {
    return (
      <div className="absolute right-5 top-4 flex gap-2 md:right-16 md:top-[38px]">
        <Link href="/auth/login" className={headerSecondary}>
          Log in
        </Link>
        <Link href="/auth/sign-up" className={headerPrimary}>
          Sign up
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="absolute right-5 top-4 flex items-center gap-2 md:right-16 md:top-3.5">
        {!auth.isAnonymous && (
          <Link href="/dashboard" className={headerSecondary}>
            Dashboard
          </Link>
        )}
        <LogoutButton className={cn(headerPrimary, "rounded-none")} />
      </div>
      <span className="absolute left-5 top-[62px] font-grotesk text-[10px] font-normal uppercase tracking-[calc(0.08em-1px)] md:left-auto md:right-16 md:top-[56px] md:text-lg md:tracking-[calc(0.1em-2px)]">
        Welcome back{auth.displayName ? `, ${auth.displayName}` : ""}
      </span>
    </>
  );
}
