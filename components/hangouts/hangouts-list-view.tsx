import { CtaButton } from "@/components/ui/cta-button";
import { PlanCard } from "@/components/ui/plan-card";
import { formatClock, formatDay } from "@/lib/format-time";

export type HangoutListItem = {
  id: string;
  name: string;
  status: string;
  start_time: string | null;
  timezone: string;
};

export function HangoutsListView({
  hangouts,
  canCreate,
}: {
  hangouts: HangoutListItem[];
  canCreate: boolean;
}) {
  const newPlanButton = canCreate && (
    <CtaButton
      href="/hangouts/new"
      className="w-auto px-3.5 py-3 text-xs tracking-[0.08em] md:w-auto md:px-5 md:text-[13px]"
    >
      + new plan
    </CtaButton>
  );

  if (hangouts.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4">
        <p className="font-grotesk text-sm lowercase text-[#4a5158]">
          you don&apos;t have any hangouts yet.
        </p>
        {newPlanButton}
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between md:mb-[22px]">
        <div className="font-grotesk text-xs font-bold uppercase tracking-[0.12em] md:text-[13px]">
          {hangouts.length} {hangouts.length === 1 ? "hangout" : "hangouts"}
        </div>
        {newPlanButton}
      </div>
      <div className="flex flex-col gap-3 md:gap-3.5">
        {hangouts.map((hangout) => {
          const start = hangout.start_time ? new Date(hangout.start_time) : null;
          const meta = start
            ? `${formatDay(start, hangout.timezone)} · ${formatClock(start, hangout.timezone)}`
            : undefined;
          return (
            <PlanCard
              key={hangout.id}
              href={`/hangouts/${hangout.id}`}
              name={hangout.name}
              meta={meta}
              status={hangout.status}
            />
          );
        })}
      </div>
    </>
  );
}
