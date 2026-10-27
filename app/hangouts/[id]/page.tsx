import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { HangoutRoom } from "@/components/hangouts/hangout-room";
import { FinalPlanView } from "@/components/hangouts/final-plan";
import { getActiveWindowsNearInstant } from "@/lib/optimizer/opening-hours";
import type { Conflict, OpeningHours } from "@/lib/optimizer/types";
import type {
  DisplayItinerary,
  HangoutMeta,
  HangoutStatus,
  HangoutStop,
  ItineraryPlaceDetails,
  RoomMember,
} from "@/components/hangouts/types";

const STOP_SELECT =
  "id, hangout_id, place_id, suggested_by, status, visit_duration_minutes, is_required, reservation_time, created_at, place:places(id, name, formatted_address, lat, lng, primary_type), votes(id, voter_id)";

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
    .select(
      "id, name, status, invite_code, organizer_id, timezone, start_time, end_time, start_location, end_location, transportation_mode, buffer_minutes, updated_at",
    )
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

  const { data: memberRows } = await supabase
    .from("hangout_members")
    .select("profile_id, role, display_name, profile:profiles(display_name)")
    .eq("hangout_id", id)
    .order("created_at", { ascending: true });

  const members: RoomMember[] = (
    (memberRows ?? []) as unknown as {
      profile_id: string | null;
      role: "organizer" | "member";
      display_name: string | null;
      profile: { display_name: string } | null;
    }[]
  )
    .filter((m): m is typeof m & { profile_id: string } => m.profile_id !== null)
    .map((m) => ({
      profileId: m.profile_id,
      name: m.profile?.display_name ?? m.display_name ?? "member",
      role: m.role,
    }));

  const organizerName =
    members.find((m) => m.profileId === hangout.organizer_id)?.name ?? "organizer";

  const placeLabel = (loc: unknown): string | null => {
    if (!loc || typeof loc !== "object") return null;
    const l = loc as { formatted_address?: string; name?: string };
    return l.formatted_address ?? l.name ?? null;
  };

  const meta: HangoutMeta = {
    id: hangout.id,
    name: hangout.name,
    status: hangout.status as HangoutStatus,
    inviteCode: hangout.invite_code,
    organizerName,
    timezone: hangout.timezone,
    startTime: hangout.start_time,
    transportationMode: hangout.transportation_mode,
    bufferMinutes: hangout.buffer_minutes,
    startLabel: placeLabel(hangout.start_location) ?? "start location",
    endLabel: placeLabel(hangout.end_location),
    updatedAt: hangout.updated_at,
  };

  const itinerary = itineraryRow
    ? parseStoredItinerary(itineraryRow as unknown as StoredItineraryRow)
    : null;
  const placeDetails = await loadPlaceDetails(supabase, itinerary, meta.timezone);

  if (meta.status === "finalized" || meta.status === "completed") {
    return (
      <FinalPlanView
        hangout={meta}
        members={members}
        stops={itinerary?.stops ?? []}
        placeDetails={placeDetails}
      />
    );
  }

  return (
    <HangoutRoom
      hangout={meta}
      members={members}
      profileId={claims.sub}
      isOrganizer={memberRow.role === "organizer"}
      initialStops={(stopsData ?? []) as unknown as HangoutStop[]}
      initialItinerary={itinerary}
      placeDetails={placeDetails}
    />
  );
}

// Address / category / closing time for each stop in the stored itinerary
// (itineraries.stops only keeps ids and times).
async function loadPlaceDetails(
  supabase: Awaited<ReturnType<typeof createClient>>,
  itinerary: DisplayItinerary | null,
  timezone: string,
): Promise<Record<string, ItineraryPlaceDetails>> {
  if (!itinerary || itinerary.stops.length === 0) return {};

  const { data } = await supabase
    .from("places")
    .select("id, formatted_address, primary_type, opening_hours")
    .in(
      "id",
      itinerary.stops.map((s) => s.placeId),
    );

  const byId = new Map((data ?? []).map((p) => [p.id as string, p]));
  const details: Record<string, ItineraryPlaceDetails> = {};

  for (const stop of itinerary.stops) {
    const place = byId.get(stop.placeId);
    if (!place) continue;

    let closesAt: string | null = null;
    if (!stop.fitsOpeningHours && place.opening_hours) {
      // Same lookup the optimizer uses: the window the visit starts in.
      try {
        const window = getActiveWindowsNearInstant(
          place.opening_hours as OpeningHours,
          stop.visitStart,
          timezone,
        ).find((w) => w.open <= stop.visitStart && stop.visitStart < w.close);
        closesAt = window ? window.close.toISOString() : null;
      } catch {
        // places.opening_hours has no enforced shape; skip the badge if it's malformed.
      }
    }

    details[stop.placeId] = {
      address: place.formatted_address,
      category: place.primary_type,
      closesAt,
    };
  }

  return details;
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
