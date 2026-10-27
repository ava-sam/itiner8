"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { buildIcs, downloadIcs } from "@/lib/calendar";
import { formatClock, formatDay, formatMinutes } from "@/lib/format-time";
import { AvatarStack } from "@/components/ui/avatar-stack";
import { MapPlaceholder } from "@/components/ui/map-placeholder";
import { SectionPage } from "@/components/ui/section-page";
import { StatusPill } from "@/components/ui/status-pill";
import { scrollListClass, formatCategory } from "@/components/hangouts/ideas-tab";
import { TRAVEL_WORDS } from "@/components/hangouts/plan-tab";
import type {
  DisplayItineraryStop,
  HangoutMeta,
  ItineraryPlaceDetails,
  RoomMember,
} from "@/components/hangouts/types";

const badgeBase =
  "whitespace-nowrap border-[1.5px] border-ink px-[9px] py-1 font-grotesk text-[10px] font-bold uppercase tracking-[0.08em]";
const btn =
  "box-border flex-1 border-2 border-ink px-5 py-2.5 font-grotesk text-[11px] font-bold uppercase tracking-[0.08em] whitespace-nowrap transition-opacity hover:opacity-85 md:flex-none md:py-[11px] md:text-xs";

function DetailRow({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex justify-between gap-4 border-b border-ink/20 py-2 last:border-b-0",
        className,
      )}
    >
      <div className="pt-0.5 font-grotesk text-[10px] font-bold uppercase tracking-[0.12em] text-[#4a5158]">
        {label}
      </div>
      <div className="text-right font-grotesk text-[13px] lowercase">{children}</div>
    </div>
  );
}

export function FinalPlanView({
  hangout,
  members,
  stops,
  placeDetails,
}: {
  hangout: HangoutMeta;
  members: RoomMember[];
  stops: DisplayItineraryStop[];
  placeDetails: Record<string, ItineraryPlaceDetails>;
}) {
  const { timezone } = hangout;
  const words = TRAVEL_WORDS[hangout.transportationMode];
  const [shared, setShared] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const first = stops[0];
  const last = stops[stops.length - 1];
  const totalTravel = stops.slice(1).reduce((sum, s) => sum + s.travelMinutesFromPrevious, 0);
  const memberNames = members.map((m) => m.name);

  const dateLine = first
    ? `${formatDay(first.arrival, timezone)} · ${formatClock(first.arrival, timezone)} – ${formatClock(last.visitEnd, timezone)}`
    : formatDay(new Date(hangout.startTime), timezone);

  const shareLink = async () => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/join?code=${hangout.inviteCode}`,
      );
      setShared(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setShared(false), 1500);
    } catch {
      // Clipboard unavailable: nothing useful to do.
    }
  };

  const addToCalendar = () => {
    const ics = buildIcs({
      hangoutId: hangout.id,
      hangoutName: hangout.name,
      timeZone: timezone,
      stops: stops.map((s) => ({
        name: s.name,
        address: placeDetails[s.placeId]?.address,
        start: s.visitStart,
        end: s.visitEnd,
      })),
    });
    const slug =
      hangout.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "hangout";
    downloadIcs(`${slug}.ics`, ics);
  };

  const actions = (
    <div className="flex gap-2 md:gap-3.5">
      <button type="button" onClick={shareLink} className={cn(btn, "bg-input-white text-ink")}>
        {shared ? "copied" : "share link"}
      </button>
      <button
        type="button"
        onClick={addToCalendar}
        disabled={stops.length === 0}
        className={cn(btn, "bg-ink text-bg disabled:opacity-50")}
      >
        add to calendar
      </button>
    </div>
  );

  return (
    <SectionPage
      label="final plan"
      color="#93a4c1"
      texture="/textures/texture-brown.png"
      textureOpacity={0.22}
      backLabel="back to plans"
      contained
      sheetClassName="p-4 md:px-10 md:py-8"
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mb-3 flex flex-col md:mb-[26px] md:flex-row md:items-start md:justify-between md:gap-6">
          <div className="min-w-0">
            <div className="flex items-center justify-between gap-2 md:justify-start md:gap-[18px]">
              <h1 className="min-w-0 font-display text-[22px] uppercase leading-[1.1] tracking-[0.02em] md:whitespace-nowrap md:text-[38px] md:leading-none">
                {hangout.name}
              </h1>
              <StatusPill status={hangout.status} />
            </div>
            <div className="mb-3 mt-1.5 font-grotesk text-[10px] font-bold uppercase tracking-[0.1em] md:mb-0 md:mt-3 md:text-xs md:tracking-[0.12em]">
              {dateLine} · organized by {hangout.organizerName.toLowerCase()}
            </div>
          </div>
          <div className="flex items-center md:gap-3.5">
            <AvatarStack names={memberNames} className="mr-2 hidden md:flex" />
            {actions}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 md:flex-row md:gap-8">
          {/* mobile: details above the timeline; desktop: details in the right column */}
          <div className="box-border border-2 border-ink bg-input-white px-3 py-0.5 md:hidden">
            <DetailRow label="start">{hangout.startLabel}</DetailRow>
            <DetailRow label="travel">
              {hangout.transportationMode} · {formatMinutes(totalTravel)} total
            </DetailRow>
            <DetailRow label="members">{memberNames.join(", ").toLowerCase()}</DetailRow>
          </div>

          <div className="flex min-h-0 flex-col md:w-[640px] md:flex-none">
            <div className="mb-3.5 hidden font-grotesk text-xs font-bold uppercase tracking-[0.12em] md:block">
              {stops.length} {stops.length === 1 ? "stop" : "stops"} · {formatMinutes(totalTravel)} {words.gerund}
            </div>
            {stops.length === 0 ? (
              <p className="font-grotesk text-sm lowercase text-[#4a5158]">
                this plan has no stops.
              </p>
            ) : (
              <div className={cn("flex min-h-0 flex-1 flex-col", scrollListClass)}>
                {stops.map((stop, i) => {
                  const d = placeDetails[stop.placeId];
                  const visitMinutes =
                    (stop.visitEnd.getTime() - stop.visitStart.getTime()) / 60_000;
                  const category = formatCategory(d?.category);
                  return (
                    <div key={stop.placeId}>
                      <div className="flex gap-3 md:gap-4">
                        <div className="w-14 flex-none pt-[15px] text-right font-grotesk text-xs font-bold lowercase md:w-[76px] md:text-sm">
                          {formatClock(stop.arrival, timezone)}
                        </div>
                        <div className="box-border min-w-0 flex-1 border-2 border-ink bg-input-white px-4 py-3">
                          <div className="flex items-center justify-between gap-2.5">
                            <div className="font-grotesk text-base font-bold lowercase md:text-[17px]">
                              {stop.name}
                            </div>
                            {stop.isReservation && (
                              <span className={cn(badgeBase, "hidden bg-grey md:inline")}>
                                reservation {formatClock(stop.visitStart, timezone)}
                              </span>
                            )}
                          </div>
                          <div className="mt-[3px] font-grotesk text-xs lowercase text-[#4a5158]">
                            {category && `${category} · `}
                            <span className="hidden md:inline">
                              {d?.address && `${d.address} · `}
                            </span>
                            {formatMinutes(visitMinutes)}
                          </div>
                          {stop.isReservation && (
                            <div className="mt-1.5 md:hidden">
                              <span className={cn(badgeBase, "bg-grey")}>
                                reservation {formatClock(stop.visitStart, timezone)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      {i < stops.length - 1 && (
                        <div className="flex h-[26px] items-center gap-3 md:h-[30px] md:gap-4">
                          <div className="w-14 flex-none md:w-[76px]" />
                          <div className="flex flex-1 items-center gap-2 pl-3 font-grotesk text-[10px] font-bold uppercase tracking-[0.08em] text-[#4a5158] before:h-[26px] before:w-0 before:border-l-2 before:border-dashed before:border-ink md:gap-2.5 md:pl-4 md:text-[11px] md:tracking-[0.1em] md:before:h-[30px]">
                            {words.verb} · {formatMinutes(stops[i + 1].travelMinutesFromPrevious)}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="hidden min-h-0 flex-1 flex-col gap-3.5 md:flex">
            <div className="box-border border-2 border-ink bg-input-white px-[18px] py-1.5">
              <DetailRow label="start">{hangout.startLabel}</DetailRow>
              <DetailRow label="end">{hangout.endLabel ?? "last stop"}</DetailRow>
              <DetailRow label="travel">{hangout.transportationMode}</DetailRow>
              <DetailRow label="finalized">
                {formatDay(new Date(hangout.updatedAt), timezone)} · by{" "}
                {hangout.organizerName.toLowerCase()}
              </DetailRow>
            </div>
            <MapPlaceholder label="route map appears here" className="min-h-0 flex-1" />
          </div>
        </div>
      </div>
    </SectionPage>
  );
}
