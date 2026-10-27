import { cn } from "@/lib/utils";

type StepperProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  className?: string;
};

const stepBtn =
  "flex h-11 w-11 box-border items-center justify-center border-2 border-ink bg-input-white font-grotesk text-xl text-ink disabled:opacity-40";

export function Stepper({
  value,
  onChange,
  min = 0,
  max = Infinity,
  step = 1,
  unit,
  className,
}: StepperProps) {
  return (
    <div className={cn("flex items-center gap-3 md:gap-3.5", className)}>
      <button
        type="button"
        className={stepBtn}
        aria-label="decrease"
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - step))}
      >
        −
      </button>
      <div
        aria-live="polite"
        className="min-w-16 text-center font-grotesk text-[15px] font-bold uppercase md:min-w-[72px] md:text-base"
      >
        {value}
        {unit ? ` ${unit}` : ""}
      </div>
      <button
        type="button"
        className={stepBtn}
        aria-label="increase"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + step))}
      >
        +
      </button>
    </div>
  );
}
