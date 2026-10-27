"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import { CheckBox } from "@/components/ui/check-box";
import { Stepper } from "@/components/ui/stepper";
import { formatClock, parseClockInput } from "@/lib/format-time";
import {
  formatCategory,
  scrollListClass,
} from "@/components/hangouts/ideas-tab";
import type { ActionResult, HangoutStop } from "@/components/hangouts/types";

const VISIT_STEP_MINUTES = 15;
const MIN_VISIT_MINUTES = 15;
const MAX_VISIT_MINUTES = 480;

const colHead =
  "mb-2 font-grotesk text-[11px] font-bold uppercase tracking-[0.12em] md:mb-3 md:text-xs";
const cardBase =
  "box-border border-2 border-ink bg-input-white px-3.5 py-3 md:px-[18px] md:py-3.5";
const miniBtn =
  "border-2 border-ink px-3.5 py-[9px] font-grotesk text-[11px] font-bold uppercase tracking-[0.08em] whitespace-nowrap transition-opacity hover:opacity-85 disabled:opacity-50";
const ctlLabel =
  "mb-1.5 block font-grotesk text-[10px] font-bold uppercase tracking-[0.12em]";

const voteLabel = (n: number) => `${n} ${n === 1 ? "vote" : "votes"}`;

function CandidateRow({
  stop,
  addedBy,
  canAdd,
  disabled,
  onMove,
}: {
  stop: HangoutStop;
  addedBy: string;
  canAdd: boolean;
  disabled: boolean;
  onMove: (stopId: string) => Promise<ActionResult>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const category = formatCategory(stop.place.primary_type);

  const handleClick = async () => {
    setIsLoading(true);
    setError(null);
    const result = await onMove(stop.id);
    setIsLoading(false);
    if (result.error) setError(result.error);
  };

  return (
    <div className={cardBase}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-grotesk text-base font-bold lowercase md:text-[17px]">
            {stop.place.name}
          </div>
          <div className="mt-[3px] font-grotesk text-xs lowercase text-[#4a5158]">
            {category && `${category} · `}
            {voteLabel(stop.votes.length)} · added by {addedBy}
          </div>
        </div>
        {canAdd && (
          <button
            type="button"
            disabled={disabled || isLoading}
            onClick={handleClick}
            className={cn(miniBtn, "bg-ink text-bg")}
          >
            + finalist
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-2 font-grotesk text-sm lowercase text-[#8a1c1c]">
          {error}
        </p>
      )}
    </div>
  );
}

function FinalistCard({
  stop,
  isOrganizer,
  timezone,
  onRemove,
  onUpdateVisitDuration,
  onUpdateSettings,
  toReservationInstant,
}: {
  stop: HangoutStop;
  isOrganizer: boolean;
  timezone: string;
  onRemove: (stopId: string) => Promise<ActionResult>;
  onUpdateVisitDuration: (
    stopId: string,
    minutes: number,
  ) => Promise<ActionResult>;
  onUpdateSettings: (
    stopId: string,
    changes: { is_required?: boolean; reservation_time?: string | null },
  ) => Promise<ActionResult>;
  toReservationInstant: (minutesOfDay: number) => string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const savedReservation = stop.reservation_time
    ? formatClock(new Date(stop.reservation_time), timezone)
    : "";
  // Draft text while typing; null means "show the saved value".
  const [draft, setDraft] = useState<string | null>(null);
  const category = formatCategory(stop.place.primary_type);

  const run = async (action: () => Promise<ActionResult>) => {
    setBusy(true);
    setError(null);
    const result = await action();
    setBusy(false);
    if (result.error) setError(result.error);
    return !result.error;
  };

  const commitReservation = async () => {
    if (draft === null) return;
    const text = draft.trim();
    if (text === savedReservation) {
      setDraft(null);
      return;
    }
    if (text === "") {
      if (await run(() => onUpdateSettings(stop.id, { reservation_time: null })))
        setDraft(null);
      return;
    }
    const minutes = parseClockInput(text);
    if (minutes === null) {
      setError("try a time like 4:15 pm");
      return;
    }
    const saved = await run(() =>
      onUpdateSettings(stop.id, {
        reservation_time: toReservationInstant(minutes),
      }),
    );
    if (saved) setDraft(null);
  };

  return (
    <div className={cardBase}>
      <div className="mb-2.5 flex items-center justify-between gap-3 md:mb-3">
        <div className="min-w-0">
          <div className="font-grotesk text-base font-bold lowercase md:text-[17px]">
            {stop.place.name}
          </div>
          <div className="mt-[3px] font-grotesk text-xs lowercase text-[#4a5158]">
            {category && `${category} · `}
            {voteLabel(stop.votes.length)}
          </div>
        </div>
        {isOrganizer && (
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => onRemove(stop.id))}
            className={cn(miniBtn, "bg-input-white text-ink")}
          >
            remove
          </button>
        )}
      </div>

      <div className="flex items-start gap-2.5 md:items-end md:gap-7">
        <div>
          <label className={ctlLabel}>visit time</label>
          <Stepper
            size="sm"
            unit="min"
            step={VISIT_STEP_MINUTES}
            min={MIN_VISIT_MINUTES}
            max={MAX_VISIT_MINUTES}
            value={stop.visit_duration_minutes}
            disabled={!isOrganizer || busy}
            onChange={(minutes) =>
              run(() => onUpdateVisitDuration(stop.id, minutes))
            }
          />
        </div>
        <div>
          <label className={ctlLabel}>
            required<span className="hidden md:inline"> stop</span>
          </label>
          <CheckBox
            label={`${stop.place.name} is a required stop`}
            checked={stop.is_required}
            disabled={!isOrganizer || busy}
            onChange={(checked) =>
              run(() => onUpdateSettings(stop.id, { is_required: checked }))
            }
          />
        </div>
        <div className="min-w-0 flex-1 md:flex-none">
          <label className={ctlLabel} htmlFor={`reservation-${stop.id}`}>
            reservation<span className="hidden md:inline"> (optional)</span>
          </label>
          <input
            id={`reservation-${stop.id}`}
            type="text"
            disabled={!isOrganizer || busy}
            placeholder="e.g. 4:15 pm"
            value={draft ?? savedReservation}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitReservation}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            className="box-border h-8 w-full border-2 border-ink bg-input-white px-2 py-1.5 font-grotesk text-[13px] lowercase text-ink outline-none md:px-2.5 md:text-sm placeholder:lowercase placeholder:text-[#6b7078] disabled:opacity-60 md:w-[150px]"
          />
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

export function FinalistsTab({
  isOrganizer,
  memberNames,
  timezone,
  candidates,
  finalists,
  maxFinalists,
  onMoveToFinalists,
  onRemoveFromFinalists,
  onUpdateVisitDuration,
  onUpdateSettings,
  toReservationInstant,
}: {
  isOrganizer: boolean;
  memberNames: Record<string, string>;
  timezone: string;
  candidates: HangoutStop[];
  finalists: HangoutStop[];
  maxFinalists: number;
  onMoveToFinalists: (stopId: string) => Promise<ActionResult>;
  onRemoveFromFinalists: (stopId: string) => Promise<ActionResult>;
  onUpdateVisitDuration: (
    stopId: string,
    minutes: number,
  ) => Promise<ActionResult>;
  onUpdateSettings: (
    stopId: string,
    changes: { is_required?: boolean; reservation_time?: string | null },
  ) => Promise<ActionResult>;
  toReservationInstant: (minutesOfDay: number) => string;
}) {
  const atCap = finalists.length >= maxFinalists;
  const sortedCandidates = [...candidates].sort(
    (a, b) => b.votes.length - a.votes.length,
  );

  // DOM order is finalists first (mobile: finalists, then other ideas);
  // on desktop the row is reversed so other ideas sit on the left.
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 md:flex-row-reverse md:gap-8">
      <div className="flex min-h-0 flex-col md:flex-1">
        <div className={colHead}>
          {finalists.length} / {maxFinalists} finalists
        </div>
        {finalists.length === 0 ? (
          <p className="font-grotesk text-sm lowercase text-[#4a5158]">
            no finalists yet
            {isOrganizer ? " — add one from the other ideas." : "."}
          </p>
        ) : (
          <div
            className={cn(
              "flex min-h-0 flex-1 flex-col gap-2 md:gap-2.5",
              scrollListClass,
            )}
          >
            {finalists.map((stop) => (
              <FinalistCard
                key={stop.id}
                stop={stop}
                isOrganizer={isOrganizer}
                timezone={timezone}
                onRemove={onRemoveFromFinalists}
                onUpdateVisitDuration={onUpdateVisitDuration}
                onUpdateSettings={onUpdateSettings}
                toReservationInstant={toReservationInstant}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-col md:w-[400px] md:flex-none">
        <div className={cn(colHead, "mt-2 md:mt-0")}>other ideas · by votes</div>
        {atCap && isOrganizer && (
          <p className="mb-2 font-grotesk text-xs lowercase text-[#4a5158]">
            finalists are capped at {maxFinalists}. remove one before adding
            another.
          </p>
        )}
        {sortedCandidates.length === 0 ? (
          <p className="font-grotesk text-sm lowercase text-[#4a5158]">
            no other ideas — add some in the ideas tab.
          </p>
        ) : (
          <div
            className={cn(
              "flex min-h-0 flex-1 flex-col gap-2 md:gap-2.5",
              scrollListClass,
            )}
          >
            {sortedCandidates.map((stop) => (
              <CandidateRow
                key={stop.id}
                stop={stop}
                addedBy={memberNames[stop.suggested_by]?.toLowerCase() ?? "someone"}
                canAdd={isOrganizer}
                disabled={atCap}
                onMove={onMoveToFinalists}
              />
            ))}
          </div>
        )}
        <div className="mt-3 hidden border-2 border-ink bg-input-white/55 px-[18px] py-3.5 font-grotesk text-xs lowercase leading-normal md:block">
          only the organizer picks finalists. votes are a guide, not a rule.
        </div>
      </div>
    </div>
  );
}
