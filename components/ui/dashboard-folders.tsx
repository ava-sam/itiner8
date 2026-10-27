import Link from "next/link";
import { FolderSheet } from "@/components/ui/folder-sheet";
import { FolderTab } from "@/components/ui/folder-tab";
import { cn } from "@/lib/utils";

type FolderDef = {
  key: string;
  label: string;
  href?: string;
  color: string;
  texture: string;
  textureOpacity: number;
  /** Vertical offset of the folder: 89px on mobile, 99px on desktop. */
  top: string;
  tabLeft: string;
  dominant?: boolean;
};

const FOLDERS: FolderDef[] = [
  {
    key: "view",
    label: "view plans",
    color: "#d3dff2",
    texture: "/textures/texture-blue.png",
    textureOpacity: 0.45,
    top: "top-0 z-[1]",
    tabLeft: "left-0",
  },
  {
    key: "join",
    label: "join a plan",
    color: "#b1b2ae",
    texture: "/textures/texture-cream.png",
    textureOpacity: 0.5,
    top: "top-[89px] md:top-[99px] z-[2]",
    tabLeft: "left-[85px] md:left-[360px]",
  },
  {
    key: "create",
    label: "create a plan",
    color: "#93a4c1",
    texture: "/textures/texture-brown.png",
    textureOpacity: 0.22,
    top: "top-[178px] bottom-5 md:top-[198px] md:bottom-6 z-[3]",
    tabLeft: "left-[170px] md:left-[720px]",
    dominant: true,
  },
];

type DashboardFoldersProps = {
  viewHref: string;
  joinHref: string;
  /** Omit to render the create folder inert (e.g. guests can't create plans). */
  createHref?: string;
};

export function DashboardFolders({
  viewHref,
  joinHref,
  createHref,
}: DashboardFoldersProps) {
  const hrefs: Record<string, string | undefined> = {
    view: viewHref,
    join: joinHref,
    create: createHref,
  };

  return (
    <div className="box-border h-[calc(100dvh-96px)] px-5 pt-7 md:h-[calc(100dvh-112px)] md:px-16">
      <div className="relative h-full min-h-[460px]">
        {FOLDERS.map((f) => {
          const href = hrefs[f.key];
          const classes = cn(
            "absolute inset-x-0 block transition-transform duration-150 ease-out",
            f.top,
            href &&
              "hover:-translate-y-2 focus-visible:-translate-y-2 md:hover:-translate-y-2.5 md:focus-visible:-translate-y-2.5",
          );
          const body = (
            <>
              <FolderTab
                color={f.color}
                texture={f.texture}
                textureOpacity={f.textureOpacity}
                label={f.label}
                className={cn(
                  "absolute top-0 h-12 w-[180px] md:h-[60px] md:w-[300px]",
                  f.tabLeft,
                )}
                labelClassName="text-[15px] tracking-[0.05em] md:text-[22px] md:tracking-[0.08em]"
              />
              <FolderSheet
                color={f.color}
                texture={f.texture}
                textureOpacity={f.textureOpacity}
                className={cn(
                  "folder-band absolute inset-x-0 top-[47px] md:top-[59px]",
                  f.dominant
                    ? "-bottom-5 md:-bottom-6"
                    : "h-[114px] border-b-0 md:h-[124px]",
                )}
              />
            </>
          );

          return href ? (
            <Link
              key={f.key}
              href={href}
              className={cn(classes, "group outline-none")}
              aria-label={f.label}
            >
              {body}
              <span className="pointer-events-none absolute inset-x-0 top-[47px] bottom-0 group-focus-visible:outline group-focus-visible:outline-[3px] group-focus-visible:-outline-offset-[6px] group-focus-visible:outline-ink md:top-[59px]" />
            </Link>
          ) : (
            <div key={f.key} className={classes} aria-disabled="true">
              {body}
            </div>
          );
        })}
      </div>
    </div>
  );
}
