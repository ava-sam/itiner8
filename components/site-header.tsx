import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SiteHeaderNav } from "@/components/site-header-nav";

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
      <SiteHeaderNav
        initial={{
          signedIn: Boolean(claims),
          isAnonymous: Boolean(claims?.is_anonymous),
          userId: claims?.sub ?? null,
          displayName,
        }}
      />
      <div className="absolute inset-x-5 bottom-0 h-px bg-ink/30 md:inset-x-16" />
    </header>
  );
}
