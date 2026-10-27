import { PreviewPanel } from "@/components/ui/section-page";

/** The mockups' stand-in for a map inset (no live map on these tabs yet). */
export function MapPlaceholder({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <PreviewPanel className={className}>
      <svg
        width="56"
        height="56"
        viewBox="0 0 56 56"
        fill="none"
        stroke="#18202b"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path d="M28 6 c-9 0-16 7-16 16 0 12 16 28 16 28s16-16 16-28c0-9-7-16-16-16z" />
        <circle cx="28" cy="22" r="6" />
      </svg>
      <div className="font-grotesk text-[13px] font-bold uppercase tracking-[0.14em]">
        {label}
      </div>
    </PreviewPanel>
  );
}
