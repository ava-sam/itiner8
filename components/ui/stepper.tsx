import { cn } from "@/lib/utils";

type StepperProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  /** "sm" matches the compact controls on finalist cards. */
  size?: "md" | "sm";
  disabled?: boolean;
  className?: string;
};

const stepBtn =
  "flex box-border items-center justify-center border-2 border-ink bg-input-white font-grotesk text-ink disabled:opacity-40";

export function Stepper({
  value,
  onChange,
  min = 0,
  max = Infinity,
  step = 1,
  unit,
  size = "md",
  disabled,
  className,
}: StepperProps) {
  const small = size === "sm";
  const btn = cn(stepBtn, small ? "h-8 w-8 text-base" : "h-11 w-11 text-xl");
  return (
    <div
      className={cn(
        "flex items-center",
        small ? "gap-1.5 md:gap-2" : "gap-3 md:gap-3.5",
        className,
      )}
    >
      <button
        type="button"
        className={btn}
        aria-label="decrease"
        disabled={disabled || value <= min}
        onClick={() => onChange(Math.max(min, value - step))}
      >
        −
      </button>
      <div
        aria-live="polite"
        className={cn(
          "text-center font-grotesk font-bold uppercase",
          small
            ? "min-w-9 text-[11px] md:min-w-[52px] md:text-[13px]"
            : "min-w-16 text-[15px] md:min-w-[72px] md:text-base",
        )}
      >
        {value}
        {unit ? ` ${unit}` : ""}
      </div>
      <button
        type="button"
        className={btn}
        aria-label="increase"
        disabled={disabled || value >= max}
        onClick={() => onChange(Math.min(max, value + step))}
      >
        +
      </button>
    </div>
  );
}
