# BPO Hub Transition — Executive Center (v3)

A simplified executive control tower for a Business Process Outsourcing (BPO) Hub workforce
transition. **Six tabs, organised around executive questions rather than data sources.**

**This is a prototype on illustrative, invented data.** No figure on any page is real.

> ### What changed from v2
> v2 had 10 tabs, 40 KPI cards and 21 charts, organised by where the data came from
> (transition / onshore / offshore / workforce / execution). v3 has **6 tabs, 26 KPI cards in 12
> labelled question groups, and 9 charts**, organised by what an executive actually needs to decide. Every duplicate metric,
> every chart that restated a table, and every visual with no action attached was removed.
> v1, v2 and v3 deploy as separate Vercel projects from separate repositories.

---

## The six tabs

| # | Tab | The question it answers |
|---|---|---|
| 01 | **Executive Brief** | Where do we stand, where do we land, and what needs me first? |
| 02 | **Savings & Delivery** | What is driving the gap, who owns it, and what would change it? |
| 03 | **Workforce** | Are we the shape we committed to, and where are we fragile today? |
| 04 | **Planning & Forecast** | Where is the workforce heading, and is the work funded and assigned? |
| 05 | **Decisions** | Who is carrying the gap, what is blocked, what is slipping? |
| 06 | **Reference** | Can I trust this number, where does it appear, and where is it pulled from? |

Every tab's KPI cards sit in labelled question groups — *"Where do we land?"*, *"What is delay
costing us?"*, *"Who is carrying the gap?"* — so the grouping itself carries meaning.

## Design rules

**KPI cards are grouped under the question they answer.** Not one undifferentiated row of ten
tiles — two or three cards beneath a heading like *"Where do we land?"* So the grouping itself
carries meaning.

**Every methodology popover opens with that question in a highlighted callout**, then the formula
and caveats beneath. Open the ⓘ on Savings vs. Plan-to-Date and the callout reads *"Are we actually
banking the money we said we would?"*

**One ranked attention list.** In v2, exceptions were scattered across six tabs and nothing
ranked them against each other. The Executive Brief now carries a single list of every exception
across savings, delivery, workforce and execution — severity-ranked, each with an accountable
owner and a click-through to the evidence. Severity is rule-based rather than a single fabricated
score, because a headcount risk and a dollar risk are not the same unit.

**Nothing appears twice.** Cost leakage, savings at risk, exits, stabilized roles and FTE share
were each rendered on two different tabs in v2. Each now has one home.

## What was removed, and why

| Removed | Reason |
|---|---|
| Exit date variance histogram | The two useful numbers (average delay, on-time rate) were already cards |
| Roles by conversion wave | The wave chart on the summary already contained it |
| BPO Hub headcount by function | A near-mirror of the onshore chart, two tabs apart, so the comparison was never visible |
| Knowledge transfer funnel | Replaced by **KT readiness by wave**, which shows the leading indicator instead of process detail |
| Action items by status | 28 items across 5 buckets; the KPI cards already said it |
| Initiative health donut | 14 items across 3 buckets; the table beneath carries RAG |
| Capability coverage chart | It was the top 14 rows of the table directly beneath it |
| Location alignment matrix | Genuinely interesting, but no action attached at executive altitude |
| Onshore View, Indonesia View | Tabs that existed because the data has two sides, not because executives have two questions |
| — | *Workforce Planning was kept, as its own tab — forecast, funding alignment and capability coverage needed room rather than compression* |
| Scenario save/load, comparison chart, forecast method picker | Workbench simplified to presets plus one slider; method selection moved to Reference |
| 8 duplicate KPI cards | Same number rendered on two tabs |

## What was added

**Cost concentration (Pareto).** The old chart showed headcount by function. Headcount and cost
are not the same shape. This ranks functions by annualised cost with the cumulative share
overlaid, and states the finding plainly: *the top 4 of 17 functions carry half the $28.4M.*

**KT readiness by wave.** Knowledge transfer status stacked per wave. Exposure runs 0% → 26% →
84% → 100% across waves — a leading indicator of delivery failure that costs nothing on paper
until service breaks.

**Function drill-through.** Click any function name in the variance table and a panel opens with
the accountable owner, five headline stats, and **every individual position falling behind** —
position id, wave, location, target exit date, days late, why it is behind, and unrealized
savings. A gap becomes a conversation with a named owner rather than a number.

**Function accountability on Decisions.** Every function ranked by unrealized savings with its
accountable owner, positions behind, and open/overdue actions. Clicking through opens the full
drill-down: the individual positions falling behind, the initiatives covering that domain, and the
actions in flight — so a gap is always attached to a name and to work already under way.

**A real metric dictionary.** Twenty metrics with seven columns: metric, **where it appears**,
definition, formula, **where it is pulled from**, owner, and current value.

**Simplified scenario workbench.** Three preset chips carrying the programme's own history (best
quarter / current pace / worst quarter), one prominent realization-rate slider, four advanced
levers behind an expander. The three reference outcomes stay fixed; a separate *"Your scenario"*
card is the only thing the sliders move — so you always see what you are modelling against what
history says.

## Opening the tool

**No sign-in.** A Viewer / Admin switch in the top bar demonstrates role-based access — Admin
controls are absent from the page entirely for a Viewer, not disabled. Production replaces this
with SSO, which supplies both identity and role.

## Deploying to Vercel

Push to its own **private** GitHub repository → **vercel.com/new** → import → framework preset
**Other** → leave Build Command, Output Directory and Install Command **empty** → Deploy.

> ### ⚠️ Private repo and Deployment Protection required
> This build has **no authentication at all**. Anyone with the URL sees everything, including the
> Admin actions and exports. Do not put real programme data on an unprotected deployment.

## Architecture rule

`js/metrics.js` is the **only** place any aggregation is computed. Charts, KPI cards, storylines,
forecasts, exports, email drafts and the chat assistant all call the same pure functions of
`(DATA, activeFilters)`. That is what guarantees the assistant can never contradict a chart.

`js/app.js` is the engine — state, filtering, chrome, chart infrastructure, scenario math,
routing. `js/pages.js` owns every piece of markup and rendering. Nothing is computed in either.

## What is demo-grade

- **Authentication** — none. Private repo plus Deployment Protection are the only controls.
- **All data** — invented. Transition aggregates reconcile to the approved wireframe.
- **Leakage, savings-at-risk, and the scenario coefficients** — directional, pending ratification.
- **Forecast methods, anomaly thresholds and scenario levers** — chosen by the builder, not derived from programme history. These need validating with programme leadership.
- **Storyline and chat assistant** — rule-based, not a language model, by design.
- **Persistence** — browser localStorage only.

## Project layout

```
index.html            six tabs
css/styles.css        Aberdeen brand system — palette is locked
js/data.js            transition roles, with accountable owner per role
js/workforce.js       roster, WFT forecast, initiatives, actions, funding, policy
js/metrics.js         the ONLY aggregation layer
js/forecast.js        projections, confidence band, leakage forecast
js/app.js             engine: state, filters, chrome, charts, scenario math, routing
js/pages.js           all markup and rendering for the six tabs
js/exports.js         2027 CT / EBC workbook, Jira CSV, roster CSV
js/admin.js           admin actions, email drafts, action log
js/chatbot.js         intent parser over the metrics layer
js/upload.js          Excel template, validation, preview, commit
```
