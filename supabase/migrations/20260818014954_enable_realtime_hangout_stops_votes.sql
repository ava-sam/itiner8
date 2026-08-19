-- Enable Realtime broadcasts for the Ideas/Finalists planning room: clients
-- subscribe to hangout_stops (candidate/finalist places) and votes for a
-- given hangout. Existing RLS select policies (hangout_stops_select_members,
-- votes_select_members) already govern what each subscriber receives —
-- adding a table to this publication does not bypass RLS.

alter publication supabase_realtime add table public.hangout_stops;
alter publication supabase_realtime add table public.votes;

-- Both tables need REPLICA IDENTITY FULL, not just for DELETE payload
-- content but because Realtime's server-side `filter` (e.g.
-- hangout_id=eq.<id> on hangout_stops) can only be evaluated against a
-- DELETE's old row if the filtered column is part of the replica identity.
-- Neither hangout_id (hangout_stops) nor hangout_stop_id/voter_id (votes)
-- is part of the primary key, so under the DEFAULT identity (PK only)
-- those DELETE events would be silently dropped by the filter.
alter table public.hangout_stops replica identity full;
alter table public.votes replica identity full;
