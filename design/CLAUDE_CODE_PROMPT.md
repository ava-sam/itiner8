# ITINER8 restyle: step 1 (design foundation only)

Read the mockups in `design/`. They are static HTML references, not code to paste in. Rebuild them as React + Tailwind in this Next.js app. Do NOT touch any Supabase, auth, Places Autocomplete, optimizer or Realtime logic. Do NOT run any git commands.

## Assets (already copied to `public/`)
- Fonts: `public/fonts/BootzyTM.ttf` (titles/logo), `AlteHaasGroteskRegular.ttf` (400), `AlteHaasGroteskBold.ttf` (700)
- `public/textures/blueprint.png`: site background (cover, centered)
- Textures: `texture-blue.png` (view plans / light blue), `texture-cream.png` (join a plan / grey), `texture-brown.png` (create a plan / blue)

## Step 1: do only this, then stop for my review
1. `globals.css`: add the 3 `@font-face` rules; set the blueprint as the body background; add the palette as Tailwind theme colors:
   light blue #d3dff2, grey #b1b2ae, blue #93a4c1, ink #18202b, bg #e7e8e4, sheet blue #aebbd2, selected blue #3d5580, selected grey #5d605b, input white #fbfaf6.
2. Create reusable components in `components/ui/`:
   - `FolderTab` and `FolderSheet`: props `color`, `texture`, `textureOpacity`. Tab is an SVG (viewBox 0 0 300 60, preserveAspectRatio none) with the rounded trapezoid path from the mockups, a clipped multiply-blended texture, and a separate 3px open outline. Sheet has a 3px #18202b border, the color fill, and a multiply texture overlay.
   - `DashboardFolders`: the three overlapping folders (view plans, join a plan, create a plan) with hover translateY lift. Desktop uses the 1440 layout, mobile (below `md`) the 390 layout.
   - `Field`, `SegmentedButtons`, `Stepper`, `CtaButton`, `PlanCard`, `StatusPill`.
3. Casing rules: headers, tab labels, field labels, buttons and segmented options UPPERCASE. Text inside inputs, placeholders and list-card text lowercase. All outlines 3px on folders and tabs, 2px on inputs and cards.
4. Responsive: the mobile mockups (`Mobile*.dc.html`) apply below `md`; stack fields in one column and hide the preview panels.
5. Build the new header (ITINER8 in Bootzy TM, "WELCOME BACK, {NAME}" in Alte Haas regular) into the existing SiteHeader without breaking its auth logic.

When done, show me the dashboard at 1440px and 390px. Pages come next, one at a time: /hangouts/new, dashboard list, /join.
