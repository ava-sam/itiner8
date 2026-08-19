import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { HangoutRoom } from "@/components/hangouts/hangout-room";
import type { Conflict } from "@/lib/optimizer/types";
import type { DisplayItinerary, HangoutStop } from "@/components/hangouts/types";

const STOP_SELECT =
  "id, hangout_id, place_id, suggested_by, status, visit_duration_minutes, created_at, place:places(id, name, formatted_address, lat, lng), votes(id, voter_id)";

const ITINERARY_SELECT = "id, stops, conflicts, generated_at";

interface StoredItineraryStopRow {
  placeId: string;
  name: string;
  arrival: string;
  visitStart: string;
  visitEnd: string;
  waitMinutes: number;
  travelMinutesFromPrevious: number;
  isReservation: boolean;
  isRequired: boolean;
  fitsOpeningHours: boolean;
}

interface StoredItineraryRow {
  id: string;
  generated_at: string;
  stops: StoredItineraryStopRow[];
  conflicts: Conflict[];
}

// itineraries.stops is jsonb — Date fields round-trip as ISO strings, so
// they need parsing back before this reaches PlanTab, which works with
// real Date objects throughout (see components/hangouts/types.ts).
function parseStoredItinerary(row: StoredItineraryRow): DisplayItinerary {
  return {
    id: row.id,
    generatedAt: new Date(row.generated_at),
    conflicts: row.conflicts,
    stops: row.stops.map((s) => ({
      ...s,
      arrival: new Date(s.arrival),
      visitStart: new Date(s.visitStart),
      visitEnd: new Date(s.visitEnd),
    })),
  };
}

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

  // itineraries keeps every generation, never overwriting — the "current"
  // plan is whichever row is most recent.
  const { data: itineraryRow } = await supabase
    .from("itineraries")
    .select(ITINERARY_SELECT)
    .eq("hangout_id", id)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

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
        initialItinerary={
          itineraryRow ? parseStoredItinerary(itineraryRow as unknown as StoredItineraryRow) : null
        }
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
