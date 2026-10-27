// Display formatting for the planning room. Everything is rendered in the
// hangout's own IANA timezone (not the viewer's), lowercase to match the
// design ("2:00 pm", "sat, oct 4").

const normalizeSpaces = (s: string) => s.replace(/\s/g, " ").toLowerCase();

export function formatClock(date: Date, timeZone: string): string {
  return normalizeSpaces(
    date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone,
    }),
  );
}

export function formatDay(date: Date, timeZone: string): string {
  return normalizeSpaces(
    date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone,
    }),
  );
}

/** Always minutes ("60 min", "90 min") — that's how the design writes durations. */
export function formatMinutes(minutes: number): string {
  return `${Math.max(0, Math.round(minutes))} min`;
}

/** "4:15 pm", "4pm", "16:15" -> minutes after local midnight, or null. */
export function parseClockInput(input: string): number | null {
  const match = input
    .trim()
    .toLowerCase()
    .match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = match[2] ? Number(match[2]) : 0;
  const meridiem = match[3];
  if (minutes > 59) return null;
  if (meridiem) {
    if (hours < 1 || hours > 12) return null;
    if (meridiem === "am") hours = hours === 12 ? 0 : hours;
    else hours = hours === 12 ? 12 : hours + 12;
  } else if (hours > 23) {
    return null;
  }
  return hours * 60 + minutes;
}
