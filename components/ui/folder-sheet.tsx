import { cn } from "@/lib/utils";

type FolderSheetProps = {
  color: string;
  texture: string;
  textureOpacity: number;
  className?: string;
  children?: React.ReactNode;
};

/** A folder page: 3px ink border, flat color fill, multiply-blended texture on top. */
export function FolderSheet({
  color,
  texture,
  textureOpacity,
  className,
  children,
}: FolderSheetProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden border-[3px] border-ink",
        className,
      )}
      style={{ backgroundColor: color }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-cover bg-center mix-blend-multiply"
        style={{ backgroundImage: `url(${texture})`, opacity: textureOpacity }}
      />
      {children && <div className="relative">{children}</div>}
    </div>
  );
}
