# Chua Enterprise Dashboard — Change Prompts for Opus 4.8 (Medium)

These are ready-to-paste prompts, one per requested change. Each is self-contained and points at the real files in this repo. Feed them to Opus **one at a time** (do not batch — several touch overlapping files).

---

## Shared context (optional — prepend to any prompt)

> Stack: Next.js (App Router) + TypeScript + Tailwind. Admin app lives under `app/admin/*`. All data flows through `context/RentalContext.tsx` (client state) which reads/writes Notion via `lib/notion.ts`. Domain types are in `types/rental.ts`. The admin shell/nav is `components/admin/Sidebar.tsx`; the landing page is `app/admin/page.tsx` (server) → `components/admin/DashboardClient.tsx` (client). Revenue entry UI is `components/property/RevenueEntryDrawer.tsx`; expense entry UI is `components/property/ExpenseEntryDrawer.tsx`. Currency is MYR.
>
> Working rules for every change: **do not assume the cause or the right hook — inspect the relevant files, data flow, context methods, and types first.** Before editing, list the files you will touch and the smallest safe change. Reuse existing context methods (`addRevenueEntry`, `updateRevenueEntry`, `addExpenseEntry`, `updateExpenseEntry`, `updateTenant`, `getUnitsForProperty`, `getUnit`, etc.) rather than inventing new data paths. After editing, verify the build/typecheck passes and that existing pages still work, then summarize exactly what changed.

---

## Prompt 1 — Combined Revenue + Expense entry as the first page

```
In the Chua Enterprise dashboard (Next.js App Router + TypeScript), build a single, fast "Quick Entry" page that lets the owner record BOTH revenue and expenses with as few clicks as possible, and make it the default landing page after login.

First, inspect these before changing anything and tell me what you found:
- app/admin/page.tsx (current landing) and app/admin/layout.tsx
- components/admin/Sidebar.tsx (nav order + active-link logic)
- components/property/RevenueEntryDrawer.tsx and components/property/ExpenseEntryDrawer.tsx (the existing entry logic to reuse)
- context/RentalContext.tsx (addRevenueEntry, addExpenseEntry, getUnitsForProperty, getUnit, visibleProperties)
- types/rental.ts (RevenueEntry, ExpenseEntry, Unit)

Requirements:
1. Create a new page (e.g. app/admin/entry/page.tsx) that is the FIRST thing the user lands on. Add it to the Sidebar as the top nav item, and make the post-login redirect / "/admin" route point to it (inspect routing first to choose the cleanest place to redirect; keep the old dashboard reachable via its own nav item).
2. On this one page, put a prominent segmented toggle with two clearly ACTIVE-state buttons: "Revenue" and "Expense". Switching reveals the matching form inline on the SAME page — no drawer, no extra navigation. Reuse the existing field logic/validation from RevenueEntryDrawer and ExpenseEntryDrawer; refactor shared form bodies into reusable components if that avoids duplication, but do not change how saving works.
3. Property selector at top. When the selected property is room-based (rental_model === "room_rental") and has multiple rooms (e.g. 6), show a room selector (dropdown or popover grid) listing every room from getUnitsForProperty. Each room option must display the existing tenant (unit.tenant_name, or "Vacant") next to the room name. Selecting a room targets revenue entry to that room.
4. Minimize clicks: sensible defaults (current month/year, first property, first room), inline save, success confirmation without leaving the page.

Constraints: reuse existing context save methods and types — do not add new Notion fields for this change. Keep both drawers working where they are still used (property page, ledgers). List affected files and the smallest safe change before editing. After: typecheck/build, confirm login → lands on Quick Entry, both forms save correctly, and existing pages are unaffected. Summarize what changed.
```

---

## Prompt 2 — Prorated rent for mid-month move-ins

```
Add an optional rent proration feature to the revenue entry form in the Chua Enterprise dashboard.

Inspect first and report findings:
- components/property/RevenueEntryDrawer.tsx (how rental_amount, electricity, other charges and totalAmount are computed and saved; the year/month selection)
- the new combined entry page if it exists (app/admin/entry/page.tsx) — apply the same feature there
- types/rental.ts (RevenueEntry shape) and context/RentalContext.tsx (addRevenueEntry / updateRevenueEntry)

Requirements:
1. Add a small "Prorate (mid-month start)" checkbox near the Rental field. When unchecked, behavior is exactly as today.
2. When checked, reveal a date control (a date input, defaulting within the selected billing month) for the tenant's start date. Compute prorated rent = full monthly rent × (chargeable days ÷ days in that month). Decide and state your day-counting rule (e.g. start date through month end, inclusive) and use the correct number of days for the SELECTED month/year.
3. Show the breakdown to the user (full rent, days used / days in month, prorated amount) and feed the prorated rental amount into the existing total calculation. Electricity and other charges stay unaffected.
4. Persistence: check whether RevenueEntry can store proration without a schema change. Prefer the smallest safe approach — if no suitable field exists, save the computed prorated value as rental_amount and append a clear note (e.g. "Prorated from <date>: X/Y days"). If you believe a dedicated field is warranted, propose it (type + Notion mapping in lib/notion.ts) but do NOT add it without flagging the trade-off first.

Constraints: do not change unrelated totals or saving logic. List affected files and the smallest safe fix before editing. After: typecheck/build, verify proration math against a hand calculation for a 28-, 30-, and 31-day month, confirm the non-prorated path is unchanged, and summarize what changed.
```

---

## Prompt 3 — Data extraction / viewing with date range + per-property + per-room filters

```
Improve the data viewing/extraction on the Revenue and Expenses ledgers in the Chua Enterprise dashboard so the owner can slice income and expenses by property, by room (where applicable), and by an explicit start/end date range.

Inspect first and report what already exists vs. what's missing:
- app/admin/revenue/page.tsx (filters: from/to month, search, property, unit, status; how `filtered` and `totalRevenue` are derived; how the unit/room filter list is built)
- app/admin/expenses/page.tsx (filters: from/to month, search, property, category)
- context/RentalContext.tsx (getUnitsForProperty, getUnit, revenueEntries, expenseEntries)

Requirements:
1. Revenue page: keep per-property filtering and ensure per-ROOM filtering is robust — the room dropdown should list ALL rooms of the selected property via getUnitsForProperty (not only rooms that already have revenue rows), and only appear for room-based properties. Add a clear "show individual rooms" affordance so the user can view a single room or all rooms.
2. Both pages: confirm the from/to date filtering matches exactly what's displayed and what the totals sum. The client asked for a start AND end DATE range — evaluate whether month-granularity (type="month") is enough or whether to switch to day-level date inputs; recommend one, implement it, and make sure the displayed rows, the totals row, and pagination all reflect the active filters with no mismatch.
3. Expenses are property-level in the data model (no room dimension) — confirm this by inspection and, if true, keep expenses per-property only and say so rather than inventing a room field.

Constraints: the visible table, the totals, and any future export must always match the current filters/date-range/room selection — verify this explicitly. List affected files and the smallest safe change before editing. After: typecheck/build, test combinations (property only, property+room, date range edges), confirm totals equal the sum of visible+paginated rows, and summarize what changed. (If you think a CSV/PDF export of the filtered view would help here, propose it separately — do not add it unasked.)
```

---

## Prompt 4 — Tenant page: edit lease end date

```
On the Tenants page of the Chua Enterprise dashboard, make changing a tenant's lease end date quick and obvious.

Inspect first and report:
- app/admin/tenants/page.tsx — specifically TenantFormDrawer (note it ALREADY has a "Lease End" date input in edit mode), TenantCard, TenantDetailDrawer, and deriveLeaseStatus
- context/RentalContext.tsx (updateTenant) and types/rental.ts (Tenant.lease_end)

Requirements:
1. Since full edit already exists, add a faster path: a quick "Edit lease end" action that opens a small inline date picker (on the tenant detail drawer, and/or directly on the tenant card) and saves only lease_end via updateTenant — without opening the whole tenant form.
2. After saving, the card's Lease status chip (Active / Ending Soon / Expired via deriveLeaseStatus) must update immediately.
3. Keep the existing full edit form working unchanged.

Constraints: reuse updateTenant; do not alter other tenant fields or the save flow. List affected files and the smallest safe change before editing. After: typecheck/build, verify lease_end persists and the status chip recomputes, confirm the full edit form is unaffected, and summarize what changed.
```

---

## Prompt 5 — Lead the overview with property pictures

```
Make the dashboard overview in the Chua Enterprise app "start with" property pictures.

Inspect first and report:
- components/admin/DashboardClient.tsx — the PropertySection cards (currently text-only) and PropertyDrawer (already renders p.imageUrl)
- lib/dashboard.ts / the PropertyHealth type to confirm an image field (imageUrl) is available per property
- data/rentalData.ts (PROPERTY_FALLBACK_IMAGE) and how property.image_url maps through

Requirements:
1. Add a property thumbnail/cover image to each property card in PropertySection, using the property's image (imageUrl) with PROPERTY_FALLBACK_IMAGE as the graceful fallback and an onError fallback (mirror the pattern already used on app/admin/properties/[id]/page.tsx).
2. Make the overview visually lead with pictures — e.g. an image header on each card (and/or a picture-forward layout at the top of the Properties section). Keep the existing Property/Condition toggle, stats, and click-to-open-drawer behavior intact.
3. Keep it responsive and consistent with the existing card styling (CSS variables, rounded corners, borders).

Constraints: do not change data fetching or the PropertyHealth shape unless a needed field is genuinely missing (flag it if so). List affected files and the smallest safe change before editing. After: typecheck/build, verify cards render with images and fall back cleanly when an image is missing, confirm drawers/stats still work, and summarize what changed.
```

---

## Prompt 6 — Share button for a unit's pictures (with room selector for multi-room properties)

```
Add a "Share" feature to the Chua Enterprise dashboard that lets the owner send a link to the photos of a specific unit/room. If a property has multiple rooms (e.g. 6), the share action must first let the user pick which room via a dropdown or popover.

IMPORTANT — inspect and report the data model gap first:
- types/rental.ts (Unit) and lib/notion.ts (UnitRow / buildUnitProps) — confirm whether UNITS currently have any image/photo field. Properties have "Image URL"; rooms/units appear NOT to. Report exactly what exists.
- app/admin/properties/[id]/page.tsx (room list rendering) and context/RentalContext.tsx (getUnitsForProperty, getUnit)

Because there is no per-unit photo storage yet, do NOT just build a broken share button. Instead:
1. Propose the smallest viable design and confirm direction with me before deep implementation:
   (a) what "pictures for a unit" points to — a new per-unit image field/gallery (requires adding an "Image URL"/photos field to the Units Notion DB + UnitRow + Unit type + mapping in lib/notion.ts), and
   (b) what the shared link opens — recommend a public, read-only gallery route (e.g. app/share/[unitId]/page.tsx or a tokenized public page) since admin pages are behind AuthGate.
2. Implement a Share button on the property page (and/or property drawer). For room-based properties with multiple rooms, the button opens a room selector (dropdown/popover) listing each room with its tenant; for whole-unit properties it shares the single unit directly.
3. The button copies the shareable link to the clipboard (and/or opens the native share sheet) and shows confirmation. The link target shows that unit's pictures only.

Constraints: keep AuthGate protecting admin pages — the shareable page must be safe to expose publicly (read-only, no sensitive tenant/financial data). List affected files, the required data-model additions, and the smallest safe phased plan before editing. After: typecheck/build, verify the room selector appears only for multi-room properties, the link resolves to the correct unit's gallery, and no admin data leaks on the public page. Summarize what changed.
```

---

### Notes for you (not for Opus)

- **Prompt 4 (lease end):** the edit drawer in `tenants/page.tsx` *already* exposes a Lease End date field. The prompt adds a faster inline edit; if the client only meant "we couldn't find where to edit it," the feature essentially exists already — worth confirming with them.
- **Prompts 2 & 6** touch areas with no existing data fields (proration storage; per-unit photos). Both prompts deliberately tell Opus to flag the schema gap and propose the smallest change before building, so you keep control over Notion changes.
- **Prompt 1** changes the default landing route — confirm the client is fine with the dashboard no longer being the first screen.
