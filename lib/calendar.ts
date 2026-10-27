// Client-side .ics generation for a finalized plan: one VEVENT per stop.

export type CalendarStop = {
  name: string;
  address?: string;
  start: Date;
  end: Date;
};

const pad = (n: number) => String(n).padStart(2, "0");

/** Local wall-clock "YYYYMMDDTHHMMSS" of an instant in `timeZone`. */
function localStamp(date: Date, timeZone: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}${parts.month}${parts.day}T${parts.hour}${parts.minute}${parts.second}`;
}

function utcStamp(date: Date): string {
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

const escapeText = (s: string) =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");

// RFC 5545: lines longer than 75 octets are folded with CRLF + space.
function fold(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const out: string[] = [];
  let current = "";
  let bytes = 0;
  for (const ch of line) {
    const size = encoder.encode(ch).length;
    const limit = out.length === 0 ? 75 : 74;
    if (bytes + size > limit) {
      out.push(current);
      current = "";
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  out.push(current);
  return out.join("\r\n ");
}

export function buildIcs({
  hangoutId,
  hangoutName,
  timeZone,
  stops,
}: {
  hangoutId: string;
  hangoutName: string;
  timeZone: string;
  stops: CalendarStop[];
}): string {
  const now = utcStamp(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//itiner8//final plan//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escapeText(hangoutName)}`,
    `X-WR-TIMEZONE:${timeZone}`,
  ];

  stops.forEach((stop, i) => {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${hangoutId}-${i}@itiner8`,
      `DTSTAMP:${now}`,
      `DTSTART;TZID=${timeZone}:${localStamp(stop.start, timeZone)}`,
      `DTEND;TZID=${timeZone}:${localStamp(stop.end, timeZone)}`,
      `SUMMARY:${escapeText(stop.name)}`,
      `DESCRIPTION:${escapeText(`Stop ${i + 1} of ${stops.length} · ${hangoutName}`)}`,
    );
    if (stop.address) lines.push(`LOCATION:${escapeText(stop.address)}`);
    lines.push("END:VEVENT");
  });

  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

export function downloadIcs(filename: string, contents: string) {
  const blob = new Blob([contents], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
