"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { generatePlan, type GeneratePlanErrorCode } from "@/app/hangouts/[id]/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Conflict, ConflictSeverity } from "@/lib/optimizer/types";
import type { DisplayItinerary } from "@/components/hangouts/types";

const MIN_FINALISTS_TO_GENERATE = 1;

const ERROR_LABELS: Record<GeneratePlanErrorCode, string> = {
  not_authenticated: "Not signed in",
  not_organizer: "Organizer only",
  cap_exceeded: "Generation limit reached",
  no_finalists: "No finalists yet",
  google_api_error: "Travel data unavailable",
  route_not_found: "Route not found",
  unexpected: "Something went wrong",
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatMinutes(minutes: number): string {
  const rounded = Math.max(0, Math.round(minutes));
  if (rounded < 60) return `${rounded} min`;
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;
  return mins === 0 ? `${hours} hr` : `${hours} hr ${mins} min`;
}

function conflictKey(conflict: Conflict, index: number): string {
  return `${conflict.code}-${conflict.placeIds.join(",")}-${index}`;
}

function ItineraryStopRow({ stop, index }: { stop: DisplayItinerary["stops"][number]; index: number }) {
  const visitMinutes = (stop.visitEnd.getTime() - stop.visitStart.getTime()) / 60_000;

  return (
    <Card className={cn(!stop.fitsOpeningHours && "border-amber-400")}>
      <CardContent className="p-4 flex flex-col gap-1">
        <div className="flex items-center justify-between gap-4">
          <p className="font-medium">
            {index + 1}. {stop.name}
          </p>
          <div className="flex items-center gap-2">
            {stop.isReservation && (
              <Badge variant="secondary" className="whitespace-nowrap">
                Reservation
              </Badge>
            )}
            {stop.isRequired && (
              <Badge variant="outline" className="whitespace-nowrap">
                Required
              </Badge>
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Arrive {formatTime(stop.arrival)} · Visit {formatTime(stop.visitStart)}–{formatTime(stop.visitEnd)} (
          {formatMinutes(visitMinutes)})
        </p>
        {index > 0 && (
          <p className="text-xs text-muted-foreground">
            {formatMinutes(stop.travelMinutesFromPrevious)} travel from previous stop
            {stop.waitMinutes > 0 && ` · ${formatMinutes(stop.waitMinutes)} wait`}
          </p>
        )}
        {!stop.fitsOpeningHours && (
          <p className="text-xs text-amber-700">Scheduled outside this place&apos;s opening hours.</p>
        )}
      </CardContent>
    </Card>
  );
}

function ActionErrorBanner({ code, message }: { code: GeneratePlanErrorCode; message: string }) {
  return (
    <div className="rounded-lg border border-red-300 bg-red-50 p-3 flex flex-col gap-1">
      <p className="text-sm font-semibold text-red-900">{ERROR_LABELS[code]}</p>
      <p className="text-sm text-red-800">{message}</p>
    </div>
  );
}

function BlockingConflicts({ conflicts }: { conflicts: Conflict[] }) {
  if (conflicts.length === 0) return null;
  return (
    <div className="rounded-lg border-2 border-red-500 bg-red-50 p-4 flex flex-col gap-2">
      <p className="font-semibold text-red-900">This plan is incomplete</p>
      <ul className="flex flex-col gap-2">
        {conflicts.map((c, i) => (
          <li key={conflictKey(c, i)} className="text-sm text-red-900">
            {c.message}
            {c.suggestion && <span className="block text-red-800/80">→ {c.suggestion}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function WarningConflicts({ conflicts }: { conflicts: Conflict[] }) {
  if (conflicts.length === 0) return null;
  return (
    <div className="rounded-lg border border-amber-400 bg-amber-50 p-3 flex flex-col gap-1">
      {conflicts.map((c, i) => (
        <p key={conflictKey(c, i)} className="text-sm text-amber-900">
          {c.message}
        </p>
      ))}
    </div>
  );
}

function SuggestionConflicts({
  conflicts,
  dismissed,
  onDismiss,
}: {
  conflicts: Conflict[];
  dismissed: Set<string>;
  onDismiss: (key: string) => void;
}) {
  const visible = conflicts
    .map((c, i) => ({ conflict: c, key: conflictKey(c, i) }))
    .filter(({ key }) => !dismissed.has(key));
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {visible.map(({ conflict, key }) => (
        <div
          key={key}
          className="flex items-center justify-between gap-3 rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground"
        >
          <span>{conflict.message}</span>
          <button
            type="button"
            onClick={() => onDismiss(key)}
            aria-label="Dismiss"
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

function conflictsBySeverity(conflicts: Conflict[], severity: ConflictSeverity): Conflict[] {
  return conflicts.filter((c) => c.severity === severity);
}

export function PlanTab({
  hangoutId,
  isOrganizer,
  finalistsCount,
  initialItinerary,
}: {
  hangoutId: string;
  isOrganizer: boolean;
  finalistsCount: number;
  initialItinerary: DisplayItinerary | null;
}) {
  const router = useRouter();
  const [itinerary, setItinerary] = useState<DisplayItinerary | null>(initialItinerary);
  const [isGenerating, setIsGenerating] = useState(false);
  const [actionError, setActionError] = useState<{ code: GeneratePlanErrorCode; message: string } | null>(null);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());

  const belowMinFinalists = finalistsCount < MIN_FINALISTS_TO_GENERATE;

  const handleGenerate = async () => {
    setIsGenerating(true);
    setActionError(null);

    const response = await generatePlan(hangoutId);

    setIsGenerating(false);

    if (!response.ok) {
      setActionError(response.error);
      return;
    }

    setItinerary({
      id: response.itineraryId,
      generatedAt: new Date(),
      stops: response.result.itinerary,
      conflicts: response.result.conflicts,
    });
    setDismissedSuggestions(new Set());
    // Picks up hangouts.status -> "generated" for the header badge, and
    // keeps the server-rendered initialItinerary in sync for a refresh.
    router.refresh();
  };

  const blocking = itinerary ? conflictsBySeverity(itinerary.conflicts, "blocking") : [];
  const warnings = itinerary ? conflictsBySeverity(itinerary.conflicts, "warning") : [];
  const suggestions = itinerary ? conflictsBySeverity(itinerary.conflicts, "suggestion") : [];

  return (
    <div className="flex flex-col gap-6">
      {isOrganizer ? (
        <div className="flex flex-col gap-3">
          {belowMinFinalists && (
            <p className="text-sm text-muted-foreground">
              Add at least one finalist before generating a plan.
            </p>
          )}
          <Button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating || belowMinFinalists}
            className="self-start"
          >
            {isGenerating ? "Generating..." : itinerary ? "Regenerate plan" : "Generate plan"}
          </Button>
          {isGenerating && (
            <p className="text-sm text-muted-foreground">
              This can take a few seconds while we check real travel times…
            </p>
          )}
          {actionError && <ActionErrorBanner code={actionError.code} message={actionError.message} />}
        </div>
      ) : (
        !itinerary && (
          <p className="text-muted-foreground">Only the organizer can generate a plan.</p>
        )
      )}

      {itinerary ? (
        <div className="flex flex-col gap-4">
          <BlockingConflicts conflicts={blocking} />

          {itinerary.stops.length > 0 ? (
            <div className="flex flex-col gap-3">
              {itinerary.stops.map((stop, i) => (
                <ItineraryStopRow key={stop.placeId} stop={stop} index={i} />
              ))}
            </div>
          ) : (
            blocking.length === 0 && (
              <p className="text-muted-foreground">The generated plan has no stops.</p>
            )
          )}

          <WarningConflicts conflicts={warnings} />
          <SuggestionConflicts
            conflicts={suggestions}
            dismissed={dismissedSuggestions}
            onDismiss={(key) =>
              setDismissedSuggestions((prev) => new Set(prev).add(key))
            }
          />
        </div>
      ) : (
        isOrganizer &&
        !belowMinFinalists &&
        !isGenerating &&
        !actionError && (
          <p className="text-muted-foreground">
            No plan generated yet — click Generate plan above.
          </p>
        )
      )}
    </div>
  );
}
