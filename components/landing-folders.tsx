import { FolderSheet } from "@/components/ui/folder-sheet";
import { FolderTab } from "@/components/ui/folder-tab";
import { cn } from "@/lib/utils";

const EXAMPLE_STOPS = [
  { time: "2:00 pm", name: "the garment district gallery" },
  { time: "3:22 pm", name: "blue bottle coffee" },
  { time: "4:10 pm", name: "harbor view tacos" },
];

type Step = {
  n: string;
  tab: string;
  title: string;
  body: string;
  color: string;
  texture: string;
  textureOpacity: number;
  /** Offset of the folder from the top of the stack (mobile / desktop). */
  top: string;
  tabPosition: string;
  z: string;
  examples?: boolean;
};

// Tabs are staggered left -> centre -> right; the last one is flush with the
// container's right edge. Every sheet runs to the bottom of the stack, so
// the folder above is always backed by the next one and no page background
// shows between them.
const STEPS: Step[] = [
  {
    n: "01",
    tab: "add ideas",
    title: "add ideas",
    body: "everyone adds places they want to go.",
    color: "#d3dff2",
    texture: "/textures/texture-blue.png",
    textureOpacity: 0.45,
    top: "top-0",
    tabPosition: "left-0",
    z: "z-[1]",
  },
  {
    n: "02",
    tab: "vote",
    title: "vote on places",
    body: "the organizer picks finalists from the top votes.",
    color: "#b1b2ae",
    texture: "/textures/texture-cream.png",
    textureOpacity: 0.5,
    top: "top-[108px] md:top-[150px]",
    tabPosition: "left-[calc((100%-112px)/2)] md:left-[calc((100%-180px)/2)]",
    z: "z-[2]",
  },
  {
    n: "03",
    tab: "route",
    title: "get a route",
    body: "timed stops with drive times.",
    color: "#93a4c1",
    texture: "/textures/texture-brown.png",
    textureOpacity: 0.22,
    top: "top-[216px] md:top-[300px]",
    tabPosition: "right-0",
    z: "z-[3]",
    examples: true,
  },
];

export function LandingFolders({ className }: { className?: string }) {
  return (
    <div className={cn("relative h-[460px] w-full md:h-[620px]", className)}>
      {STEPS.map((step) => (
        <div
          key={step.n}
          className={cn("absolute inset-x-0 bottom-0", step.top, step.z)}
        >
          <FolderTab
            color={step.color}
            texture={step.texture}
            textureOpacity={step.textureOpacity}
            label={step.tab}
            className={cn(
              "absolute top-0 h-10 w-28 md:h-12 md:w-[180px]",
              step.tabPosition,
            )}
            labelClassName="text-[13px] tracking-[0.05em] md:text-[17px] md:tracking-[0.08em]"
          />
          <FolderSheet
            color={step.color}
            texture={step.texture}
            textureOpacity={step.textureOpacity}
            className="absolute inset-x-0 bottom-0 top-[39px] p-3.5 md:top-[47px] md:p-6"
          >
            <div className="flex items-baseline gap-2.5 md:gap-3">
              <span className="font-grotesk text-[11px] font-bold tracking-[0.12em] md:text-xs">
                {step.n}
              </span>
              <h3 className="font-grotesk text-[13px] font-bold uppercase tracking-[0.1em] md:text-base">
                {step.title}
              </h3>
            </div>
            <p className="mt-1 font-grotesk text-xs lowercase leading-snug md:mt-1.5 md:text-sm">
              {step.body}
            </p>
            {step.examples && (
              <ul className="mt-3 flex flex-col gap-2 md:mt-4 md:gap-2.5">
                {EXAMPLE_STOPS.map((stop, i) => (
                  <li
                    key={stop.time}
                    className={cn(
                      "flex items-center gap-3 border-2 border-ink bg-input-white px-3 py-2 md:gap-4 md:px-4 md:py-3",
                      i >= 2 && "hidden md:flex",
                    )}
                  >
                    <span className="w-14 flex-none font-grotesk text-xs font-bold lowercase md:w-16 md:text-sm">
                      {stop.time}
                    </span>
                    <span className="min-w-0 truncate font-grotesk text-sm font-bold lowercase md:text-base">
                      {stop.name}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </FolderSheet>
        </div>
      ))}
    </div>
  );
}
