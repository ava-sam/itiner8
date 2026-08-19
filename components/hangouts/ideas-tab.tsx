"use client";

import { useState } from "react";
import { APIProvider } from "@vis.gl/react-google-maps";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PlaceAutocompleteField,
  type PlaceAutocompleteValue,
} from "@/components/place-autocomplete-field";
import type { ActionResult, HangoutStop } from "@/components/hangouts/types";

function AddPlaceForm({
  onAddPlace,
}: {
  onAddPlace: (pick: PlaceAutocompleteValue) => Promise<ActionResult>;
}) {
  const [pick, setPick] = useState<PlaceAutocompleteValue>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return (
      <p className="text-sm text-red-500">
        Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY — the place search
        can&apos;t load.
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
  };

  return (
    <APIProvider apiKey={apiKey}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <PlaceAutocompleteField
          id="new-place"
          label="Add a place"
          value={pick}
          onChange={setPick}
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <Button type="submit" disabled={isLoading} className="self-start">
          {isLoading ? "Adding..." : "Add place"}
        </Button>
      </form>
    </APIProvider>
  );
}

function CandidateCard({
  stop,
  profileId,
  onRemoveStop,
  onUpdateVisitDuration,
  onToggleVote,
}: {
  stop: HangoutStop;
  profileId: string;
  onRemoveStop: (stopId: string) => Promise<ActionResult>;
  onUpdateVisitDuration: (
    stopId: string,
    minutes: number,
  ) => Promise<ActionResult>;
  onToggleVote: (stopId: string) => Promise<ActionResult>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [minutes, setMinutes] = useState(stop.visit_duration_minutes);
  const [error, setError] = useState<string | null>(null);
  const [isVoting, setIsVoting] = useState(false);

  const isMine = stop.suggested_by === profileId;
  const hasVoted = stop.votes.some((v) => v.voter_id === profileId);

  const handleVote = async () => {
    setIsVoting(true);
    const result = await onToggleVote(stop.id);
    setIsVoting(false);
    if (result.error) setError(result.error);
  };

  const handleSaveDuration = async () => {
    const result = await onUpdateVisitDuration(stop.id, minutes);
    if (result.error) {
      setError(result.error);
      return;
    }
    setIsEditing(false);
  };

  const handleRemove = async () => {
    const result = await onRemoveStop(stop.id);
    if (result.error) setError(result.error);
  };

  return (
    <Card>
      <CardContent className="p-4 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-medium">{stop.place.name}</p>
            <p className="text-sm text-muted-foreground">
              {stop.place.formatted_address}
            </p>
          </div>
          <Button
            type="button"
            variant={hasVoted ? "default" : "outline"}
            size="sm"
            disabled={isVoting}
            onClick={handleVote}
          >
            ▲ {stop.votes.length}
          </Button>
        </div>

        {isEditing ? (
          <div className="flex items-center gap-2">
            <Label htmlFor={`duration-${stop.id}`} className="text-xs">
              Visit duration (minutes)
            </Label>
            <Input
              id={`duration-${stop.id}`}
              type="number"
              min={1}
              className="h-8 w-24"
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
            />
            <Button type="button" size="sm" onClick={handleSaveDuration}>
              Save
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setMinutes(stop.visit_duration_minutes);
                setIsEditing(false);
              }}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {stop.visit_duration_minutes} min visit
            {isMine && " · suggested by you"}
          </p>
        )}

        {isMine && !isEditing && (
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setIsEditing(true)}
            >
              Edit
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleRemove}
            >
              Remove
            </Button>
          </div>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}
      </CardContent>
    </Card>
  );
}

export function IdeasTab({
  profileId,
  candidates,
  maxCandidates,
  onAddPlace,
  onRemoveStop,
  onUpdateVisitDuration,
  onToggleVote,
}: {
  profileId: string;
  candidates: HangoutStop[];
  maxCandidates: number;
  onAddPlace: (pick: PlaceAutocompleteValue) => Promise<ActionResult>;
  onRemoveStop: (stopId: string) => Promise<ActionResult>;
  onUpdateVisitDuration: (
    stopId: string,
    minutes: number,
  ) => Promise<ActionResult>;
  onToggleVote: (stopId: string) => Promise<ActionResult>;
}) {
  const sorted = [...candidates].sort(
    (a, b) => b.votes.length - a.votes.length,
  );
  const atCap = candidates.length >= maxCandidates;

  return (
    <div className="flex flex-col gap-6">
      {atCap ? (
        <p className="text-sm text-muted-foreground">
          This hangout has reached the {maxCandidates}-place limit. Remove a
          place below before adding another.
        </p>
      ) : (
        <AddPlaceForm onAddPlace={onAddPlace} />
      )}

      {sorted.length === 0 ? (
        <p className="text-muted-foreground">
          No candidate places yet — add the first one above.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {sorted.map((stop) => (
            <CandidateCard
              key={stop.id}
              stop={stop}
              profileId={profileId}
              onRemoveStop={onRemoveStop}
              onUpdateVisitDuration={onUpdateVisitDuration}
              onToggleVote={onToggleVote}
            />
          ))}
        </div>
      )}
    </div>
  );
}
