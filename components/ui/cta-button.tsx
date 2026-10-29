import Link from "next/link";
import { cn } from "@/lib/utils";

const ctaClass =
  "box-border flex w-full items-center justify-center border-2 border-ink py-4 font-grotesk text-sm font-bold uppercase tracking-[0.1em] transition-opacity hover:opacity-85 disabled:opacity-50 md:w-[280px]";

const VARIANTS = {
  dark: "bg-ink text-bg",
  light: "bg-input-white text-ink",
} as const;

type Variant = keyof typeof VARIANTS;

type CtaButtonProps =
  | ({ href: string; variant?: Variant } & Omit<
      React.ComponentProps<typeof Link>,
      "href"
    >)
  | ({ href?: undefined; variant?: Variant } & React.ComponentProps<"button">);

export function CtaButton(props: CtaButtonProps) {
  if (props.href !== undefined) {
    const { className, variant = "dark", ...rest } = props;
    return (
      <Link {...rest} className={cn(ctaClass, VARIANTS[variant], className)} />
    );
  }
  const { className, variant = "dark", type = "button", ...rest } = props;
  return (
    <button
      type={type}
      {...rest}
      className={cn(ctaClass, VARIANTS[variant], className)}
    />
  );
}
