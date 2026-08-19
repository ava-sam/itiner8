"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ActionResult, HangoutStop } from "@/components/hangouts/types";

function ActionRow({
  stop,
  actionLabel,
  disabled,
  onAction,
}: {
  stop: HangoutStop;
  actionLabel: string;
  disabled?: boolean;
  onAction: (stopId: string) => Promise<ActionResult>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    setIsLoading(true);
    const result = await onAction(stop.id);
    setIsLoading(false);
    if (result.error) setError(result.error);
  };

  return (
    <Card>
      <CardContent className="p-4 flex items-center justify-between gap-4">
        <div>
          <p className="font-medium">{stop.place.name}</p>
          <p className="text-sm text-muted-foreground">
            {stop.place.formatted_address}
          </p>
          {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            ▲ {stop.votes.length}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || isLoading}
            onClick={handleClick}
          >
            {actionLabel}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function FinalistsTab({
  isOrganizer,
  candidates,
  finalists,
  maxFinalists,
  onMoveToFinalists,
  onRemoveFromFinalists,
}: {
  isOrganizer: boolean;
  candidates: HangoutStop[];
  finalists: HangoutStop[];
  maxFinalists: number;
  onMoveToFinalists: (stopId: string) => Promise<ActionResult>;
  onRemoveFromFinalists: (stopId: string) => Promise<ActionResult>;
}) {
  const atCap = finalists.length >= maxFinalists;
  const sortedCandidates = [...candidates].sort(
    (a, b) => b.votes.length - a.votes.length,
  );

  return (
    <div className="flex flex-col gap-8">
      {isOrganizer && (
        <div className="flex flex-col gap-3">
          <h2 className="font-semibold">Candidates</h2>
          {atCap && (
            <p className="text-sm text-muted-foreground">
              Finalists are capped at {maxFinalists}. Remove one below before
              adding another.
            </p>
          )}
          {sortedCandidates.length === 0 ? (
            <p className="text-muted-foreground">
              No candidate places yet — add some in the Ideas tab.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {sortedCandidates.map((stop) => (
                <ActionRow
                  key={stop.id}
                  stop={stop}
                  actionLabel="Move to finalists"
                  disabled={atCap}
                  onAction={onMoveToFinalists}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="font-semibold">
          Finalists ({finalists.length}/{maxFinalists})
        </h2>
        {finalists.length === 0 ? (
          <p className="text-muted-foreground">
            No finalists yet
            {isOrganizer
              ? " — move a candidate above once you're ready."
              : "."}
          </p>
        ) : isOrganizer ? (
          <div className="flex flex-col gap-3">
            {finalists.map((stop) => (
              <ActionRow
                key={stop.id}
                stop={stop}
                actionLabel="Remove from finalists"
                onAction={onRemoveFromFinalists}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {finalists.map((stop) => (
              <Card key={stop.id}>
                <CardContent className="p-4">
                  <p className="font-medium">{stop.place.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {stop.place.formatted_address}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
