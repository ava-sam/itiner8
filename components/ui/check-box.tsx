import { cn } from "@/lib/utils";

export function CheckBox({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex h-[22px] w-[22px] items-center justify-center border-2 border-ink text-sm font-bold leading-none disabled:cursor-not-allowed disabled:opacity-60",
        checked ? "bg-sel-blue text-bg" : "bg-input-white",
      )}
    >
      {checked ? "✓" : ""}
    </button>
  );
}
