import { cn } from "@/lib/utils";

export const fieldInputClass =
  "block w-full box-border border-2 border-ink bg-input-white p-3 font-grotesk text-[15px] lowercase text-ink outline-none placeholder:lowercase placeholder:text-[#6b7078] focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-transparent";

type FieldProps = Omit<React.ComponentProps<"input">, "children"> & {
  label: string;
  /** Replace the default <input> (e.g. with a Places Autocomplete control). */
  children?: React.ReactNode;
  wrapperClassName?: string;
};

export function Field({
  label,
  id,
  children,
  className,
  wrapperClassName,
  ...inputProps
}: FieldProps) {
  return (
    <div className={wrapperClassName}>
      <label
        htmlFor={id}
        className="mb-1.5 block font-grotesk text-[11px] font-bold uppercase tracking-[0.12em] text-ink"
      >
        {label}
      </label>
      {children ?? (
        <input
          id={id}
          type="text"
          className={cn(fieldInputClass, className)}
          {...inputProps}
        />
      )}
    </div>
  );
}
