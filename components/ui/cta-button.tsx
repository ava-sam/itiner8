import Link from "next/link";
import { cn } from "@/lib/utils";

const ctaClass =
  "box-border flex w-full items-center justify-center border-2 border-ink bg-ink py-4 font-grotesk text-sm font-bold uppercase tracking-[0.1em] text-bg transition-opacity hover:opacity-85 disabled:opacity-50 md:w-[280px]";

type CtaButtonProps =
  | ({ href: string } & Omit<React.ComponentProps<typeof Link>, "href">)
  | ({ href?: undefined } & React.ComponentProps<"button">);

export function CtaButton(props: CtaButtonProps) {
  if (props.href !== undefined) {
    const { className, ...rest } = props;
    return <Link {...rest} className={cn(ctaClass, className)} />;
  }
  const { className, type = "button", ...rest } = props;
  return <button type={type} {...rest} className={cn(ctaClass, className)} />;
}
