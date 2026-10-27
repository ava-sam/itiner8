import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/logout-button";
import { createClient } from "@/lib/supabase/server";

const navLink =
  "font-grotesk text-[11px] font-bold uppercase tracking-[0.1em] hover:underline md:text-xs";

export async function SiteHeader() {
  const supabase = await createClient();

  // You can also use getUser() which will be slower.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  let displayName: string | null = null;

  if (claims) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", claims.sub)
      .single();
    displayName = profile?.display_name ?? null;
  }

  // Positions follow the mockups: logo top-left, welcome text under it on
  // mobile and top-right on desktop, hairline rule along the bottom.
  return (
    <header className="relative h-24 w-full md:h-28">
      <Link
        href="/"
        className="absolute left-5 top-[18px] font-display text-[34px] uppercase leading-none tracking-[calc(0.01em+1px)] md:left-16 md:top-[26px] md:text-[68px] md:tracking-[calc(0.01em+2px)]"
      >
        ITINER8
      </Link>
      {claims ? (
        <div className="contents md:absolute md:right-16 md:top-[50px] md:flex md:items-center md:gap-6">
          <div className="absolute right-5 top-5 flex items-center gap-3 md:static md:order-last md:gap-4">
            {!claims.is_anonymous && (
              <Link href="/dashboard" className={navLink}>
                Dashboard
              </Link>
            )}
            <LogoutButton className="h-7 rounded-none border-2 border-ink bg-ink px-3 font-grotesk text-[11px] font-bold uppercase tracking-[0.08em] text-bg hover:bg-ink/85" />
          </div>
          <span className="absolute left-5 top-[62px] font-grotesk text-[10px] font-normal uppercase tracking-[calc(0.08em-1px)] md:static md:text-lg md:tracking-[calc(0.1em-2px)]">
            Welcome back{displayName ? `, ${displayName}` : ""}
          </span>
        </div>
      ) : (
        <div className="absolute right-5 top-5 flex gap-2 md:right-16 md:top-[50px]">
          <Button asChild size="sm" variant={"outline"}>
            <Link href="/auth/login">Sign in</Link>
          </Button>
          <Button asChild size="sm" variant={"default"}>
            <Link href="/auth/sign-up">Sign up</Link>
          </Button>
        </div>
      )}
      <div className="absolute inset-x-5 bottom-0 h-px bg-ink/30 md:inset-x-16" />
    </header>
  );
}
