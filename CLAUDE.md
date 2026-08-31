# CLAUDE.md — BPO Hub Transition Executive Center (v3)

## What this is

A static, executive-grade demo (plain HTML/CSS/JS, CDN deps, no build step). **Five tabs
organised around executive questions, not data sources.** All data is invented. Deploys to Vercel
as-is and opens from `file://`. Separate deployment from v1 and v2 — do not merge them.

## The two architectural rules

**1. `js/metrics.js` is the ONLY place aggregations are computed.** Every consumer — KPI cards,
charts, storylines, forecasts, exports, email drafts, the chat assistant — calls the same pure
functions of `(DATA, activeFilters)`. Never compute a figure elsewhere; never hardcode one in
markup.

**2. `js/app.js` is the engine, `js/pages.js` is the surface.** app.js owns state, filtering,
chrome, chart infrastructure, scenario math and routing. pages.js owns every piece of markup and
rendering. Neither computes a figure.

## File responsibilities

| File | Owns |
|---|---|
| `js/data.js` | Transition roles, each with an accountable `owner` (role title, never a person) |
| `js/workforce.js` | Roster, WFT forecast, initiatives, actions, funding, `DATA.policy` |
| `js/metrics.js` | All aggregation. `attentionList`, `functionDrilldown`, `costConcentration`, `ktByWave` are v3 additions |
| `js/forecast.js` | Forecast methods, confidence band, leakage projection |
| `js/app.js` | Engine (above). Exposes `C`, `alpha`, `chartClick`, `dimColors`, `showModal`, scenario math |
| `js/pages.js` | `INFO` map, all five tabs' markup, all rendering, storylines, drill-down, scenario UI |
| `js/exports.js` | 2027 CT / EBC workbook, Jira CSV, roster CSV |
| `js/admin.js` | Admin-only DOM — mounted only when role === Admin |
| `js/chatbot.js` | Intent parser → METRICS |
| `js/upload.js` | SheetJS template, validation, delta preview, localStorage commit |

Script tags load in dependency order — no ES modules (must work from `file://`).

## Design rules — do not regress these

- **KPI cards are grouped under the question they answer**, via `group(question, cards)`. Never
  emit an undifferentiated row of tiles.
- **`INFO` entries are `[title, question, methodology]`** and the popover renders the question in
  bold, first. Every new metric needs all three.
- **Nothing appears twice.** Before adding a card or chart, check the metric does not already have
  a home on another tab.
- **Every visual must lead to an action.** If it does not change a decision, it belongs on
  Reference or in the chat assistant.
- The attention list is the Executive Brief's centrepiece. New exception types belong in
  `METRICS.attentionList`, not as another tile somewhere.

## Filter dimensions

- `domain`, `location`, `businessUnit` — **shared**; filter transition roles *and* the workforce roster.
- `wave`, `functionName`, `status`, `ktStatus`, `ktStage`, `statusBucket`, `varianceBucket` — transition only.
- `workerType`, `team`, `capability`, `fundingSource`, `vendorName` — workforce only.

Never add a workforce dimension to `FILTER_DIMS`; `filterRoles` would exclude every role.

## Policy switches

`DATA.policy` holds contested definitions, surfaced on the Reference tab. Changing one must
recalculate every tab — route changes through `APP.updateAll()`. `bpoHubCountsAsNonFte` reverses
both the 70/30 verdict and the forecast direction; always keep both readings visible.

## Brand constraints (locked)

Aberdeen Blue `#09375F`, Verdigris `#44B0B1`, White, Onyx `#404040`; charts and status only:
Sky `#5CC8FF`, Jade `#00A676`, Gold `#F7D002`, Jasper `#DB504A`. No other hex values. Poppins
throughout (200 headings / 500 labels / 400 body), Arial fallback, no monospace. **Never Verdigris
text on white** — RAG on white uses Jade / `#8A7400` / Jasper, always paired with a label. Chart
series order: Blue → Verdigris → Sky → Gold → Jade → Jasper. Logos are the real SVGs in `assets/`.

## Data invariants

**Transition:** 200 roles · 117 exited · 70 stabilized · 19 overdue · $2.8M realized vs $3.4M
plan-to-date · $6.0M target · $4,707K allocated (reconciliation gap $1,293K) · $496K across the
four zero-realization functions · cost concentration: top 4 of 17 functions = 50% of $28.4M ·
KT exposure by wave 0% / 26% / 84% / 100%.

**Workforce:** 340 positions — 207 FTE / 48 Contractor / 55 Vendor / 30 BPO Hub · 60.9% FTE
including the hub, 66.8% excluding · 7 vendors, 4 fragmented teams · 23 contracts inside the
90-day cliff · 3 single-point-of-failure capabilities · 14 initiatives, 4 dependency-blocked ·
28 action items, 5 overdue.

## Anonymization

Always "BPO Hub", "Indonesia", "Onshore". The pre-anonymization programme terms and the former
offshore country name must never appear in any file, comment or variable name. **No personal
names anywhere** — owners are role titles, vendors are Greek letters, positions are `W-001` /
`R-001`. Emails use `*@client.example`.

## Verify before committing

`node --check js/*.js`, load the page, walk all five tabs, confirm zero console errors, check no
tab renders `undefined` or `NaN`, open a function drill-through, flip `bpoHubCountsAsNonFte` and
confirm every tab moves, spot-check chatbot answers against the visuals, and confirm the Viewer
role contains no admin DOM. There is no login screen — do not reintroduce one.
