import { Suspense } from "react";

import { createClient } from "@/lib/supabase/server";
import { DashboardFolders } from "@/components/ui/dashboard-folders";
import { SignedOutLanding } from "@/components/signed-out-landing";

async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims) return <SignedOutLanding />;

  return (
    <DashboardFolders
      viewHref="/dashboard/plans"
      joinHref="/join"
      createHref={claims.is_anonymous ? undefined : "/hangouts/new"}
    />
  );
}

export default function HomePage() {
  return (
    <main>
      <Suspense>
        <Home />
      </Suspense>
    </main>
  );
}
