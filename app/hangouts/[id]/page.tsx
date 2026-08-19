import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { HangoutRoom } from "@/components/hangouts/hangout-room";
import type { HangoutStop } from "@/components/hangouts/types";

const STOP_SELECT =
  "id, hangout_id, place_id, suggested_by, status, visit_duration_minutes, created_at, place:places(id, name, formatted_address, lat, lng), votes(id, voter_id)";

async function HangoutRoomContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) {
    redirect("/auth/login");
  }
  const claims = data.claims;

  const { data: hangout } = await supabase
    .from("hangouts")
    .select("id, name, status")
    .eq("id", id)
    .maybeSingle();

  if (!hangout) {
    // Either the hangout doesn't exist, or RLS hid it because the current
    // user is neither the organizer nor a member.
    notFound();
  }

  const { data: memberRow } = await supabase
    .from("hangout_members")
    .select("role")
    .eq("hangout_id", id)
    .eq("profile_id", claims.sub)
    .maybeSingle();

  if (!memberRow) {
    notFound();
  }

  const { data: stopsData } = await supabase
    .from("hangout_stops")
    .select(STOP_SELECT)
    .eq("hangout_id", id)
    .in("status", ["candidate", "selected"])
    .order("created_at", { ascending: true });

  return (
    <div className="flex-1 w-full flex flex-col gap-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <h1 className="font-bold text-2xl">{hangout.name}</h1>
        <Badge variant="outline" className="capitalize">
          {hangout.status}
        </Badge>
      </div>
      <HangoutRoom
        hangoutId={hangout.id}
        profileId={claims.sub}
        isOrganizer={memberRow.role === "organizer"}
        initialStops={(stopsData ?? []) as unknown as HangoutStop[]}
      />
    </div>
  );
}

export default function HangoutRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense>
      <HangoutRoomContent params={params} />
    </Suspense>
  );
}
