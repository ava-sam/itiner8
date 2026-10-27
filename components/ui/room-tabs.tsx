import { cn } from "@/lib/utils";

type RoomTabsProps<T extends string> = {
  tabs: { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
  className?: string;
};

export function RoomTabs<T extends string>({
  tabs,
  active,
  onChange,
  className,
}: RoomTabsProps<T>) {
  return (
    <div role="tablist" className={cn("flex gap-2 md:gap-3", className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            "box-border border-2 border-ink px-4 py-2.5 font-grotesk text-[11px] font-bold uppercase tracking-[0.08em] md:px-[26px] md:py-[11px] md:text-[13px]",
            active === tab.id ? "bg-sel-blue text-bg" : "bg-input-white text-ink",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
