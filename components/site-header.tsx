import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/logout-button";
import { createClient } from "@/lib/supabase/server";

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

  return (
    <header className="w-full flex justify-between items-center p-3 px-5 text-sm border-b">
      <Link href="/">ITINER8</Link>
      {claims ? (
        <div className="flex items-center gap-4">
          {!claims.is_anonymous && <Link href="/dashboard">Dashboard</Link>}
          {displayName}
          <LogoutButton />
        </div>
      ) : (
        <div className="flex gap-2">
          <Button asChild size="sm" variant={"outline"}>
            <Link href="/auth/login">Sign in</Link>
          </Button>
          <Button asChild size="sm" variant={"default"}>
            <Link href="/auth/sign-up">Sign up</Link>
          </Button>
        </div>
      )}
    </header>
  );
}
