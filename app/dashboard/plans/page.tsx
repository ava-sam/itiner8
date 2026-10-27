import { redirect } from "next/navigation";
import { Suspense } from "react";

import { createClient } from "@/lib/supabase/server";
import { HangoutsListView } from "@/components/hangouts/hangouts-list-view";
import { SectionPage } from "@/components/ui/section-page";

async function HangoutsList() {
  const supabase = await createClient();
  const { data, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || !data?.claims) {
    redirect("/auth/login");
  }
  const claims = data.claims;

  const canCreate = !claims.is_anonymous;

  const { data: hangouts, error } = await supabase
    .from("hangouts")
    .select(
      "id, name, status, start_time, timezone, created_at, hangout_members!inner(profile_id)",
    )
    .eq("hangout_members.profile_id", claims.sub)
    .order("start_time", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <p className="font-grotesk text-sm lowercase text-[#8a1c1c]">
        couldn&apos;t load your hangouts.
      </p>
    );
  }

  return <HangoutsListView hangouts={hangouts ?? []} canCreate={canCreate} />;
}

export default function PlansPage() {
  return (
    <SectionPage
      label="view plans"
      color="#d3dff2"
      texture="/textures/texture-blue.png"
      textureOpacity={0.2}
    >
      <Suspense>
        <HangoutsList />
      </Suspense>
    </SectionPage>
  );
}
