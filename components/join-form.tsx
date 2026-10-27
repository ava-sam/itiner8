"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { TurnstileField, useTurnstile } from "@/components/turnstile-field";
import { CtaButton } from "@/components/ui/cta-button";
import { Field } from "@/components/ui/field";
import { PreviewPanel } from "@/components/ui/section-page";
import { SegmentedButtons } from "@/components/ui/segmented-buttons";

type Mode = "guest" | "account";

type SessionInfo = {
  id: string;
  isAnonymous: boolean;
};

type Preview = {
  name: string;
  organizer_name: string | null;
  start_time: string;
  member_count: number;
};

type RpcResult = { ok: boolean; error?: string; hangout_id?: string } & Partial<Preview>;

const CODE_LENGTH = 8;

const ERROR_MESSAGES: Record<string, string> = {
  invalid_code: "that code didn't work",
  rate_limited: "too many tries, please wait an hour",
  no_profile: "something went wrong, please sign out and try again",
  not_signed_in: "something went wrong, please sign out and try again",
};
const GENERIC_ERROR = "something went wrong, please try again";

const normalizeCode = (value: string) =>
  value.replace(/\s+/g, "").toUpperCase().slice(0, CODE_LENGTH);

function formatStart(iso: string) {
  return new Date(iso)
    .toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
    .toLowerCase();
}

export function JoinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const turnstile = useTurnstile();

  const [code, setCode] = useState(() =>
    normalizeCode(searchParams.get("code") ?? ""),
  );
  const [displayName, setDisplayName] = useState("");
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [accountName, setAccountName] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const hasAccount = Boolean(session && !session.isAnonymous);
  const mode: Mode = hasAccount ? "account" : "guest";
  const sessionId = session?.id ?? null;

  // Track the current session (account, anonymous guest, or none).
  useEffect(() => {
    const supabase = createClient();
    const apply = (user: { id: string; is_anonymous?: boolean } | null) =>
      setSession(
        user ? { id: user.id, isAnonymous: Boolean(user.is_anonymous) } : null,
      );

    supabase.auth.getSession().then(({ data }) => {
      apply(data.session?.user ?? null);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) =>
      apply(s?.user ?? null),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  // Display name for the "joining as" card.
  useEffect(() => {
    if (!hasAccount || !sessionId) {
      setAccountName(null);
      return;
    }
    let cancelled = false;
    createClient()
      .from("profiles")
      .select("display_name")
      .eq("id", sessionId)
      .single()
      .then(({ data }) => {
        if (!cancelled) setAccountName(data?.display_name ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [hasAccount, sessionId]);

  // Debounced plan preview once the code is complete and a session exists.
  useEffect(() => {
    setPreview(null);
    if (code.length !== CODE_LENGTH || !sessionId) {
      setPreviewLoading(false);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    const timer = setTimeout(async () => {
      const { data, error: rpcError } = await createClient().rpc(
        "preview_hangout",
        { p_code: code },
      );
      if (cancelled) return;
      setPreviewLoading(false);
      const result = data as RpcResult | null;
      if (rpcError || !result) {
        setError(GENERIC_ERROR);
      } else if (!result.ok) {
        setError(ERROR_MESSAGES[result.error ?? ""] ?? GENERIC_ERROR);
      } else {
        setPreview(result as Preview);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [code, sessionId]);

  const handleModeChange = (next: Mode) => {
    if (!ready || next === mode) return;
    if (next === "account") {
      // Not signed in with an account: go log in, then come back here.
      const back = code ? `/join?code=${code}` : "/join";
      router.push(`/auth/login?next=${encodeURIComponent(back)}`);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setError(null);

    if (code.length !== CODE_LENGTH) {
      setError(ERROR_MESSAGES.invalid_code);
      return;
    }

    const supabase = createClient();
    const trimmedName = displayName.trim();

    if (mode === "guest") {
      if (trimmedName.length < 1 || trimmedName.length > 50) {
        setError("enter a display name (1-50 characters)");
        return;
      }
      if (!session && turnstile.enabled && !turnstile.token) {
        setError("please complete the check");
        return;
      }
    }

    setIsLoading(true);
    try {
      if (mode === "guest") {
        if (!session) {
          const { error: signInError } = await supabase.auth.signInAnonymously({
            options: {
              captchaToken: turnstile.token ?? undefined,
              data: { display_name: trimmedName },
            },
          });
          turnstile.reset();
          if (signInError) {
            setError(signInError.message.toLowerCase());
            return;
          }
        } else {
          // Reusing an existing guest session: keep their name up to date.
          await supabase
            .from("profiles")
            .update({ display_name: trimmedName })
            .eq("id", session.id);
        }
      }

      const { data, error: rpcError } = await supabase.rpc("join_hangout", {
        p_code: code,
      });
      const result = data as RpcResult | null;
      if (rpcError || !result) {
        setError(GENERIC_ERROR);
        return;
      }
      if (!result.ok || !result.hangout_id) {
        setError(ERROR_MESSAGES[result.error ?? ""] ?? GENERIC_ERROR);
        return;
      }
      router.refresh();
      router.push(`/hangouts/${result.hangout_id}`);
    } catch {
      setError(GENERIC_ERROR);
    } finally {
      setIsLoading(false);
    }
  };

  const joiningName = accountName ?? "";

  return (
    <div className="flex flex-1 flex-col gap-10 md:flex-row">
      <form
        onSubmit={handleJoin}
        noValidate
        className="flex flex-col gap-2.5 md:w-[632px] md:flex-none md:gap-3.5"
      >
        <Field
          id="invite-code"
          label="invite code"
          placeholder="enter your invite code"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={CODE_LENGTH}
          value={code}
          onChange={(e) => {
            setCode(normalizeCode(e.target.value));
            setError(null);
          }}
        />

        <div>
          <span className="mb-1.5 block font-grotesk text-[11px] font-bold uppercase tracking-[0.12em]">
            join as
          </span>
          <SegmentedButtons<Mode>
            aria-label="join as"
            tone="grey"
            value={mode}
            onChange={handleModeChange}
            options={[
              { value: "guest", label: "Guest", disabled: hasAccount },
              { value: "account", label: "My account" },
            ]}
          />
        </div>

        {mode === "guest" ? (
          <>
            <Field
              id="display-name"
              label="display name (required)"
              placeholder="what should your friends call you?"
              autoComplete="nickname"
              maxLength={50}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
            {turnstile.enabled && !session && (
              <div>
                <span className="mb-1.5 block font-grotesk text-[11px] font-bold uppercase tracking-[0.12em]">
                  quick check
                </span>
                <TurnstileField state={turnstile} />
              </div>
            )}
          </>
        ) : (
          <div>
            <span className="mb-1.5 block font-grotesk text-[11px] font-bold uppercase tracking-[0.12em]">
              joining as
            </span>
            <div className="flex items-center gap-3.5 border-2 border-ink bg-input-white p-3.5">
              <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full border-2 border-ink bg-sel-grey font-grotesk text-base font-bold uppercase text-bg">
                {joiningName.charAt(0)}
              </div>
              <div className="font-grotesk text-base font-bold lowercase">
                {joiningName}
              </div>
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="font-grotesk text-sm lowercase text-[#8a1c1c]">
            {error}
          </p>
        )}

        <CtaButton type="submit" disabled={isLoading || !ready} className="mt-1">
          {isLoading ? "joining…" : "join hangout"}
        </CtaButton>
      </form>

      <PreviewPanel>
        {preview ? (
          <div className="flex flex-col gap-2 font-grotesk lowercase">
            <div className="text-2xl font-bold">{preview.name}</div>
            <div className="text-sm">
              organized by {preview.organizer_name ?? "someone"}
            </div>
            <div className="text-sm">{formatStart(preview.start_time)}</div>
            <div className="text-sm">
              {preview.member_count}{" "}
              {preview.member_count === 1 ? "member" : "members"}
            </div>
          </div>
        ) : (
          <>
            <svg
              width="56"
              height="56"
              viewBox="0 0 56 56"
              fill="none"
              stroke="#18202b"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="20" cy="20" r="8" />
              <path d="M6 46 c2-10 8-14 14-14 s12 4 14 14" />
              <circle cx="38" cy="24" r="6" />
              <path d="M32 44 c1-6 4-9 8-9 s7 3 8 9" />
            </svg>
            <div className="font-grotesk text-[13px] font-bold uppercase tracking-[0.14em]">
              {previewLoading ? "looking up plan…" : "plan details appear here"}
            </div>
          </>
        )}
      </PreviewPanel>
    </div>
  );
}
