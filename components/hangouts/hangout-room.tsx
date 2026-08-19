"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { PlaceAutocompleteValue } from "@/components/place-autocomplete-field";
import type {
  ActionResult,
  HangoutStop,
  PlaceInfo,
} from "@/components/hangouts/types";
import { IdeasTab } from "@/components/hangouts/ideas-tab";
import { FinalistsTab } from "@/components/hangouts/finalists-tab";
import { PlanTab } from "@/components/hangouts/plan-tab";

const TABS = [
  { id: "ideas", label: "Ideas" },
  { id: "finalists", label: "Finalists" },
  { id: "plan", label: "Plan" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const MAX_CANDIDATES = 15;
const MAX_FINALISTS = 8;
// hangout_stops.visit_duration_minutes is `not null` with no schema default
// and isn't part of the "add place" spec — defaulting new candidates to an
// hour, editable afterwards from the Ideas tab.
const DEFAULT_VISIT_DURATION_MINUTES = 60;

export function HangoutRoom({
  hangoutId,
  profileId,
  isOrganizer,
  initialStops,
}: {
  hangoutId: string;
  profileId: string;
  isOrganizer: boolean;
  initialStops: HangoutStop[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeTab: TabId = useMemo(() => {
    const tab = searchParams.get("tab");
    return TABS.some((t) => t.id === tab) ? (tab as TabId) : "ideas";
  }, [searchParams]);

  const setActiveTab = useCallback(
    (tab: TabId) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", tab);
      // replace (not push): switching tabs shouldn't pile up history entries.
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const [stops, setStops] = useState<HangoutStop[]>(initialStops);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`hangout-room-${hangoutId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "hangout_stops",
          filter: `hangout_id=eq.${hangoutId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const oldId = (payload.old as { id?: string }).id;
            if (oldId) setStops((prev) => prev.filter((s) => s.id !== oldId));
            return;
          }

          const row = payload.new as {
            id: string;
            place_id: string;
            suggested_by: string;
            status: HangoutStop["status"];
            visit_duration_minutes: number;
            created_at: string;
          };

          if (row.status !== "candidate" && row.status !== "selected") {
            // Moved on to a later phase — drop it from this view.
            setStops((prev) => prev.filter((s) => s.id !== row.id));
            return;
          }

          setStops((prev) => {
            if (!prev.some((s) => s.id === row.id)) return prev;
            return prev.map((s) =>
              s.id === row.id
                ? {
                    ...s,
                    status: row.status,
                    visit_duration_minutes: row.visit_duration_minutes,
                  }
                : s,
            );
          });

          // Not already known locally (added by another member) — fetch
          // its place info, then append. postgres_changes payloads don't
          // include embedded joins, so this needs a follow-up query.
          setStops((prev) => {
            if (prev.some((s) => s.id === row.id)) return prev;

            void supabase
              .from("places")
              .select("id, name, formatted_address, lat, lng")
              .eq("id", row.place_id)
              .single()
              .then(({ data: place }) => {
                if (!place) return;
                setStops((current) => {
                  if (current.some((s) => s.id === row.id)) return current;
                  const newStop: HangoutStop = {
                    id: row.id,
                    hangout_id: hangoutId,
                    place_id: row.place_id,
                    suggested_by: row.suggested_by,
                    status: row.status,
                    visit_duration_minutes: row.visit_duration_minutes,
                    created_at: row.created_at,
                    place,
                    votes: [],
                  };
                  return [...current, newStop];
                });
              });

            return prev;
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "votes" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const vote = payload.new as {
              id: string;
              hangout_stop_id: string;
              voter_id: string;
            };
            setStops((prev) =>
              prev.map((s) =>
                s.id === vote.hangout_stop_id &&
                !s.votes.some((v) => v.id === vote.id)
                  ? {
                      ...s,
                      votes: [
                        ...s.votes,
                        { id: vote.id, voter_id: vote.voter_id },
                      ],
                    }
                  : s,
              ),
            );
          } else if (payload.eventType === "DELETE") {
            const vote = payload.old as {
              id: string;
              hangout_stop_id?: string;
            };
            if (!vote.hangout_stop_id) return;
            setStops((prev) =>
              prev.map((s) =>
                s.id === vote.hangout_stop_id
                  ? { ...s, votes: s.votes.filter((v) => v.id !== vote.id) }
                  : s,
              ),
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [hangoutId]);

  const candidates = useMemo(
    () => stops.filter((s) => s.status === "candidate"),
    [stops],
  );
  const finalists = useMemo(
    () => stops.filter((s) => s.status === "selected"),
    [stops],
  );

  const addPlace = useCallback(
    async (pick: PlaceAutocompleteValue): Promise<ActionResult> => {
      if (!pick) return { error: "Pick a place from the suggestions." };
      if (candidates.length >= MAX_CANDIDATES) {
        return {
          error: `This hangout already has ${MAX_CANDIDATES} candidate places — remove one before adding another.`,
        };
      }

      const supabase = createClient();

      // Look up the shared places cache by google_place_id first. No
      // upsert here: places_update_stale_only only allows updating rows
      // older than 30 days, so upserting an existing fresh row would be
      // rejected by RLS.
      const { data: existingPlace } = await supabase
        .from("places")
        .select("id, name, formatted_address, lat, lng")
        .eq("google_place_id", pick.place_id)
        .maybeSingle();

      let place: PlaceInfo;
      if (existingPlace) {
        place = existingPlace;
      } else {
        const { data: inserted, error: insertPlaceError } = await supabase
          .from("places")
          .insert({
            google_place_id: pick.place_id,
            is_custom: false,
            name: pick.name,
            formatted_address: pick.formatted_address,
            lat: pick.lat,
            lng: pick.lng,
          })
          .select("id, name, formatted_address, lat, lng")
          .single();

        if (insertPlaceError || !inserted) {
          // Someone else may have cached the same place a moment ago
          // (unique violation on google_place_id) — re-select instead of
          // failing outright.
          const { data: retried } = await supabase
            .from("places")
            .select("id, name, formatted_address, lat, lng")
            .eq("google_place_id", pick.place_id)
            .maybeSingle();
          if (!retried) {
            return {
              error: insertPlaceError?.message ?? "Couldn't save that place.",
            };
          }
          place = retried;
        } else {
          place = inserted;
        }
      }

      const { data: stop, error: insertStopError } = await supabase
        .from("hangout_stops")
        .insert({
          hangout_id: hangoutId,
          place_id: place.id,
          suggested_by: profileId,
          status: "candidate",
          visit_duration_minutes: DEFAULT_VISIT_DURATION_MINUTES,
        })
        .select(
          "id, hangout_id, place_id, suggested_by, status, visit_duration_minutes, created_at",
        )
        .single();

      if (insertStopError || !stop) {
        return {
          error: insertStopError?.message ?? "Couldn't add that place.",
        };
      }

      setStops((prev) =>
        prev.some((s) => s.id === stop.id)
          ? prev
          : [...prev, { ...stop, place, votes: [] }],
      );

      return {};
    },
    [candidates.length, hangoutId, profileId],
  );

  const removeStop = useCallback(
    async (stopId: string): Promise<ActionResult> => {
      const supabase = createClient();
      const { error } = await supabase
        .from("hangout_stops")
        .delete()
        .eq("id", stopId);
      if (error) return { error: error.message };
      setStops((prev) => prev.filter((s) => s.id !== stopId));
      return {};
    },
    [],
  );

  const updateVisitDuration = useCallback(
    async (stopId: string, minutes: number): Promise<ActionResult> => {
      const supabase = createClient();
      const { error } = await supabase
        .from("hangout_stops")
        .update({ visit_duration_minutes: minutes })
        .eq("id", stopId);
      if (error) return { error: error.message };
      setStops((prev) =>
        prev.map((s) =>
          s.id === stopId ? { ...s, visit_duration_minutes: minutes } : s,
        ),
      );
      return {};
    },
    [],
  );

  const toggleVote = useCallback(
    async (stopId: string): Promise<ActionResult> => {
      const supabase = createClient();
      const stop = stops.find((s) => s.id === stopId);
      const myVote = stop?.votes.find((v) => v.voter_id === profileId);

      if (myVote) {
        const { error } = await supabase
          .from("votes")
          .delete()
          .eq("id", myVote.id);
        if (error) return { error: error.message };
        setStops((prev) =>
          prev.map((s) =>
            s.id === stopId
              ? { ...s, votes: s.votes.filter((v) => v.id !== myVote.id) }
              : s,
          ),
        );
      } else {
        const { data: vote, error } = await supabase
          .from("votes")
          .insert({ hangout_stop_id: stopId, voter_id: profileId })
          .select("id, voter_id")
          .single();
        if (error || !vote) return { error: error?.message ?? "Couldn't vote." };
        setStops((prev) =>
          prev.map((s) =>
            s.id === stopId && !s.votes.some((v) => v.id === vote.id)
              ? { ...s, votes: [...s.votes, vote] }
              : s,
          ),
        );
      }
      return {};
    },
    [stops, profileId],
  );

  const moveToFinalists = useCallback(
    async (stopId: string): Promise<ActionResult> => {
      if (finalists.length >= MAX_FINALISTS) {
        return {
          error: `Finalists are capped at ${MAX_FINALISTS} — remove one first.`,
        };
      }
      const supabase = createClient();
      const { error } = await supabase
        .from("hangout_stops")
        .update({ status: "selected" })
        .eq("id", stopId);
      if (error) return { error: error.message };
      setStops((prev) =>
        prev.map((s) => (s.id === stopId ? { ...s, status: "selected" } : s)),
      );
      return {};
    },
    [finalists.length],
  );

  const removeFromFinalists = useCallback(
    async (stopId: string): Promise<ActionResult> => {
      const supabase = createClient();
      const { error } = await supabase
        .from("hangout_stops")
        .update({ status: "candidate" })
        .eq("id", stopId);
      if (error) return { error: error.message };
      setStops((prev) =>
        prev.map((s) =>
          s.id === stopId ? { ...s, status: "candidate" } : s,
        ),
      );
      return {};
    },
    [],
  );

  return (
    <div className="flex flex-col gap-6">
      <div role="tablist" className="flex gap-2 border-b">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              activeTab === tab.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "ideas" && (
        <IdeasTab
          profileId={profileId}
          candidates={candidates}
          maxCandidates={MAX_CANDIDATES}
          onAddPlace={addPlace}
          onRemoveStop={removeStop}
          onUpdateVisitDuration={updateVisitDuration}
          onToggleVote={toggleVote}
        />
      )}
      {activeTab === "finalists" && (
        <FinalistsTab
          isOrganizer={isOrganizer}
          candidates={candidates}
          finalists={finalists}
          maxFinalists={MAX_FINALISTS}
          onMoveToFinalists={moveToFinalists}
          onRemoveFromFinalists={removeFromFinalists}
        />
      )}
      {activeTab === "plan" && <PlanTab />}
    </div>
  );
}
