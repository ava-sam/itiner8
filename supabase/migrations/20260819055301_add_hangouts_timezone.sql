-- The itinerary optimizer (lib/optimizer) needs a single IANA timezone per
-- hangout to resolve opening hours / reservations / preferred windows
-- against local wall-clock time (see lib/optimizer/time.ts). Nothing in
-- the schema captured that until now.
--
-- Default is a placeholder for existing/not-yet-updated rows only — new
-- hangouts should have the organizer's actual timezone captured at
-- creation time (see components/hangout-form.tsx, updated alongside this
-- migration to send Intl.DateTimeFormat().resolvedOptions().timeZone).

alter table public.hangouts
  add column timezone text not null default 'America/Los_Angeles';
