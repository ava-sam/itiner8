import { redirect } from "next/navigation";
import { Suspense } from "react";

import { createClient } from "@/lib/supabase/server";
import { DashboardFolders } from "@/components/ui/dashboard-folders";

async function Folders() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect("/auth/login");
  }

  const canCreate = !data.claims.is_anonymous;

  return (
    <DashboardFolders
      viewHref="/dashboard/plans"
      joinHref="/join"
      createHref={canCreate ? "/hangouts/new" : undefined}
    />
  );
}

export default function ProtectedPage() {
  return (
    <Suspense>
      <Folders />
    </Suspense>
  );
}
