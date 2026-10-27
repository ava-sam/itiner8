# ITINER8 restyle: planning room + final plan

No git commands. Do not change any Supabase migration, RLS policy, optimizer logic (lib/optimizer/), generatePlan, or auth logic. If something below needs a DB change (for example no policy lets the organizer set status to 'finalized'), STOP and tell me what is needed instead of writing a migration.

Reference mockups (already in design/): PlanningRoomIdeas / PlanningRoomFinalists / PlanningRoomPlan / FinalPlan (desktop 1440x900) and MobilePlanningRoomIdeas / MobilePlanningRoomFinalists / MobilePlanningRoomPlan / MobileFinalPlan (390x844), all .dc.html. Use the existing shared components in components/ui/ (section-page, FolderTab, FolderSheet, Field, Stepper, SegmentedButtons, StatusPill, CtaButton, etc.) and add new ones only where needed. Same casing rules as the other pages: labels, tabs and buttons uppercase; text inside cards and inputs lowercase.

## Route: /hangouts/[id]
- Keep the ?tab= URL param (router.replace) and the three tabs ideas / finalists / plan. Tabs are the .room-tab buttons in the mockups (active = #3d5580 with light text).
- Page chrome: back link "back to plans" (to /dashboard), attached tab "planning room" (light blue #d3dff2, blue texture), sheet with the room header: hangout name in Bootzy TM, status pill (planning #b1b2ae, generated #d3dff2, finalized #93a4c1, completed #18202b with light text), member avatars (initials, max 4 then +N), invite code chip with COPY button (copies the code).
- Desktop: invite code and avatars on every tab. Mobile (below md): invite code ONLY on the Ideas tab; avatars hidden.
- Map insets: keep the real Google Map components if they already exist on these tabs; otherwise show the placeholder inset exactly as in the mockup.

## Ideas tab
- Search/Autocomplete input + "+ add idea" (existing add logic), counter "N / 15 ideas".
- Idea cards: name, "category · address · added by {name or 'you'}", upvote box (voted state #3d5580), × remove button only on the user's own ideas. Keep Realtime updates, 15 cap and one removable vote per person.

## Finalists tab
- Left: "other ideas · by votes" with "+ finalist" buttons (organizer only; hide for members). Note card: "only the organizer picks finalists. votes are a guide, not a rule."
- Right: "N / 8 finalists" cards: remove, visit time stepper (existing duration field), "required stop" checkbox, reservation time input. Keep the 8 cap and all existing save logic.
- Mobile: single column, finalists first, then other ideas.

## Plan tab
- Header row: summary "N stops · start – end · X min driving" (computed from the itinerary), REGENERATE (existing generate/regenerate action, organizer only, disabled below 1 finalist) and FINALIZE PLAN (organizer only, sets hangout status to 'finalized').
- Timeline: time column, stop card (name, "visit N min · leave time", badges: reservation HH:MM pm, required, closes HH:MM pm), dashed travel connector "drive · N min + N min buffer" (use the mode: drive/walk/transit).
- Right column: route map inset, then notices. Map existing conflict levels to the mockup notices: blocking -> tag "blocking" (ink #18202b background with light text), warning -> "warning" (#b1b2ae), suggestion -> "suggestion" (#d3dff2). Keep the existing labeled error banners and the "incomplete plan" block.
- Before any plan exists, keep the existing empty/generate state, restyled in the same folder look.

## Final plan view (status = 'finalized' or 'completed')
- Same route, but render the FinalPlan mockup instead of the tabs: attached tab "final plan" (#93a4c1, brown texture), read-only itinerary, details card (start, end, travel mode, finalized date + who), map inset, member avatars.
- SHARE LINK button copies the join link `${origin}/join?code=${invite_code}` and shows "copied" briefly. ADD TO CALENDAR downloads a .ics file generated client-side (one VEVENT per stop with its start/end time and address in the hangout's timezone).
- Mobile: no map, details card above the timeline.

## Verification
Use Playwright to screenshot /hangouts/<an existing id> for every tab at 1440x900 and 390x844 (and the finalized view if possible) and compare against the mockups (render the .dc.html if you can, otherwise compare by eye). List every difference, fix them, and repeat until none remain. Then run tsc, eslint and the existing tests, and show me a summary of what changed.
