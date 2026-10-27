import Link from "next/link";
import { FolderSheet } from "@/components/ui/folder-sheet";
import { FolderTab } from "@/components/ui/folder-tab";
import { cn } from "@/lib/utils";

type SectionPageProps = {
  /** Tab label, e.g. "join a plan". */
  label: string;
  color: string;
  texture: string;
  textureOpacity: number;
  backHref?: string;
  backLabel?: string;
  /** On md+, pin the sheet to the viewport height so inner lists scroll. */
  contained?: boolean;
  sheetClassName?: string;
  children: React.ReactNode;
};

/**
 * An open folder: back link, attached tab, and the sheet the page lives on.
 * Fills the viewport below the header; grows (and the page scrolls) if the
 * content is taller.
 */
export function SectionPage({
  label,
  color,
  texture,
  textureOpacity,
  backHref = "/dashboard",
  backLabel = "back to dashboard",
  contained,
  sheetClassName,
  children,
}: SectionPageProps) {
  return (
    <div
      className={cn(
        "flex min-h-[calc(100dvh-96px)] flex-col px-5 pb-5 pt-1.5 md:min-h-[calc(100dvh-112px)] md:px-16 md:pb-10 md:pt-[18px]",
        contained && "md:h-[calc(100dvh-112px)]",
      )}
    >
      <Link
        href={backHref}
        className="mb-0.5 flex h-7 items-center self-start font-grotesk text-[11px] font-bold uppercase tracking-[0.1em] hover:underline md:mb-0 md:text-xs"
      >
        ← {backLabel}
      </Link>
      <FolderTab
        color={color}
        texture={texture}
        textureOpacity={textureOpacity}
        label={label}
        className="relative z-[2] -mb-px h-[42px] w-[170px] md:h-12 md:w-[230px]"
        labelClassName="text-sm tracking-[0.06em] [-webkit-text-stroke:0.4px_currentColor] md:text-[17px] md:tracking-[0.08em]"
      />
      <FolderSheet
        color={color}
        texture={texture}
        textureOpacity={textureOpacity}
        className={cn("z-[1] min-h-0 flex-1 p-5 md:p-10", sheetClassName)}
      >
        {children}
      </FolderSheet>
    </div>
  );
}

/** Right-hand inset on the sheet. Hidden below md. */
export function PreviewPanel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "hidden flex-1 flex-col items-center justify-center gap-[18px] border-2 border-ink bg-input-white/55 p-6 text-center md:flex",
        className,
      )}
    >
      {children}
    </div>
  );
}
