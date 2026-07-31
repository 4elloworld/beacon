 Beacon — Improvements Log

> **For future sessions:** Read this file first, then continue from the "Next iteration" section.
> Start every session with: "Read IMPROVEMENTS.md and continue from where we left off."

---

## Session date
2026-05-29

---

## CSV test results

**File tested:** `beacon-2025 Transactions.csv`
**Properties:** 6 (128 W Woodstock Circle Dr, 88 N Woodstock Circle Dr, 10 Red Deer Ln, 3231 Mourning Dove Dr, 15 S Tallowberry Dr, 17911 Rose Hill Park Lane)
**Rows:** 366 transactions, Jan 2025 – Apr 2026

### Technical findings

**✅ What worked:**
- Report type detected correctly as `general_ledger` (Date/Property/Description/Money In/Money Out headers matched)
- 6 unique properties identified after address normalization (trailing spaces stripped correctly)
- Late fee pattern: 17 late fees + NSF on 128 W Woodstock → `late_fee_pattern` fires correctly
- Duplicate management fees: 3231 Mourning Dove + 88 N Woodstock (May 2025) → `duplicate_charge` fires
- Invoice splitting: 03/29/2025 17911, 10/14/2025 3231, 01/25/2026 17911 → fires correctly
- Round numbers: 17911 Rose Hill Park Lane 76% of repairs are multiples of $50 → fires
- Missing vendor: all 4 properties with "Repairs" get flagged (no Vendor column in CSV)
- Management fee batching: 04/21/2025, 07/07, 09/11, 02/06/2026, 04/06/2026 → multiple `late_mgmt_billing` flags

**❌ What didn't work:**
- `vacancy` detection is **completely broken**: the rule iterates only months that have amountIn entries. Months with zero rent never appear in the `rentByMonth` object, so consecutive zero-rent months are invisible. 15 S Tallowberry Dr sat vacant Jan–Jul 2025 and generated **no vacancy flag**.
- **Double-flagging:** Days with batched management fees (3+ fees same day) trigger BOTH `invoice_splitting` AND `late_mgmt_billing`. Results in inflated flag count and confusing duplicates.
- No `Vendor` column in CSV means `missing_vendor` fires on every repair across every property — including valid ones. Produces noise.

### Customer-facing findings

**What was confusing:**
- Upload screen: report cards below the fold at 1280px before the compact layout fix (this session's work)
- Analyze screen auto-advanced — no moment to pause and read scan results before proceeding (fixed this session)
- "Enhance data" button on Dashboard wasn't clear it meant "add costs" — now relabeled and the panel is inline

**What felt slow:**
- Scan animation is 7 × 660ms = ~4.6 seconds. Fine for first use; may feel long on repeat visits.
- "See what we found →" CTA now requires a click — deliberate pause is correct product behavior

**What was missing:**
- True expense ratio KPI was locked but no clear path to unlock it — now has an "add costs to unlock" inline link that opens the costs panel
- Delta display "107% → 134% after taxes + insurance" was not shown — now implemented

**What landed well:**
- Anomaly flag feed design (pill severity + title + detail) — clear and scannable
- Property health card grid — address concealment is intuitive
- Scan step animation with OK/flag/warn icons — creates appropriate drama

---

## Technical debt

### Blocking
- **Vacancy detection bug** (`anomalyDetector.js` lines 83–108): `rentByMonth` only stores months with positive income; consecutive zero-income months are never added to the array so the loop can't detect the gap. Fix: build a month array from `dateRange` and check each month for rent presence, OR collect all months with any transaction and check income separately.

### High
- **Double-flagging management fee days**: `invoice_splitting` and `late_mgmt_billing` both fire on same-day batched fee dates. Fix: in `invoice_splitting` rule, exclude rows where description matches `/management fee|mgmt fee/i` (those are already caught by rule 6), OR merge the two rules.
- **Dashboard uses hardcoded `DEMO_KPIS`**: real `analysisResults` from the backend exist in AppContext after upload but Dashboard doesn't read them. KPIs, flags, and property data should come from `analysisResults` when available, falling back to demo.
- **Missing costs panel input bug** (`einput` value): `defaultValue` was used in Enhance (uncontrolled), changed to `value` in Dashboard panel. Requires testing that typing in the field works without focus loss.

### Low
- `Enhance.jsx` is now dead code (no screen points to it) — should be deleted or repurposed
- `Reveal.jsx` is now dead code — replaced by `KeyTakeaways.jsx`
- `KeepGoing.jsx` is now dead code — replaced by `Remedies.jsx`
- `docker-compose.yml` has obsolete `version:` attribute (harmless warning)
- `missing_vendor` rule fires on ALL repair charges when no vendor column exists — too noisy. Should add a minimum dollar threshold (e.g. only flag if total > $500) or only flag if there are 3+ charges.

---

## UX issues

| Issue | Severity | Proposed fix |
|---|---|---|
| Vacancy detection never fires | Critical | Fix backend rule (see tech debt) |
| Double-flagged mgmt fee days | High | Exclude mgmt fees from invoice_splitting rule |
| Dashboard KPIs are hardcoded demo data | High | Wire `analysisResults` from AppContext |
| AI chat (/api/query) not surfaced in the UI | High | Add chat panel to Dashboard (floating or drawer) |
| "Your Move" rocks are identical in both Screen 5 and Screen 6 (Remedies) | Medium | Screen 5 keeps rocks with dismiss; Remedies shows them read-only as reference |
| Step nav overflows at some viewport widths | Low | Truncate step labels on mobile (already done for <620px) |
| No empty state when no CSV uploaded and user reaches Dashboard | Low | Demo data shows but no banner explaining it's demo |

---

## Changes implemented this session

### Screen structure: 7 → 6 screens
- **Before:** Upload → Analyze → Enhance → Dashboard → Reveal → Your Move → Keep Going
- **After:** Upload → Analyze → Dashboard → Key Takeaways → Your Move → Remedies
- Removed `Enhance` as a standalone screen
- Renamed `Reveal` → `KeyTakeaways` (new file, same content, updated heading)
- Created `Remedies` combining rock cards + action checklist from `KeepGoing`
- Updated `StepNav.jsx` labels: Upload · Analyze · Dashboard · Key Takeaways · Your move · Remedies
- Updated `App.jsx`: 6-screen map, removed Enhance/Reveal/KeepGoing imports

### Analyze screen — no auto-advance
- **Before:** auto-advanced 900ms after scan animation completed
- **After:** "See what we found →" CTA button appears only after final scan step; user must click
- Backend analysis result stored in ref; applied on CTA click (no timing dependency)

### Dashboard — cost inputs panel + live KPI recalculation
- Added "Missing costs" collapsible panel below KPI grid
- Cost inputs (`property_tax`, `insurance`, `mortgage`, `landscaping`, `reserves`) moved from Enhance into panel
- **Live recalculation:** Total expenses and Net position cards update instantly when costs are entered
- **True expense ratio card:** starts locked/grayed with "add costs to unlock" link; activates on first cost
- **Count-up animation:** ratio animates from old to new value over 500ms using `useCountUp` hook
- **Gold border flash:** expense-related KPI cards flash on cost change via `kpiFlash` CSS animation
- **Delta display:** "115% → 134% after taxes + insurance" shown as KPI sub-label
- "Your true picture is more significant than AppFolio shows" message if ratio increases
- Completeness meter inside panel updates in real time

### Upload screen — above fold at 1280px
- Removed second paragraph (help links) — saves ~30px
- Drop zone made compact (reduced padding, horizontal layout) — saves ~60px
- Report cards replaced with compact grid cards (name + one-line description) — saves ~200px
- Full screen now fits above fold on 1280×800 viewport

### CSS additions
- `@keyframes kpiFlash` — gold border pulse for KPI cards
- `.kpi.kpi-flash` — animation class
- `.costs-panel`, `.costs-panel-toggle`, `.costs-panel-body` — inline cost panel
- `.drop-zone.compact` — shorter drop zone for Upload
- `.report-grid-compact`, `.report-card-compact`, `.report-icon-sm` — compact report cards
- `--gold-dark: #A87A25` CSS token added

---

## Next iteration — top 5 (ordered by impact)

### 1. Fix vacancy detection in `anomalyDetector.js` (Blocking bug)
**Why:** 15 S Tallowberry had no rent for 7 months — one of the most valuable flags — and it never fires. This is the single most important backend fix.
**How:** Refactor the vacancy rule to build a full date range from min/max transaction dates, then check each calendar month for zero rent income. Flag when 2+ consecutive months have zero `amountIn`.

### 2. Wire `analysisResults` to Dashboard (High — makes real data visible)
**Why:** The real CSV gets analyzed by the backend (flags, property stats, financial totals) but Dashboard shows hardcoded demo data. Real data should show when available.
**How:** In `Dashboard.jsx`, use `analysisResults` from AppContext when non-null; fall back to DEMO_* otherwise. Map backend `flags` array to the flag feed. Map `properties` array to the property grid. Use backend totals for KPI cards.

### 3. Surface AI chat on Dashboard (High — core product differentiator)
**Why:** The `/api/query` backend route works but no UI connects to it. The AI system prompt is loaded and ready.
**How:** Add a floating chat drawer or bottom panel on Dashboard. Input field + response display. Wire to `POST /api/query` with `ownerContext`, `question`, and `portfolioSummary` from analysisResults.

### 4. Fix double-flagging between `invoice_splitting` and `late_mgmt_billing`
**Why:** Batched management fee days appear in both rules. Creates duplicate flag entries and inflates the flag count misleadingly.
**How:** In `invoice_splitting`, filter out rows where description matches `/management fee|mgmt fee/i` before counting charges per day.

### 5. Add empty/demo state banner to Dashboard
**Why:** When no CSV is uploaded, Dashboard shows demo data with no indication it's fake. A first-time user may be confused by the discrepancy between their data and what's shown.
**How:** In AppContext, track `isDemo` (true when portfolioData is null). Show a gold banner at the top of Dashboard: "Showing demo data — upload your General Ledger to see your real portfolio."
