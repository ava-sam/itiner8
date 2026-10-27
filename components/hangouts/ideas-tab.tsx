"use client";

import { useState } from "react";
import { APIProvider } from "@vis.gl/react-google-maps";

import { cn } from "@/lib/utils";
import {
  PlaceAutocompleteField,
  type PlaceAutocompleteValue,
} from "@/components/place-autocomplete-field";
import { MapPlaceholder } from "@/components/ui/map-placeholder";
import type { ActionResult, HangoutStop } from "@/components/hangouts/types";

export const scrollListClass =
  "md:overflow-y-auto md:pr-1.5 [scrollbar-width:thin] [scrollbar-color:#18202b_transparent]";

export function formatCategory(primaryType: string | null | undefined) {
  return primaryType ? primaryType.replace(/_/g, " ") : null;
}

function AddPlaceForm({
  onAddPlace,
}: {
  onAddPlace: (pick: PlaceAutocompleteValue) => Promise<ActionResult>;
}) {
  const [pick, setPick] = useState<PlaceAutocompleteValue>(null);
  // Bumped after a successful add so the (uncontrolled) search box clears.
  const [resetKey, setResetKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return (
      <p className="font-grotesk text-sm lowercase text-[#8a1c1c]">
        missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY — the place search can&apos;t
        load.
      </p>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!pick) {
      setError("Pick a place from the suggestions.");
      return;
    }

    setIsLoading(true);
    const result = await onAddPlace(pick);
    setIsLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setPick(null);
    setResetKey((k) => k + 1);
  };

  return (
    <APIProvider apiKey={apiKey}>
      <form onSubmit={handleSubmit} className="mb-2.5 md:mb-3.5">
        <div className="flex gap-2 md:gap-3">
          <PlaceAutocompleteField
            key={resetKey}
            id="new-place"
            label="Add a place"
            variant="room"
            placeholder="search for a place to add"
            value={pick}
            onChange={setPick}
          />
          <button
            type="submit"
            disabled={isLoading}
            className="border-2 border-ink bg-ink px-3.5 font-grotesk text-[13px] font-bold uppercase tracking-[0.08em] text-bg transition-opacity hover:opacity-85 disabled:opacity-50 md:px-[18px]"
          >
            <span className="md:hidden">{isLoading ? "…" : "+ add"}</span>
            <span className="hidden md:inline">
              {isLoading ? "adding…" : "+ add idea"}
            </span>
          </button>
        </div>
        {error && (
          <p role="alert" className="mt-2 font-grotesk text-sm lowercase text-[#8a1c1c]">
            {error}
          </p>
        )}
      </form>
    </APIProvider>
  );
}

function IdeaCard({
  stop,
  profileId,
  addedBy,
  onRemoveStop,
  onToggleVote,
}: {
  stop: HangoutStop;
  profileId: string;
  addedBy: string;
  onRemoveStop: (stopId: string) => Promise<ActionResult>;
  onToggleVote: (stopId: string) => Promise<ActionResult>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isVoting, setIsVoting] = useState(false);

  const isMine = stop.suggested_by === profileId;
  const hasVoted = stop.votes.some((v) => v.voter_id === profileId);
  const category = formatCategory(stop.place.primary_type);

  const handleVote = async () => {
    setIsVoting(true);
    setError(null);
    const result = await onToggleVote(stop.id);
    setIsVoting(false);
    if (result.error) setError(result.error);
  };

  const handleRemove = async () => {
    const result = await onRemoveStop(stop.id);
    if (result.error) setError(result.error);
  };

  return (
    <div className="box-border border-2 border-ink bg-input-white px-3.5 py-3 md:px-[18px] md:py-3.5">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="font-grotesk text-base font-bold lowercase text-ink md:text-[17px]">
            {stop.place.name}
          </div>
          <div className="mt-[3px] font-grotesk text-xs lowercase text-[#4a5158]">
            {category && `${category} · `}
            <span className="hidden md:inline">
              {stop.place.formatted_address} ·{" "}
            </span>
            added by {addedBy}
          </div>
        </div>
        <div className="flex flex-none items-center gap-1 md:gap-2">
          {isMine && (
            <button
              type="button"
              aria-label="remove idea"
              onClick={handleRemove}
              className="flex h-7 w-7 items-center justify-center font-grotesk text-lg font-bold text-ink hover:bg-ink/10"
            >
              ×
            </button>
          )}
          <button
            type="button"
            aria-pressed={hasVoted}
            aria-label={`${hasVoted ? "remove your vote" : "vote"} (${stop.votes.length})`}
            disabled={isVoting}
            onClick={handleVote}
            className={cn(
              "box-border flex h-[52px] w-[52px] flex-none flex-col items-center justify-center border-2 border-ink font-grotesk font-bold",
              hasVoted ? "bg-sel-blue text-bg" : "bg-input-white text-ink",
            )}
          >
            <span className="text-[11px] leading-none">▲</span>
            <span className="mt-0.5 text-base leading-[1.1]">
              {stop.votes.length}
            </span>
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-2 font-grotesk text-sm lowercase text-[#8a1c1c]">
          {error}
        </p>
      )}
    </div>
  );
}

export function IdeasTab({
  profileId,
  memberNames,
  candidates,
  maxCandidates,
  onAddPlace,
  onRemoveStop,
  onToggleVote,
}: {
  profileId: string;
  memberNames: Record<string, string>;
  candidates: HangoutStop[];
  maxCandidates: number;
  onAddPlace: (pick: PlaceAutocompleteValue) => Promise<ActionResult>;
  onRemoveStop: (stopId: string) => Promise<ActionResult>;
  onToggleVote: (stopId: string) => Promise<ActionResult>;
}) {
  const sorted = [...candidates].sort(
    (a, b) => b.votes.length - a.votes.length,
  );
  const atCap = candidates.length >= maxCandidates;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-8 md:flex-row">
      <div className="flex min-h-0 flex-col md:w-[640px] md:flex-none">
        {atCap ? (
          <p className="mb-3 border-2 border-ink bg-input-white/55 p-3 font-grotesk text-xs lowercase leading-normal">
            this hangout has reached the {maxCandidates}-idea limit. remove an
            idea below before adding another.
          </p>
        ) : (
          <AddPlaceForm onAddPlace={onAddPlace} />
        )}

        <div className="mb-2 font-grotesk text-[11px] font-bold uppercase tracking-[0.12em] md:mb-3 md:text-xs">
          {candidates.length} / {maxCandidates} ideas
        </div>

        {sorted.length === 0 ? (
          <p className="font-grotesk text-sm lowercase text-[#4a5158]">
            no ideas yet — add the first one above.
          </p>
        ) : (
          <div
            className={cn(
              "flex min-h-0 flex-1 flex-col gap-2 md:gap-2.5",
              scrollListClass,
            )}
          >
            {sorted.map((stop) => (
              <IdeaCard
                key={stop.id}
                stop={stop}
                profileId={profileId}
                addedBy={
                  stop.suggested_by === profileId
                    ? "you"
                    : (memberNames[stop.suggested_by]?.toLowerCase() ??
                      "someone")
                }
                onRemoveStop={onRemoveStop}
                onToggleVote={onToggleVote}
              />
            ))}
          </div>
        )}
      </div>

      <MapPlaceholder label="map of ideas appears here" />
    </div>
  );
}
