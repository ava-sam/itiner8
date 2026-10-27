import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  generated: "bg-light-blue",
  planning: "bg-grey",
  finalized: "bg-blue",
  completed: "bg-ink text-bg",
};

export function StatusPill({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block whitespace-nowrap border-[1.5px] border-ink px-3 py-[5px] font-grotesk text-[10px] font-bold uppercase tracking-[0.08em] md:px-3.5 md:py-1.5 md:text-[11px]",
        STATUS_STYLES[status] ?? "bg-grey",
        className,
      )}
    >
      {status}
    </span>
  );
}
