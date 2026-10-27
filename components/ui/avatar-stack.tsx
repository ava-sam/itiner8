import { cn } from "@/lib/utils";

const AVATAR_COLORS = ["#93a4c1", "#b1b2ae", "#aebbd2", "#fbfaf6"];

/** Overlapping initials; first `max` members, then a +N bubble. */
export function AvatarStack({
  names,
  max = 4,
  className,
}: {
  names: string[];
  max?: number;
  className?: string;
}) {
  const shown = names.slice(0, max);
  const extra = names.length - shown.length;
  const bubble =
    "-ml-2 flex h-[34px] w-[34px] items-center justify-center rounded-full border-2 border-ink font-grotesk text-[13px] font-bold uppercase";

  return (
    <div className={cn("flex items-center pl-2", className)}>
      {shown.map((name, i) => (
        <div
          key={`${name}-${i}`}
          title={name}
          className={bubble}
          style={{ backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length] }}
        >
          {name.trim().charAt(0)}
        </div>
      ))}
      {extra > 0 && (
        <div
          title={names.slice(max).join(", ")}
          className={cn(bubble, "bg-ink text-bg")}
        >
          +{extra}
        </div>
      )}
    </div>
  );
}
