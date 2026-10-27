import { useId } from "react";
import { cn } from "@/lib/utils";

const TAB_PATH =
  "M27.1,12.2 Q34,0 48,0 L252,0 Q266,0 272.9,12.2 L300,60 L0,60 Z";
const TAB_OUTLINE =
  "M0,60 L27.1,12.2 Q34,0 48,0 L252,0 Q266,0 272.9,12.2 L300,60";

type FolderTabProps = {
  /** Fill color, e.g. "#d3dff2". */
  color: string;
  /** Texture image URL, blended with multiply. */
  texture: string;
  textureOpacity: number;
  label: string;
  /** Size and position the tab with this (it fills its box), e.g. "absolute h-12 w-[180px]". */
  className?: string;
  /** Font size / tracking for the label. */
  labelClassName?: string;
};

export function FolderTab({
  color,
  texture,
  textureOpacity,
  label,
  className,
  labelClassName,
}: FolderTabProps) {
  const clipId = `tab-clip-${useId().replace(/:/g, "")}`;

  return (
    <div className={cn("pointer-events-none", className)}>
      <svg
        viewBox="0 0 300 60"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <defs>
          <clipPath id={clipId}>
            <path d={TAB_PATH} />
          </clipPath>
        </defs>
        <path d={TAB_PATH} fill={color} stroke="none" />
        <image
          href={texture}
          x="0"
          y="0"
          width="300"
          height="60"
          preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#${clipId})`}
          style={{ mixBlendMode: "multiply", opacity: textureOpacity }}
        />
        <path
          d={TAB_OUTLINE}
          fill="none"
          stroke="#18202b"
          strokeWidth={3}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span
        className={cn(
          "absolute inset-x-0 top-1/2 -translate-y-[45%] text-center font-grotesk font-bold uppercase text-ink [-webkit-text-stroke:0.5px_currentColor]",
          labelClassName,
        )}
      >
        {label}
      </span>
    </div>
  );
}
