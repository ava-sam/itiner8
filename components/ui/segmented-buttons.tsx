import { cn } from "@/lib/utils";

type Option<T extends string> = {
  value: T;
  label: string;
  disabled?: boolean;
};

type SegmentedButtonsProps<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Color of the selected option: blue sheets use "blue", grey sheets use "grey". */
  tone?: "blue" | "grey";
  "aria-label"?: string;
  className?: string;
};

export function SegmentedButtons<T extends string>({
  options,
  value,
  onChange,
  tone = "blue",
  className,
  ...rest
}: SegmentedButtonsProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={rest["aria-label"]}
      className={cn("flex gap-2 md:gap-3", className)}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              "box-border flex-1 border-2 border-ink py-3 text-center font-grotesk text-xs font-bold uppercase tracking-[0.06em] md:py-3.5 md:text-[13px]",
              active
                ? cn("text-bg", tone === "grey" ? "bg-sel-grey" : "bg-sel-blue")
                : "bg-input-white text-ink",
              o.disabled && "cursor-not-allowed opacity-40",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
