import Link from "next/link";
import { StatusPill } from "@/components/ui/status-pill";
import { cn } from "@/lib/utils";

type PlanCardProps = {
  href: string;
  name: string;
  /** e.g. "sat, oct 4 · 2:00 pm · 6 stops" */
  meta?: string;
  status: string;
  className?: string;
};

/** Stacked on mobile (pill first), name left / pill right on desktop. */
export function PlanCard({ href, name, meta, status, className }: PlanCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        "box-border flex w-full flex-col items-start gap-2 border-2 border-ink bg-input-white px-4 py-3.5 transition-transform duration-150 hover:translate-x-1 md:flex-row-reverse md:items-center md:justify-between md:px-[22px] md:py-[18px]",
        className,
      )}
    >
      <StatusPill status={status} />
      <div>
        <div className="font-grotesk text-base font-bold lowercase text-ink md:text-[19px]">
          {name}
        </div>
        {meta && (
          <div className="mt-[3px] font-grotesk text-xs lowercase text-[#4a5158] md:mt-1 md:text-[13px]">
            {meta}
          </div>
        )}
      </div>
    </Link>
  );
}
