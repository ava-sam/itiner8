"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { generatePlan, type GeneratePlanErrorCode } from "@/app/hangouts/[id]/actions";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { formatClock, formatMinutes } from "@/lib/format-time";
import { MapPlaceholder } from "@/components/ui/map-placeholder";
import { scrollListClass } from "@/components/hangouts/ideas-tab";
import type { Conflict, ConflictSeverity } from "@/lib/optimizer/types";
import type {
  DisplayItinerary,
  DisplayItineraryStop,
  HangoutMeta,
  ItineraryPlaceDetails,
} from "@/components/hangouts/types";

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

export const TRAVEL_WORDS = {
  driving: { verb: "drive", gerund: "driving" },
  walking: { verb: "walk", gerund: "walking" },
  transit: { verb: "transit", gerund: "on transit" },
} as const;

const SEVERITY_TAG: Record<ConflictSeverity, { label: string; className: string }> = {
  blocking: { label: "blocking", className: "bg-ink text-bg" },
  warning: { label: "warning", className: "bg-grey" },
  suggestion: { label: "suggestion", className: "bg-light-blue" },
};

const btn =
  "box-border flex-1 border-2 border-ink px-5 py-[11px] font-grotesk text-[11px] font-bold uppercase tracking-[0.08em] whitespace-nowrap transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50 md:flex-none md:text-xs";

const badgeBase =
  "whitespace-nowrap border-[1.5px] border-ink px-[9px] py-1 font-grotesk text-[10px] font-bold uppercase tracking-[0.08em]";

function conflictKey(conflict: Conflict, index: number): string {
  return `${conflict.code}-${conflict.placeIds.join(",")}-${index}`;
}

function conflictsBySeverity(conflicts: Conflict[], severity: ConflictSeverity): Conflict[] {
  return conflicts.filter((c) => c.severity === severity);
}

function Notice({
  severity,
  message,
  suggestion,
  onDismiss,
}: {
  severity: ConflictSeverity;
  message: string;
  suggestion?: string;
  onDismiss?: () => void;
}) {
  const tag = SEVERITY_TAG[severity];
  return (
    <div className="box-border flex items-start gap-3 border-2 border-ink bg-input-white px-3.5 py-2.5">
      <span
        className={cn(
          "flex-none border-[1.5px] border-ink px-2 py-1 font-grotesk text-[10px] font-bold uppercase tracking-[0.1em]",
          tag.className,
        )}
      >
        {tag.label}
      </span>
      <div className="min-w-0 flex-1 font-grotesk text-xs lowercase leading-normal">
        {message}
        {suggestion && (
          <span className="block text-[#4a5158]">→ {suggestion}</span>
        )}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="dismiss"
          className="flex-none font-grotesk text-sm font-bold leading-none text-[#4a5158] hover:text-ink"
        >
          ✕
        </button>
      )}
    </div>
  );
}

function ActionErrorBanner({ code, message }: { code: GeneratePlanErrorCode; message: string }) {
  return (
    <div
      role="alert"
      className="box-border border-2 border-ink bg-input-white px-3.5 py-2.5"
    >
      <p className="font-grotesk text-[11px] font-bold uppercase tracking-[0.1em] text-[#8a1c1c]">
        {ERROR_LABELS[code]}
      </p>
      <p className="mt-1 font-grotesk text-xs lowercase leading-normal">{message}</p>
    </div>
  );
}

function StopRow({
  stop,
  isLast,
  timezone,
  details,
}: {
  stop: DisplayItineraryStop;
  isLast: boolean;
  timezone: string;
  details?: ItineraryPlaceDetails;
}) {
  const visitMinutes = (stop.visitEnd.getTime() - stop.visitStart.getTime()) / 60_000;
  const closes =
    !stop.fitsOpeningHours && details?.closesAt
      ? formatClock(new Date(details.closesAt), timezone)
      : null;

  const badges =
    stop.isReservation || stop.isRequired || closes ? (
      <>
        {stop.isReservation && (
          <span className={cn(badgeBase, "bg-grey")}>
            reservation {formatClock(stop.visitStart, timezone)}
          </span>
        )}
        {stop.isRequired && <span className={cn(badgeBase, "bg-blue")}>required</span>}
        {closes && (
          <span className={cn(badgeBase, "bg-input-white")}>closes {closes}</span>
        )}
      </>
    ) : null;

  return (
    <div className="flex gap-3 md:gap-4">
      <div className="w-14 flex-none pt-[15px] text-right font-grotesk text-xs font-bold lowercase md:w-[76px] md:text-sm">
        {formatClock(stop.arrival, timezone)}
      </div>
      <div className="box-border min-w-0 flex-1 border-2 border-ink bg-input-white px-4 py-3">
        <div className="flex items-center justify-between gap-2.5">
          <div className="font-grotesk text-base font-bold lowercase md:text-[17px]">
            {stop.name}
          </div>
          {badges && <div className="hidden gap-1.5 md:flex">{badges}</div>}
        </div>
        <div className="mt-[3px] font-grotesk text-xs lowercase text-[#4a5158]">
          {stop.waitMinutes > 0 && `wait ${formatMinutes(stop.waitMinutes)} · `}
          visit {formatMinutes(visitMinutes)} · {isLast ? "ends" : "leave"}{" "}
          {formatClock(stop.visitEnd, timezone)}
        </div>
        {badges && <div className="mt-1.5 flex flex-wrap gap-[5px] md:hidden">{badges}</div>}
      </div>
    </div>
  );
}

function TravelConnector({
  verb,
  minutes,
  buffer,
}: {
  verb: string;
  minutes: number;
  buffer: number;
}) {
  return (
    <div className="flex h-[26px] items-center gap-3 md:h-[30px] md:gap-4">
      <div className="w-14 flex-none md:w-[76px]" />
      <div className="flex flex-1 items-center gap-2 pl-3 font-grotesk text-[10px] font-bold uppercase tracking-[0.08em] text-[#4a5158] before:h-[26px] before:w-0 before:border-l-2 before:border-dashed before:border-ink md:gap-2.5 md:pl-4 md:text-[11px] md:tracking-[0.1em] md:before:h-[30px]">
        <span>
          {verb} · {formatMinutes(minutes)}
          {buffer > 0 && (
            <>
              {" "}
              + {buffer}
              <span className="hidden md:inline"> min</span> buffer
            </>
          )}
        </span>
      </div>
    </div>
  );
}

export function PlanTab({
  hangout,
  isOrganizer,
  finalistsCount,
  initialItinerary,
  placeDetails,
}: {
  hangout: HangoutMeta;
  isOrganizer: boolean;
  finalistsCount: number;
  initialItinerary: DisplayItinerary | null;
  placeDetails: Record<string, ItineraryPlaceDetails>;
}) {
  const router = useRouter();
  const [itinerary, setItinerary] = useState<DisplayItinerary | null>(initialItinerary);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ code: GeneratePlanErrorCode; message: string } | null>(null);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());

  const { timezone, bufferMinutes } = hangout;
  const words = TRAVEL_WORDS[hangout.transportationMode];
  const belowMinFinalists = finalistsCount < MIN_FINALISTS_TO_GENERATE;

  const handleGenerate = async () => {
    setIsGenerating(true);
    setActionError(null);

    const response = await generatePlan(hangout.id);

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
  const suggestions = itinerary
    ? itinerary.conflicts
        .map((c, i) => ({ conflict: c, key: conflictKey(c, i) }))
        .filter(({ conflict }) => conflict.severity === "suggestion")
        .filter(({ key }) => !dismissedSuggestions.has(key))
    : [];

  const stops = itinerary?.stops ?? [];
  const canFinalize = stops.length > 0 && blocking.length === 0;

  const handleFinalize = async () => {
    if (!window.confirm("finalize this plan? the planning room will close.")) return;
    setIsFinalizing(true);
    setFinalizeError(null);
    const { error } = await createClient()
      .from("hangouts")
      .update({ status: "finalized" })
      .eq("id", hangout.id);
    setIsFinalizing(false);
    if (error) {
      setFinalizeError(error.message);
      return;
    }
    // The server page swaps the tabs for the final-plan view.
    router.refresh();
  };

  const totalTravel = stops.slice(1).reduce((sum, s) => sum + s.travelMinutesFromPrevious, 0);
  const summary =
    stops.length > 0
      ? `${stops.length} ${stops.length === 1 ? "stop" : "stops"} · ${formatClock(stops[0].arrival, timezone)} – ${formatClock(stops[stops.length - 1].visitEnd, timezone)} · ${formatMinutes(totalTravel)} ${words.gerund}`
      : "no plan yet";

  const controls = isOrganizer && (
    <div className="mb-3 flex gap-2 md:mb-0 md:gap-2.5">
      <button
        type="button"
        onClick={handleGenerate}
        disabled={isGenerating || belowMinFinalists}
        className={cn(btn, "bg-input-white text-ink")}
      >
        {isGenerating ? "generating…" : itinerary ? "regenerate" : "generate plan"}
      </button>
      {itinerary && (
        <button
          type="button"
          onClick={handleFinalize}
          disabled={!canFinalize || isGenerating || isFinalizing}
          title={
            canFinalize ? undefined : "resolve the blocking issues before finalizing"
          }
          className={cn(btn, "bg-ink text-bg")}
        >
          {isFinalizing ? "finalizing…" : "finalize plan"}
        </button>
      )}
    </div>
  );

  const messages = (
    <>
      {isOrganizer && belowMinFinalists && (
        <p className="mb-2 font-grotesk text-xs lowercase text-[#4a5158]">
          add at least one finalist before generating a plan.
        </p>
      )}
      {isGenerating && (
        <p className="mb-2 font-grotesk text-xs lowercase text-[#4a5158]">
          this can take a few seconds while we check real travel times…
        </p>
      )}
      {actionError && (
        <div className="mb-3">
          <ActionErrorBanner code={actionError.code} message={actionError.message} />
        </div>
      )}
      {finalizeError && (
        <p role="alert" className="mb-2 font-grotesk text-sm lowercase text-[#8a1c1c]">
          {finalizeError}
        </p>
      )}
    </>
  );

  if (!itinerary) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mb-3.5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="font-grotesk text-[10px] font-bold uppercase tracking-[0.1em] md:text-xs md:tracking-[0.12em]">
            {summary}
          </div>
          {controls}
        </div>
        {messages}
        <div className="flex flex-1 items-center justify-center border-2 border-ink bg-input-white/55 p-6 text-center font-grotesk text-sm lowercase text-[#4a5158]">
          {isOrganizer
            ? belowMinFinalists
              ? "no plan yet — pick finalists first."
              : "no plan generated yet — hit generate plan above."
            : "only the organizer can generate a plan."}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 md:flex-row md:gap-8">
      <div className="flex min-h-0 flex-col md:w-[640px] md:flex-none">
        <div className="mb-2 flex flex-col md:mb-3.5 md:flex-row md:items-center md:justify-between md:gap-3">
          <div className="mb-2 font-grotesk text-[10px] font-bold uppercase tracking-[0.1em] md:mb-0 md:text-xs md:tracking-[0.12em]">
            {summary}
          </div>
          {controls}
        </div>
        {messages}

        {stops.length > 0 ? (
          <div className={cn("flex min-h-0 flex-1 flex-col", scrollListClass)}>
            {stops.map((stop, i) => (
              <div key={stop.placeId}>
                <StopRow
                  stop={stop}
                  isLast={i === stops.length - 1}
                  timezone={timezone}
                  details={placeDetails[stop.placeId]}
                />
                {i < stops.length - 1 && (
                  <TravelConnector
                    verb={words.verb}
                    minutes={stops[i + 1].travelMinutesFromPrevious}
                    buffer={bufferMinutes}
                  />
                )}
              </div>
            ))}
          </div>
        ) : (
          blocking.length === 0 && (
            <p className="font-grotesk text-sm lowercase text-[#4a5158]">
              the generated plan has no stops.
            </p>
          )
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3.5">
        <MapPlaceholder
          label="route map appears here"
          className="min-h-0 flex-1"
        />
        <div
          className={cn(
            "flex flex-col gap-2 md:max-h-[45%] md:flex-none md:overflow-y-auto",
            scrollListClass,
          )}
        >
          {blocking.length > 0 && (
            <div className="box-border flex flex-col gap-2 border-2 border-ink bg-input-white/55 p-3">
              <p className="font-grotesk text-[11px] font-bold uppercase tracking-[0.1em]">
                this plan is incomplete
              </p>
              {blocking.map((c, i) => (
                <Notice
                  key={conflictKey(c, i)}
                  severity="blocking"
                  message={c.message}
                  suggestion={c.suggestion}
                />
              ))}
            </div>
          )}
          {warnings.map((c, i) => (
            <Notice key={conflictKey(c, i)} severity="warning" message={c.message} />
          ))}
          {suggestions.map(({ conflict, key }) => (
            <Notice
              key={key}
              severity="suggestion"
              message={conflict.message}
              onDismiss={() =>
                setDismissedSuggestions((prev) => new Set(prev).add(key))
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
