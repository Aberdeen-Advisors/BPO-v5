/* ============================================================================
   PAGES (v3) — all markup and rendering for the six tabs.
   Presentation only. Every figure comes from METRICS.
   KPI cards are grouped under the question they answer, and every methodology
   popover leads with that question in bold.
   ============================================================================ */

var PAGES = (function () {
  'use strict';

  var C, CH = {};
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return APP.esc(s); }
  function fmt$(v) { return APP.fmt.$(v); }
  function fmtM(v) { return APP.fmt.M(v); }
  function fmtPct(v) { return APP.fmt.pct(v); }
  function p1(v) { return APP.fmt.pct1(v); }

  /* ------------------------------------------------------------------ INFO ---
     [ title, question this answers (rendered bold), methodology ]            */
  var INFO = {
    attainment: ['Rolloff Attainment', 'Are roles leaving on the schedule we committed to?',
      'Exited roles divided by the roles planned to have exited by the as-of date. Time-phased against the plan, not the full programme — so it measures pace, not completeness.'],
    ytdSavings: ['Savings vs. Plan-to-Date', 'Are we actually banking the money we said we would?',
      'Realized savings on the exited basis against the time-phased plan. Calculated from rate arbitrage — onshore cost stopped less BPO Hub cost added. Not invoiced amounts; a reconciliation to what Finance books is not yet in place.'],
    projected: ['Projected Year-End', 'Will we hit the commitment?',
      'YTD actual plus remaining planned pipeline multiplied by the trailing realization rate. A single-point projection; the confidence band on the curve shows the plausible range around it.'],
    gapTarget: ['Gap to Target', 'How far short will we fall, in dollars?',
      'Projection minus the leadership baseline commitment. Negative means a shortfall.'],
    fteShare: ['FTE Share vs. Target', 'Is the workforce the shape we committed to?',
      'FTE divided by total workforce against the 70% target. Whether the BPO Hub counts in the denominator is a policy switch on the Reference tab — it changes the answer, so it is never left implicit.'],
    realization: ['Realization Rate', 'How much of what we plan actually turns into savings?',
      'Actual divided by planned savings over the trailing two completed quarters. The partial current quarter is excluded so an incomplete period cannot flatter the rate.'],
    ytdVariance: ['YTD Variance', 'How far behind plan are we right now?',
      'Realized savings minus plan-to-date. The percentage is that variance against plan-to-date.'],
    overdue: ['Overdue Rolloffs', 'What is late right now, and how late?',
      'Roles past their target exit date and not yet exited, with the mean days past due across that population only.'],
    leakage: ['Cost Leakage', 'What is lateness costing us?',
      'Cumulative onshore cost carried past target exit dates — overdue roles multiplied by daily onshore cost and days late. Methodology is directional and awaiting ratification by the data owner.'],
    costConc: ['Cost Concentration', 'Where does the money actually sit?',
      'Functions ranked by annualised onshore cost, with the cumulative share overlaid. Headcount and cost are not the same shape — this shows which few functions carry the majority of spend, and therefore where intervention is worth most.'],
    ktWave: ['Delivery Readiness by Wave', 'Is the receiving side ready for what is about to exit?',
      'Knowledge transfer status for every role in each wave. Exposure is the share with no knowledge transfer started. Because savings recognize at exit, an unready wave costs nothing on paper until service breaks — which is why it is a leading indicator rather than a lagging one.'],
    variance: ['Variance by Function', 'Who owns the gap, and how big is theirs?',
      'Headcount exited against full-programme plan, and realized savings against the function-allocated plan. RAG thresholds: 80% or above green, 40–79% amber, below 40% red. Click a function name for the individual positions falling behind and the accountable owner.'],
    reconcile: ['Baseline Reconciliation', 'Does the plan even add up to the commitment?',
      'Function-level planned savings summed against the leadership baseline. The difference is not attributable to any function — it is either an allocation gap in the plan or an over-commitment in the target, and it should be resolved before the baseline is treated as locked.'],
    curve: ['Cumulative Savings & Forecast', 'Where do we land, and how confident should we be?',
      'Running total of planned versus actual savings against the target. The shaded band realizes the remaining pipeline at the historical quarterly rate plus or minus one standard deviation. Dashed line is the selected forecast method.'],
    scenario: ['Scenario Workbench', 'What would actually change the outcome?',
      'Year-end equals YTD actual plus remaining pipeline multiplied by the realization rate, adjusted for exit pace, delay, ramp time and attrition cost. The three presets are the programme’s own best quarter, current pace, and worst quarter — not invented optimism. No scenario is a commitment.'],
    scenResources: ['Scenario Resourcing', 'Do we have the people to execute this scenario?',
      'Capability demand from in-flight initiatives against uncommitted capacity only — someone already assigned to an initiative cannot staff a scenario twice. Demand scales with the exit pace lever.'],
    attention: ['Where Attention Is Needed', 'What are my top problems, ranked?',
      'Every exception across savings, delivery, workforce and execution in one ranked list. Severity is rule-based rather than a single fabricated score, because a headcount risk and a dollar risk are not the same unit. Each row names an accountable owner and links to the evidence.'],
    wfTotal: ['Workforce Composition', 'What is the workforce made of?',
      'Every position in scope by engagement type: FTE, individual contractor, vendor-supplied, and BPO Hub. Source is the roster combined with the contracting register.'],
    wfDefinition: ['Definition Check', 'Which answer about the 70/30 target is the real one?',
      'The same roster measured two ways. Under one definition the programme is on target; under the other it is not, and the forecast reverses direction. Nothing about the people changes. This exists so the definition gets an owner and a decision.'],
    wftForecast: ['Workforce Trajectory', 'Where does the workforce shape end up?',
      'Historical monthly actuals followed by a forecast, against the target line, under both definitions. A planning curve rather than a commitment — it assumes current hiring and attrition patterns hold.'],
    funding: ['Requirement, Funding and Assignment', 'Where do demand, money and people stop lining up?',
      'Three numbers usually tracked in three separate places: what the work requires, what has been funded, and what is actually assigned to a person. The gaps between them are the point.'],
    wfSpof: ['Single Points of Failure', 'Which skills would we lose if one person left?',
      'Capabilities held by one person, and those at or below the critical cover threshold. One resignation removes the capability entirely, which is why this is tracked separately from headcount.'],
    wftOverTime: ['Workforce Over Time', 'How is the workforce changing, and where does it end up?',
      'Monthly headcount by engagement type — twelve months of actuals followed by ten months of forecast, shown dashed. A planning curve rather than a commitment; it assumes current hiring and attrition patterns hold.'],
    accountability: ['Function Accountability', 'Who is carrying the gap, and what are they doing about it?',
      'Every function ranked by unrealized savings, with the accountable owner, how many positions are behind, and the open and overdue actions attached to that domain. Click a function to see the individual positions, the initiatives covering it, and the actions in flight.'],
    wfRisk: ['Workforce Risk', 'Where is the workforce fragile?',
      'Contract expiries inside the policy window, capabilities resting on too few people, and teams carrying several vendors — merged into one ranked list so exposure is read in one place rather than three.'],
    initiatives: ['Initiatives and Dependencies', 'What is blocking what, and is it staffed?',
      'RAG status, required versus assigned headcount, and dependency position. An initiative is flagged blocked when something it depends on is neither complete nor green.'],
    triggers: ['Resource Trigger Points', 'What decisions are already agreed?',
      'Thresholds set in advance so that crossing one produces an action rather than a debate. When a trigger fires, the named action happens.'],
    actions: ['Action Items', 'What commitments are slipping?',
      'Open commitments with an owner and a due date. Overdue means past due and not closed, measured against the as-of date.'],
    notes: ['AI-Assisted Note Analysis', 'What are people actually saying in the status updates?',
      'Free-text notes scanned against a maintained keyword set grouped into themes, then weighted by status, priority and how overdue an item is. Deterministic and explainable — it cannot invent a risk that is not in the text. In production this becomes a language model behind the same interface.'],
    switches: ['Definition Switches', 'How much does a definition actually change the answer?',
      'These change real calculations across every tab. They exist because project managers reported being unable to explain how several headline metrics are derived — the fix is to make each choice visible and owned rather than buried in code.'],
    dictionary: ['Metric Dictionary', 'Can I trust this number, and who owns it?',
      'One row per metric: meaning, formula, source, owner and current value. This is the reference a certified semantic model would eventually enforce.'],
    quarterly: ['Quarterly Savings', 'When did the deficit actually form?',
      'Time-phased plan against actual by quarter. The current quarter is partial and excluded from the realization rate. More actionable than a year-to-date variance because it points at what changed and when.'],
    waveDetail: ['Wave Progress', 'Which wave is failing?',
      'Planned and actual exits per conversion wave. Planned sums to the full programme; actual is on the exited basis.'],
    intMap: ['Integration Map', 'How does this connect to everything else?',
      'Target ecosystem. One governed backend feeds every front end, so the dashboard, the delivery tracker and the planning submission cannot quote different numbers.'],
    exports: ['Live Exports', 'How do I get this into the tools I already use?',
      'Real files in the shape each destination expects, generated from the current filtered view in your browser. Nothing is transmitted anywhere.'],
    storyline: ['AI-generated storyline', 'What is the one-paragraph version?',
      'Generated by a deterministic narrative engine over the same metrics layer as every chart, so it can never contradict a visual. Regenerates on every filter or data change. In production this swaps to a live language model behind the same guardrail.']
  };

  /* -------------------------------------------------------------- markup --- */
  function info(key) { return '<button class="info-btn inline-info" data-info="' + key + '" aria-label="Methodology">i</button>'; }
  function card(id, title, key) {
    return '<div class="kpi-card"><button class="info-btn" data-info="' + key + '" aria-label="Methodology">i</button>' +
      '<h4>' + title + '</h4><div class="kpi-value" id="kv-' + id + '">—</div>' +
      '<div class="kpi-sub" id="ks-' + id + '"></div></div>';
  }
  function group(question, cards) {
    return '<section class="kpi-group"><h3 class="kpi-group-q">' + question + '</h3>' +
      '<div class="kpi-row">' + cards + '</div></section>';
  }
  function set(id, v, sub, cls) {
    var el = $('#kv-' + id); if (!el) return;
    el.innerHTML = v; el.className = 'kpi-value' + (cls ? ' ' + cls : '');
    $('#ks-' + id).innerHTML = sub || '';
  }
  function panel(title, caption, key, inner, cls) {
    return '<div class="panel ' + (cls || '') + '"><div class="panel-head"><div class="titles">' +
      '<h3>' + title + '</h3><div class="caption">' + caption + '</div></div>' + info(key) + '</div>' + inner + '</div>';
  }
  function story(page) {
    return '<div class="storyline' + (page === 1 ? ' hero' : '') + '" id="sl-' + page + '">' +
      '<div class="story-head"><h4>Storyline</h4><span class="ai-pill" id="sl-pill-' + page + '">AI-generated</span>' +
      info('storyline') + '</div><div class="story-body" id="sl-body-' + page + '"></div></div>';
  }

  /* --------------------------------------------------------------- build --- */
  function build() {
    // ============ 1 · EXECUTIVE BRIEF ============
    $('#p1-body').innerHTML = story(1) +
      '<div class="kpi-groups">' +
      group('Are we delivering the plan?',
        card('attain', 'Rolloff Attainment', 'attainment') + card('ytd', 'Savings vs. Plan-to-Date', 'ytdSavings')) +
      group('Where do we land?',
        card('proj', 'Projected Year-End', 'projected') + card('gap', 'Gap to Target', 'gapTarget')) +
      group('Is the workforce the right shape?',
        card('fte', 'FTE Share vs. Target', 'fteShare')) + '</div>' +
      '<div class="brief-grid">' +
        panel('Cumulative Savings & Forecast', 'Actual against plan, with the confidence range and the target line', 'curve',
          '<div class="chart-box" style="height:250px"><canvas id="c-cum"></canvas></div>' +
          '<div class="method-note" id="curve-note"></div>') +
        panel('Where Attention Is Needed', 'Every exception across the programme, ranked, with an owner', 'attention',
          '<div id="attention-list"></div>') +
      '</div>';

    // ============ 2 · SAVINGS & DELIVERY ============
    $('#p2-body').innerHTML = story(2) +
      '<div class="kpi-groups">' +
      group('How far behind are we, and why?',
        card('s-act', 'YTD Actual', 'ytdSavings') + card('s-var', 'YTD Variance', 'ytdVariance') +
        card('s-rate', 'Realization Rate', 'realization')) +
      group('What is delay costing us?',
        card('s-od', 'Overdue Rolloffs', 'overdue') + card('s-leak', 'Cost Leakage', 'leakage')) + '</div>' +
      '<div class="chart-grid">' +
        panel('Where Cost Is Concentrated', 'Functions by annualised onshore cost, with cumulative share — bars are cost, the line is the running total', 'costConc',
          '<div class="chart-box" style="height:250px"><canvas id="c-cost"></canvas></div>' +
          '<div class="chart-note" id="cost-note"></div>') +
        panel('Delivery Readiness by Wave', 'Knowledge transfer status for every role in each wave', 'ktWave',
          '<div class="chart-box" style="height:250px"><canvas id="c-kt"></canvas></div>' +
          '<div class="chart-note" id="kt-note"></div>') +
      '</div>' +
      panel('Cost of Delayed Exits', 'Cumulative leakage to date, extended forward at the recent pace', 'leakage',
        '<div class="chart-box" style="height:190px"><canvas id="c-leak"></canvas></div>' +
        '<div class="method-note" id="leak-note"></div>') +
      panel('Variance by Function', 'Click a function name for the positions falling behind and who owns them', 'variance',
        '<div style="overflow-x:auto"><div id="t-variance"></div></div>' +
        '<div class="chart-note" id="reconcile-note"></div>') +
      panel('Scenario Workbench', 'Three presets drawn from the programme\u2019s own history. Adjust and everything recomputes live.', 'scenario',
        '<div id="scen-body"></div>');

    // ============ 3 · WORKFORCE ============
    $('#p3-body').innerHTML = story(3) +
      '<div class="kpi-groups">' +
      group('Are we the shape we committed to?',
        card('w-total', 'Total Workforce', 'wfTotal') + card('w-ratio', 'FTE Share', 'fteShare') +
        card('w-gap', 'Gap to 70 / 30 Target', 'fteShare')) +
      group('What is exposed today?',
        card('w-cliff', 'Contracts Ending &lt; 90 Days', 'wfRisk') +
        card('w-spof', 'Single Points of Failure', 'wfSpof')) + '</div>' +
      panel('Composition & Definition', 'The same roster measured two ways — the switch on Reference changes every figure here', 'wfDefinition',
        '<div class="mix-split"><div class="chart-box" style="height:210px;flex:1"><canvas id="c-mix"></canvas></div>' +
        '<div id="def-check" style="flex:1"></div></div>') +
      panel('Workforce Risk', 'Contract expiry, thin capability cover and vendor fragmentation in one ranked list', 'wfRisk',
        '<div style="overflow-x:auto"><div id="t-wfrisk"></div></div>');

    // ============ 4 · WORKFORCE PLANNING & FORECAST ============
    $('#p4-body').innerHTML = story(4) +
      '<div class="kpi-groups">' +
      group('Where is the workforce heading?',
        card('wp-now', 'Current FTE Share', 'fteShare') + card('wp-end', 'Forecast FTE Share', 'wftForecast') +
        card('wp-head', 'Forecast Headcount Change', 'wftOverTime')) +
      group('Is the work funded and assigned?',
        card('wp-unfunded', 'Unfunded Positions', 'funding') +
        card('wp-unassigned', 'Funded, Not Assigned', 'funding')) + '</div>' +
      '<div class="chart-grid">' +
        panel('Workforce Over Time', 'Twelve months of actuals then ten months of forecast, shown dashed', 'wftOverTime',
          '<div class="chart-box" style="height:250px"><canvas id="c-wft"></canvas></div>') +
        panel('FTE Share Trajectory', 'Against the 70% target, under both definitions', 'wftForecast',
          '<div class="chart-box" style="height:250px"><canvas id="c-fte"></canvas></div>' +
          '<div class="chart-note" id="fte-note"></div>') +
      '</div>' +
      panel('Requirement, Funding and Assignment', 'Where demand, money and people stop lining up', 'funding',
        '<div class="chart-box" style="height:220px"><canvas id="c-fund"></canvas></div>' +
        '<div class="chart-note" id="fund-note"></div>') +
      panel('Capability Coverage', 'Every capability with its team spread and cover flags — thinnest first', 'wfSpof',
        '<div style="overflow-x:auto;max-height:300px;overflow-y:auto"><div id="t-coverage"></div></div>');

    // ============ 5 · DECISIONS ============
    $('#p5-body').innerHTML = story(5) +
      '<div class="kpi-groups">' +
      group('What is stuck?',
        card('d-blocked', 'Blocked by Dependency', 'initiatives') + card('d-gap', 'Initiative Resource Gap', 'initiatives')) +
      group('What is slipping?',
        card('d-overdue', 'Overdue Actions', 'actions') + card('d-triggers', 'Trigger Points Armed', 'triggers')) +
      group('Who is carrying the gap?',
        card('d-funcs', 'Functions Needing Attention', 'accountability') +
        card('d-unreal', 'Unrealized Savings', 'accountability')) + '</div>' +
      panel('Function Accountability', 'Every function ranked by exposure, with its owner. Click a function for the positions, initiatives and actions behind it.', 'accountability',
        '<div style="overflow-x:auto"><div id="t-accountability"></div></div>') +
      panel('Resource Trigger Points', 'Pre-agreed thresholds that force a decision when crossed', 'triggers',
        '<div id="t-triggers"></div>') +
      panel('Initiatives, Dependencies and Staffing', 'Click a row to filter the application to that domain', 'initiatives',
        '<div style="overflow-x:auto"><div id="t-initiatives"></div></div>') +
      panel('What the Status Notes Say', 'Free-text updates scanned for risk signals \u2014 deterministic, never invented', 'notes',
        '<div class="scen-tools" style="margin:0 0 12px"><button class="btn-ghost" id="analyze-notes">Analyse ' +
        '<span id="note-count">0</span> free-text notes</button>' +
        '<span id="analyze-stamp" style="font-size:11px;color:var(--muted);align-self:center"></span></div>' +
        '<div id="notes-out"></div>');

    // ============ 6 · REFERENCE ============
    $('#p6-body').innerHTML =
      '<div class="storyline"><div class="story-head"><h4>Why this tab exists</h4>' +
      '<span class="ai-pill">Governance</span></div><div class="story-body">' +
      'Everything here answers a question asked <b>once</b> rather than weekly: can I trust this number, ' +
      'where does it appear, how is it calculated, where is it pulled from, and who owns the definition. ' +
      '<b>The switches below change real calculations</b> across every tab.' +
      '</div></div>' +
      panel('Definition Switches', 'Move one and every tab recalculates', 'switches', '<div id="policy-switches"></div>') +
      panel('Metric Dictionary', 'Every metric, where it appears, what it means, how it is calculated, and where the data comes from', 'dictionary',
        '<div style="overflow-x:auto"><div id="t-dictionary"></div></div>') +
      '<div class="chart-grid">' +
        panel('Quarterly Savings', 'When the deficit actually formed', 'quarterly',
          '<div class="chart-box" style="height:200px"><canvas id="c-qtr"></canvas></div>') +
        panel('Wave Progress', 'Planned and actual exits per conversion wave', 'waveDetail',
          '<div id="t-waves"></div>') +
      '</div>' +
      '<div class="chart-grid">' +
        panel('Integration Map', 'One governed backend, many front ends', 'intMap', '<div id="int-map"></div>') +
        panel('Live Exports', 'Generated from the current filtered view', 'exports',
          '<div class="scen-tools" style="margin:0">' +
          '<button class="btn-ghost" id="exp-ebc">2027 CT / EBC workbook</button>' +
          '<button class="btn-ghost" id="exp-jira">Action items (Jira CSV)</button>' +
          '<button class="btn-ghost" id="exp-roster">Workforce roster (CSV)</button></div>' +
          '<div class="chart-note">Exports respect the active filter. Nothing is transmitted \u2014 files are generated in your browser.</div>' +
          '<div id="t-integrations" style="margin-top:14px"></div>') +
      '</div>';

    buildScenario();
    buildCharts();
    wire();
  }

  /* -------------------------------------------------------------- charts --- */
  function buildCharts() {
    C = APP.C;
    var alpha = APP.alpha, click = APP.chartClick;
    var money = function (v) { return v >= 1e6 ? '$' + (v / 1e6) + 'M' : '$' + Math.round(v / 1e3) + 'K'; };
    var CH2 = APP.CHARTS;

    CH.cum = CH2.cum = new Chart($('#c-cum'), {
      type: 'line', data: { labels: [], datasets: [] },
      options: { maintainAspectRatio: false,
        scales: { y: { beginAtZero: true, ticks: { callback: money }, grid: { color: C.hairline } }, x: { grid: { display: false } } },
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, boxHeight: 10, filter: function (i) { return !/band/i.test(i.text); } } },
          tooltip: { callbacks: { label: function (c) { return c.dataset.label + ': ' + (c.parsed.y == null ? '—' : fmt$(c.parsed.y)); } } } } }
    });

    CH.cost = CH2.cost = new Chart($('#c-cost'), {
      type: 'bar',
      data: { labels: [], datasets: [
        { label: 'Annualised cost', data: [], backgroundColor: [], borderRadius: 3, order: 2 },
        { label: 'Cumulative share', data: [], type: 'line', yAxisID: 'y1', borderColor: C.gold,
          borderWidth: 2, pointRadius: 2.5, pointBackgroundColor: C.gold, tension: .2, order: 1 }
      ] },
      options: { maintainAspectRatio: false, onClick: click('functionName'),
        scales: {
          y: { beginAtZero: true, ticks: { callback: money }, grid: { color: C.hairline } },
          y1: { position: 'right', beginAtZero: true, max: 1, grid: { display: false },
                ticks: { callback: function (v) { return Math.round(v * 100) + '%'; } } },
          x: { grid: { display: false }, ticks: { maxRotation: 55, minRotation: 40, font: { size: 9.5 } } } },
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, boxHeight: 10 } },
          tooltip: { callbacks: { label: function (c) {
            return c.datasetIndex === 1 ? 'Cumulative: ' + Math.round(c.parsed.y * 100) + '%' : 'Cost: ' + fmt$(c.parsed.y); } } } } }
    });

    CH.kt = CH2.kt = new Chart($('#c-kt'), {
      type: 'bar',
      data: { labels: [], datasets: [
        { label: 'KT complete', data: [], backgroundColor: C.jade, borderRadius: 3 },
        { label: 'KT in progress', data: [], backgroundColor: C.gold, borderRadius: 3 },
        { label: 'Not started', data: [], backgroundColor: C.jasper, borderRadius: 3 }
      ] },
      options: { maintainAspectRatio: false, onClick: click('wave'),
        scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, beginAtZero: true, grid: { color: C.hairline } } },
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, boxHeight: 10 } } } }
    });

    CH.leak = CH2.leak = new Chart($('#c-leak'), {
      type: 'line', data: { labels: [], datasets: [] },
      options: { maintainAspectRatio: false,
        scales: { y: { beginAtZero: true, ticks: { callback: money }, grid: { color: C.hairline } }, x: { grid: { display: false } } },
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, boxHeight: 10 } },
          tooltip: { callbacks: { label: function (c) { return c.dataset.label + ': ' + (c.parsed.y == null ? '—' : fmt$(c.parsed.y)); } } } } }
    });

    CH.mix = CH2.mix = new Chart($('#c-mix'), {
      type: 'doughnut',
      data: { labels: [], datasets: [{ data: [], backgroundColor: [], borderWidth: 2, borderColor: '#FFFFFF' }] },
      options: { maintainAspectRatio: false, cutout: '58%',
        onClick: click('workerType', function (l) { return String(l).split(' — ')[0]; }),
        plugins: { legend: { position: 'right', labels: { boxWidth: 10, boxHeight: 10, padding: 8 } } } }
    });

    CH.wft = CH2.wft = new Chart($('#c-wft'), {
      type: 'line', data: { labels: [], datasets: [] },
      options: { maintainAspectRatio: false,
        scales: { y: { stacked: true, beginAtZero: true, grid: { color: C.hairline } }, x: { grid: { display: false } } },
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, boxHeight: 10,
          filter: function (i) { return i.text.indexOf('forecast') < 0; } } } } }
    });

    CH.fte = CH2.fte = new Chart($('#c-fte'), {
      type: 'line', data: { labels: [], datasets: [] },
      options: { maintainAspectRatio: false,
        scales: { y: { min: 0.4, max: 0.85, ticks: { callback: function (v) { return Math.round(v * 100) + '%'; } }, grid: { color: C.hairline } },
                  x: { grid: { display: false } } },
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, boxHeight: 10 } },
          tooltip: { callbacks: { label: function (c) { return c.dataset.label + ': ' + (c.parsed.y == null ? '—' : Math.round(c.parsed.y * 100) + '%'); } } } } }
    });

    CH.fund = CH2.fund = new Chart($('#c-fund'), {
      type: 'bar',
      data: { labels: [], datasets: [
        { label: 'Required', data: [], backgroundColor: C.blue, borderRadius: 3 },
        { label: 'Funded', data: [], backgroundColor: C.verd, borderRadius: 3 },
        { label: 'Assigned', data: [], backgroundColor: C.sky, borderRadius: 3 }
      ] },
      options: { maintainAspectRatio: false, onClick: click('domain'),
        scales: { y: { beginAtZero: true, grid: { color: C.hairline } }, x: { grid: { display: false } } },
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, boxHeight: 10 } } } }
    });

    CH.qtr = CH2.qtr = new Chart($('#c-qtr'), {
      type: 'bar',
      data: { labels: [], datasets: [
        { label: 'Planned', data: [], backgroundColor: [], borderRadius: 3 },
        { label: 'Actual', data: [], backgroundColor: [], borderRadius: 3 }
      ] },
      options: { maintainAspectRatio: false,
        scales: { y: { beginAtZero: true, ticks: { callback: money }, grid: { color: C.hairline } }, x: { grid: { display: false } } },
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, boxHeight: 10 } },
          tooltip: { callbacks: { label: function (c) { return c.dataset.label + ': ' + fmt$(c.parsed.y); } } } } }
    });
  }

  /* -------------------------------------------------------------- update --- */
  function update(F) {
    var k = METRICS.kpis(DATA, F);
    var mix = METRICS.workforceMix(DATA, F);
    var empty = k.inScope === 0;

    // ---- tab 1
    set('attain', empty ? '—' : fmtPct(k.rolloffAttainment),
      empty ? 'No roles match the filters' : k.exited + ' exited vs. ' + k.plannedToDate + ' planned to date',
      k.rolloffAttainment >= 0.9 ? '' : 'warn');
    set('ytd', empty ? '—' : fmtM(k.realizedUSD) + ' <small>/ ' + fmtM(k.planToDateUSD) + '</small>',
      empty ? '' : '<span class="bad">' + fmt$(k.varianceUSD) + ' · ' + Math.round(k.behindPct * 100) + '% behind</span>');
    set('proj', empty ? '—' : fmtM(k.projectedYearEndUSD) + ' <small>/ ' + fmtM(k.targetUSD) + '</small>',
      empty ? '' : 'at the current ' + fmtPct(k.realizationRate) + ' realization rate');
    set('gap', empty ? '—' : fmt$(k.gapToTargetUSD), 'vs. the leadership commitment', 'bad');
    set('fte', empty ? '—' : p1(mix.headline.ratio) + ' <small>/ ' + fmtPct(mix.headline.targetRatio) + '</small>',
      mix.headline.gapHeads > 0 ? '<span class="bad">' + mix.headline.gapHeads + ' people short</span>'
                                : '<span class="good">above target</span>',
      mix.headline.onTarget ? '' : 'warn');

    // ---- tab 2
    set('s-act', empty ? '—' : fmtM(k.realizedUSD), 'realized on the exited basis');
    set('s-var', empty ? '—' : fmt$(k.varianceUSD), Math.round(k.behindPct * 100) + '% behind plan-to-date', 'bad');
    set('s-rate', fmtPct(k.realizationRate), 'trailing two completed quarters');
    set('s-od', empty ? '—' : String(k.overdue), 'averaging ' + k.avgDelayDays + ' days late', k.overdue ? 'bad' : '');
    set('s-leak', empty ? '—' : fmt$(k.leakageUSD), 'cumulative, and accelerating', 'warn');

    // ---- tab 3
    set('w-total', empty ? '—' : String(mix.total), 'positions in scope');
    set('w-ratio', empty ? '—' : p1(mix.headline.ratio),
      mix.headline.includesHub ? 'BPO Hub counted as non-FTE' : 'BPO Hub excluded from the ratio',
      mix.headline.onTarget ? '' : 'warn');
    set('w-gap', empty ? '—' : (mix.headline.gapHeads > 0 ? '+' + mix.headline.gapHeads : String(mix.headline.gapHeads)),
      mix.headline.gapHeads > 0 ? 'FTE needed to reach target' : 'above target',
      mix.headline.gapHeads > 0 ? 'bad' : 'good');
    var cliff = METRICS.contractCliff(DATA, F);
    var fund = METRICS.fundingAlignment(DATA, F);
    var cov = METRICS.roleCoverage(DATA, F);
    set('w-cliff', empty ? '—' : String(cliff.count), fmt$(cliff.annualCostUSD) + ' annualised', cliff.count ? 'bad' : '');
    set('w-spof', empty ? '—' : String(cov.singlePoints.length),
      cov.critical.length + ' at or below the critical threshold', cov.singlePoints.length ? 'bad' : '');

    // ---- tab 4 · workforce planning & forecast
    var wft = METRICS.wftSummary(DATA);
    set('wp-now', p1(wft.ratioNow), 'as at ' + APP.fmt.date(DATA.meta.asOfDate));
    set('wp-end', p1(wft.ratioEnd),
      (wft.reachesTarget ? '<span class="good">reaches target</span>' : '<span class="bad">does not reach target</span>') +
      ' by ' + wft.yearEnd.month, wft.reachesTarget ? '' : 'warn');
    set('wp-head', (wft.headcountDelta >= 0 ? '+' : '') + wft.headcountDelta,
      'net positions over ' + wft.forecastMonths + ' forecast months');
    set('wp-unfunded', empty ? '—' : String(fund.unfundedPositions), fmt$(fund.unfundedCostUSD) + ' annualised', 'warn');
    set('wp-unassigned', empty ? '—' : String(fund.unassignedPositions), 'positions with no initiative', 'warn');

    // ---- tab 5 · decisions
    var ih = METRICS.initiativeHealth(DATA, F);
    var acts = METRICS.actionStats(DATA, F);
    var acc = METRICS.functionAccountability(DATA, F);
    set('d-blocked', String(ih.blocked.length), 'of ' + ih.rows.length + ' initiatives', ih.blocked.length ? 'bad' : '');
    set('d-gap', String(ih.totalGap), 'people short across all initiatives', ih.totalGap ? 'warn' : '');
    set('d-overdue', String(acts.overdue), acts.blocked + ' blocked · ' + acts.high + ' high priority open', acts.overdue ? 'bad' : '');
    set('d-triggers', String(ih.triggers.length), 'thresholds being monitored');
    set('d-funcs', String(acc.needingAttention.length), 'of ' + acc.rows.length + ' functions off track',
      acc.needingAttention.length ? 'warn' : '');
    set('d-unreal', fmt$(acc.totalUnrealizedUSD), 'across every function with a shortfall', 'bad');

    updateCharts(F, k, mix, empty);
    renderAttention(F);
    renderVariance(F);
    renderWorkforceRisk(F);
    renderCoverage(F);
    renderAccountability(F);
    renderDefinition(mix);
    renderTriggers(ih);
    renderInitiatives(ih);
    renderWaves(F);
    renderPolicy();
    renderDictionary(F);
    renderIntegrationMap();
    renderIntegrationStatus();
    renderScenario(F);
    $('#note-count').textContent = acts.rows.length;
    storylines(F);
  }

  function updateCharts(F, k, mix, empty) {
    var alpha = APP.alpha;

    // cumulative + band + target
    var q = METRICS.quarterly(DATA, F);
    var band = FORECAST.confidenceBand(DATA, F);
    var m = FORECAST.trailing2Q(DATA, F);
    var labels = q.map(function (p) { return p.period.split(' ')[0]; });
    var last = 2;
    CH.cum.data.labels = labels;
    CH.cum.data.datasets = [
      { label: 'Target', data: labels.map(function () { return k.targetUSD; }), borderColor: C.onyx, borderDash: [7, 5], borderWidth: 1.5, pointRadius: 0 },
      { label: 'Planned', data: q.map(function (p) { return p.cumPlannedUSD; }), borderColor: C.verd, pointRadius: 3.5, tension: .25 },
      { label: 'Actual', data: q.map(function (p) { return p.cumActualUSD; }), borderColor: C.blue, borderWidth: 3, pointRadius: 4.5, tension: .25 },
      { label: 'Projection', data: labels.map(function (_, i) { return i < last ? null : i === last ? q[i].cumActualUSD : m.projectedUSD; }),
        borderColor: C.blue, borderDash: [7, 5], pointRadius: 5, pointBackgroundColor: '#FFFFFF', pointBorderColor: C.blue },
      { label: 'band-low', data: labels.map(function (_, i) { return i < last ? null : i === last ? q[i].cumActualUSD : band.lowUSD; }),
        borderColor: 'transparent', pointRadius: 0 },
      { label: 'band-high', data: labels.map(function (_, i) { return i < last ? null : i === last ? q[i].cumActualUSD : band.highUSD; }),
        borderColor: 'transparent', backgroundColor: alpha(C.sky, .22), pointRadius: 0, fill: '-1' }
    ];
    CH.cum.update();
    $('#curve-note').innerHTML = empty ? '' :
      '<span class="conf-med"><span class="conf-dot"></span>Medium confidence</span> · Year-end <b>' +
      fmtM(m.projectedUSD) + '</b>, plausible range <b>' + fmtM(band.lowUSD) + '–' + fmtM(band.highUSD) + '</b>. ' +
      (band.crossesTarget ? 'The upper band reaches the target.' : 'The range does not reach the ' + fmtM(k.targetUSD) + ' target.');

    // cost concentration Pareto
    var cc = METRICS.costConcentration(DATA, F);
    var top = cc.rows.slice(0, 12);
    CH.cost.data.labels = top.map(function (r) { return r.name; });
    CH.cost.data.datasets[0].data = top.map(function (r) { return r.costUSD; });
    CH.cost.data.datasets[0].backgroundColor = APP.dimColors(
      top.map(function (r, i) { return i < cc.functionsForHalf ? C.blue : alpha(C.blue, .45); }),
      'functionName', top.map(function (r) { return r.name; }));
    CH.cost.data.datasets[1].data = top.map(function (r) { return r.cumulativeShare; });
    CH.cost.update();
    $('#cost-note').innerHTML = empty ? '' :
      'Cost is concentrated: the top <b>' + cc.functionsForHalf + ' of ' + cc.rows.length +
      ' functions</b> carry <b>half</b> of the ' + fmtM(cc.totalUSD) + ' annualised onshore cost, and <b>' +
      cc.functionsForEighty + '</b> carry 80%. Those are the functions where intervention is worth most — ' +
      'headcount alone would point you somewhere else.';

    // KT readiness by wave
    var kw = METRICS.ktByWave(DATA, F);
    CH.kt.data.labels = kw.map(function (w) { return w.label; });
    CH.kt.data.datasets[0].data = kw.map(function (w) { return w.complete; });
    CH.kt.data.datasets[1].data = kw.map(function (w) { return w.inProgress; });
    CH.kt.data.datasets[2].data = kw.map(function (w) { return w.notStarted; });
    CH.kt.update();
    var worst = kw.filter(function (w) { return w.total; }).sort(function (a, b) { return b.exposure - a.exposure; })[0];
    $('#kt-note').innerHTML = empty || !worst ? '' :
      'Exposure rises sharply by wave — <b>' + esc(worst.label) + '</b> has <b>' + Math.round(worst.exposure * 100) +
      '%</b> of roles with no knowledge transfer started. Because savings recognize at exit, this costs nothing ' +
      'on paper until service breaks, which is exactly why it is worth watching early.';

    // merged leakage: actual then forecast
    var lf = FORECAST.leakageForecast(DATA, F);
    var lab = lf.series.map(function (p) { return p.month; }).concat(lf.projected.map(function (p) { return p.month; }));
    CH.leak.data.labels = lab;
    CH.leak.data.datasets = [
      { label: 'Actual', data: lf.series.map(function (p) { return p.cumulativeUSD; })
          .concat(lf.projected.map(function () { return null; })),
        borderColor: C.gold, backgroundColor: alpha(C.gold, .15), fill: true, tension: .3,
        pointBackgroundColor: C.gold, pointBorderColor: C.blue, pointRadius: 3.5 },
      { label: 'Projected', data: lf.series.map(function (p, i) { return i === lf.series.length - 1 ? p.cumulativeUSD : null; })
          .concat(lf.projected.map(function (p) { return p.cumulativeUSD; })),
        borderColor: C.jasper, borderDash: [6, 4], pointRadius: 3, pointBackgroundColor: '#FFFFFF',
        pointBorderColor: C.jasper, fill: false }
    ];
    CH.leak.update();
    $('#leak-note').innerHTML = empty ? '' :
      '<span class="conf-low"><span class="conf-dot"></span>Low confidence</span> · Left unchecked, leakage reaches <b>' +
      fmt$(lf.yearEndUSD) + '</b> by year-end. ' + esc(lf.note || '');

    // workforce composition
    var types = ['FTE', 'Contractor', 'Vendor', 'BPO Hub'];
    CH.mix.data.labels = types.map(function (t) { return t + ' — ' + (mix.byType[t] || 0); });
    CH.mix.data.datasets[0].data = types.map(function (t) { return mix.byType[t] || 0; });
    CH.mix.data.datasets[0].backgroundColor = APP.dimColors([C.blue, C.verd, C.sky, C.gold], 'workerType', types);
    CH.mix.update();

    // workforce over time — actuals solid, forecast dashed
    var w = METRICS.wftSummary(DATA);
    var s = w.series;
    var cut = s.filter(function (x) { return !x.forecast; }).length;
    function seg(key, color, label) {
      return [
        { label: label, data: s.map(function (x, i) { return i < cut ? x[key] : null; }),
          borderColor: color, backgroundColor: alpha(color, .5), fill: true, tension: .25, pointRadius: 0, borderWidth: 2 },
        { label: label + ' (forecast)', data: s.map(function (x, i) { return i >= cut - 1 ? x[key] : null; }),
          borderColor: color, backgroundColor: alpha(color, .2), fill: true, tension: .25, pointRadius: 0,
          borderWidth: 2, borderDash: [6, 4] }
      ];
    }
    CH.wft.data.labels = s.map(function (x) { return x.month.slice(2); });
    CH.wft.data.datasets = [].concat(seg('fte', C.blue, 'FTE'), seg('contractor', C.verd, 'Contractor'),
                                     seg('vendor', C.sky, 'Vendor'), seg('bpoHub', C.gold, 'BPO Hub'));
    CH.wft.update();

    // FTE trajectory
    CH.fte.data.labels = s.map(function (x) { return x.month.slice(2); });
    CH.fte.data.datasets = [
      { label: 'Target', data: s.map(function () { return DATA.policy.fteTargetRatio; }),
        borderColor: C.onyx, borderDash: [7, 5], borderWidth: 1.5, pointRadius: 0 },
      { label: 'Including BPO Hub', data: s.map(function (x) { return x.fteRatioInclHub; }),
        borderColor: C.blue, borderWidth: 3, pointRadius: 0, tension: .25 },
      { label: 'Excluding BPO Hub', data: s.map(function (x) { return x.fteRatioExclHub; }),
        borderColor: C.verd, borderWidth: 2, pointRadius: 0, tension: .25, borderDash: [5, 3] }
    ];
    CH.fte.update();
    $('#fte-note').innerHTML = 'Under the definition in use the ratio moves from <b>' + p1(w.ratioNow) + '</b> to <b>' +
      p1(w.ratioEnd) + '</b> by ' + w.yearEnd.month + ' — ' +
      (w.direction < 0 ? '<b>away from</b> target, because every role moved to the BPO Hub counts as non-FTE. ' +
        'The transition and the 70/30 commitment pull against each other.' : '<b>toward</b> target.');

    // funding
    CH.fund.data.labels = fund_rows(F).map(function (f) { return f.domain; });
    var fr = fund_rows(F);
    CH.fund.data.datasets[0].data = fr.map(function (f) { return f.requiredFte; });
    CH.fund.data.datasets[1].data = fr.map(function (f) { return f.fundedFte; });
    CH.fund.data.datasets[2].data = fr.map(function (f) { return f.assignedFte; });
    CH.fund.update();
    var ft = METRICS.fundingAlignment(DATA, F).totals;
    $('#fund-note').innerHTML = '<b>' + ft.requiredFte + '</b> required · <b>' + ft.fundedFte + '</b> funded · <b>' +
      ft.assignedFte + '</b> assigned — a <b>' + ft.fundingGap + '</b> funding gap and <b>' + ft.assignmentGap +
      '</b> funded but unassigned. Three numbers usually kept in three different places.';

    // quarterly (reference)
    var qq = q.filter(function (p) { return !p.future; });
    CH.qtr.data.labels = qq.map(function (p) { return p.period + (p.partial ? ' · partial' : ''); });
    CH.qtr.data.datasets[0].data = qq.map(function (p) { return p.plannedUSD; });
    CH.qtr.data.datasets[1].data = qq.map(function (p) { return p.actualUSD; });
    CH.qtr.data.datasets[0].backgroundColor = qq.map(function (p) { return alpha(C.verd, p.partial ? .45 : 1); });
    CH.qtr.data.datasets[1].backgroundColor = qq.map(function (p) { return alpha(C.blue, p.partial ? .45 : 1); });
    CH.qtr.update();
  }
  function fund_rows(F) { return METRICS.fundingAlignment(DATA, F).rows; }

  /* ------------------------------------------------------ attention list --- */
  function renderAttention(F) {
    var items = METRICS.attentionList(DATA, F);
    var host = $('#attention-list');
    if (!items.length) { host.innerHTML = '<div class="empty-state">Nothing currently requires attention in this view.</div>'; return; }
    var h = '';
    items.forEach(function (it, i) {
      h += '<div class="att-row sev-' + it.severity + '">' +
        '<div class="att-rank">' + (i + 1) + '</div>' +
        '<div class="att-main"><div class="att-head">' +
        '<span class="att-sev sev-pill-' + it.severity + '">' + it.severity + '</span>' +
        '<span class="att-title">' + esc(it.headline) + '</span></div>' +
        '<div class="att-detail">' + esc(it.detail) + '</div>' +
        '<div class="att-owner">Owner: <b>' + esc(it.owner) + '</b></div></div>' +
        '<button class="att-go" data-idx="' + i + '">View →</button></div>';
    });
    host.innerHTML = h;
    $$('#attention-list .att-go').forEach(function (b) {
      b.onclick = function () {
        var it = items[+b.dataset.idx];
        APP.setFilters(it.filters || {});
        APP.gotoPage(it.page);
      };
    });
  }

  /* --------------------------------------------- variance + drill-through --- */
  function renderVariance(F) {
    var fv = METRICS.functionVariance(DATA, F);
    var host = $('#t-variance');
    if (!fv.rows.length) {
      host.innerHTML = '<div class="empty-state">No roles match the current filters. ' +
        '<button class="clear-all" onclick="APP.clearFilters()">Clear all filters</button></div>';
      $('#reconcile-note').innerHTML = ''; return;
    }
    var sel = F.functionName || [];
    var h = '<table class="matrix"><thead><tr><th>Function</th>' +
      '<th style="text-align:right">Plan</th><th style="text-align:right">Exited</th>' +
      '<th style="text-align:right">Planned $K</th><th style="text-align:right">Actual $K</th>' +
      '<th style="text-align:right">Attain</th><th>Status</th></tr></thead><tbody>';
    fv.rows.forEach(function (r) {
      var cls = 'clickable' + (sel.length ? (sel.indexOf(r.functionName) >= 0 ? ' selected' : ' dimmed') : '');
      h += '<tr class="' + cls + '" data-fn="' + esc(r.functionName) + '">' +
        '<td><button class="fn-drill" data-drill="' + esc(r.functionName) + '">' + esc(r.functionName) + ' ›</button></td>' +
        '<td class="num">' + r.plan + '</td><td class="num">' + r.exited + '</td>' +
        '<td class="num">' + Math.round(r.plannedK).toLocaleString() + '</td>' +
        '<td class="num">' + Math.round(r.actualK).toLocaleString() + '</td>' +
        '<td class="num">' + fmtPct(r.savingsAttainment) + '</td>' +
        '<td><span class="rag-pill rag-' + r.rag + '">' + r.rag + '</span></td></tr>';
    });
    var t = fv.totals;
    h += '<tr class="totals"><td>Total — allocated to function</td><td class="num">' + t.plan + '</td>' +
      '<td class="num">' + t.exited + '</td><td class="num">' + Math.round(t.plannedK).toLocaleString() + '</td>' +
      '<td class="num">' + Math.round(t.actualK).toLocaleString() + '</td>' +
      '<td class="num">' + fmtPct(t.savingsAttainment) + '</td>' +
      '<td><span class="rag-pill rag-' + t.rag + '">' + t.rag + '</span></td></tr>';
    if (fv.reconcileK > 1) {
      h += '<tr class="reconcile"><td colspan="3">Unallocated — target not attributed to any function</td>' +
        '<td class="num">' + Math.round(fv.reconcileK).toLocaleString() + '</td><td class="num">—</td>' +
        '<td class="num">—</td><td><span class="rag-pill" style="border:1px solid var(--amber-text);color:var(--amber-text)">Open</span></td></tr>';
    }
    host.innerHTML = h + '</tbody></table>';
    $('#reconcile-note').innerHTML = fv.reconcileK > 1
      ? '<b>Reconciliation:</b> function plans sum to <b>' + fmt$(t.plannedK * 1000) + '</b> against a <b>' +
        fmt$(fv.targetK * 1000) + '</b> commitment. The <b>' + fmt$(fv.reconcileK * 1000) +
        '</b> difference belongs to no function — either an allocation gap or an over-commitment. ' +
        'Resolve before treating the baseline as locked. ' + info('reconcile')
      : '';
    APP.bindInfoPops($('#reconcile-note'));
    $$('#t-variance tr.clickable').forEach(function (tr) {
      tr.onclick = function (e) {
        if (e.target.closest('.fn-drill')) return;
        APP.toggleFilter('functionName', tr.dataset.fn, e.ctrlKey || e.metaKey);
      };
    });
    $$('#t-variance .fn-drill').forEach(function (b) {
      b.onclick = function (e) { e.stopPropagation(); drilldown(b.dataset.drill); };
    });
  }

  // Who is falling behind inside a function, and who owns it.
  function drilldown(fnName) {
    var d = METRICS.functionDrilldown(DATA, APP.getFilters(), fnName);
    var h = '<h3>' + esc(d.functionName) + '</h3>' +
      '<div class="modal-sub">Accountable owner: <b>' + esc(d.owner) + '</b> · as of ' + APP.fmt.date(DATA.meta.asOfDate) + '</div>' +
      '<div class="drill-stats">' +
        stat(d.exited + ' / ' + d.total, 'roles exited') +
        stat(String(d.overdue), 'overdue', d.overdue ? 'bad' : '') +
        stat(String(d.ktNotStarted), 'no KT started', d.ktNotStarted ? 'warn' : '') +
        stat(fmt$(d.unrealizedUSD), 'unrealized savings', 'bad') +
        stat(fmtPct(d.attainment), 'savings attainment') +
      '</div>';
    if (!d.laggards.length) {
      h += '<div class="empty-state">Nothing in this function is currently behind. Every role is either exited or on schedule with knowledge transfer under way.</div>';
    } else {
      h += '<div class="modal-sub" style="margin:16px 0 6px"><b>' + d.laggards.length +
        ' positions falling behind</b> — these are what the owner needs to account for.</div>' +
        '<div style="max-height:340px;overflow:auto"><table class="matrix"><thead><tr>' +
        '<th>Position</th><th>Wave</th><th>Location</th><th>Target exit</th>' +
        '<th style="text-align:right">Days late</th><th>Why it is behind</th>' +
        '<th style="text-align:right">Unrealized</th></tr></thead><tbody>';
      d.laggards.forEach(function (r) {
        h += '<tr><td><b>' + esc(r.id) + '</b></td><td>' + esc(r.wave) + '</td><td>' + esc(r.location) + '</td>' +
          '<td>' + esc(r.plannedExitDate) + '</td>' +
          '<td class="num"' + (r.daysLate ? ' style="color:var(--jasper);font-weight:500"' : '') + '>' +
          (r.daysLate || '—') + '</td>' +
          '<td>' + r.reasons.map(function (x) { return '<span class="dep-chip">' + esc(x) + '</span>'; }).join(' ') + '</td>' +
          '<td class="num">' + fmt$(r.unrealizedUSD) + '</td></tr>';
      });
      h += '</tbody></table></div>';
    }
    if (d.initiatives.length) {
      h += '<div class="modal-sub" style="margin:18px 0 6px"><b>Initiatives covering this domain</b></div>' +
        '<table class="matrix"><thead><tr><th>Initiative</th><th>Owner</th><th>Due</th>' +
        '<th style="text-align:right">Resource gap</th><th>Status</th></tr></thead><tbody>';
      d.initiatives.forEach(function (i) {
        h += '<tr><td>' + esc(i.name) + (i.blocked ? ' <span class="dep-chip">has dependencies</span>' : '') + '</td>' +
          '<td>' + esc(i.owner) + '</td><td>' + esc(i.dueDate) + '</td>' +
          '<td class="num"' + (i.gap > 0 ? ' style="color:var(--jasper);font-weight:500"' : '') + '>' +
          (i.gap > 0 ? '\u2212' + i.gap : '0') + '</td>' +
          '<td><span class="rag-pill rag-' + i.rag + '">' + i.rag + '</span></td></tr>';
      });
      h += '</tbody></table>';
    }
    if (d.actions.length) {
      h += '<div class="modal-sub" style="margin:18px 0 6px"><b>' + d.openActions + ' open actions</b>' +
        (d.overdueActions ? ', <span style="color:var(--jasper)">' + d.overdueActions + ' overdue</span>' : '') + '</div>' +
        '<div style="max-height:200px;overflow:auto"><table class="matrix"><thead><tr><th>Action</th><th>Owner</th>' +
        '<th>Due</th><th>Priority</th><th>Status</th></tr></thead><tbody>';
      d.actions.forEach(function (a) {
        h += '<tr><td>' + esc(a.title) + '</td><td>' + esc(a.owner) + '</td>' +
          '<td' + (a.overdue ? ' style="color:var(--jasper);font-weight:500"' : '') + '>' + esc(a.dueDate) + '</td>' +
          '<td>' + esc(a.priority) + '</td><td>' + esc(a.status) + '</td></tr>';
      });
      h += '</tbody></table></div>';
    }
    h += '<div class="note-strip">Positions are anonymised identifiers. In production these resolve to named people ' +
      'through the roster, with access governed by the same role permissions as the rest of the tool.</div>' +
      '<div class="modal-actions">' +
      '<button class="btn-ghost" id="drill-filter">Filter dashboard to this function</button>' +
      '<button class="btn-primary" id="drill-close">Close</button></div>';
    APP.showModal(h);
    $('#drill-close').onclick = APP.closeModal;
    $('#drill-filter').onclick = function () {
      APP.closeModal();
      APP.toggleFilter('functionName', fnName, false);
    };
  }
  function stat(v, label, cls) {
    return '<div class="drill-stat"><div class="ds-v' + (cls ? ' ' + cls : '') + '">' + v + '</div>' +
      '<div class="ds-l">' + label + '</div></div>';
  }

  /* -------------------------------------------------------- workforce risk --- */
  function renderWorkforceRisk(F) {
    var cliff = METRICS.contractCliff(DATA, F);
    var cov = METRICS.roleCoverage(DATA, F);
    var vf = METRICS.vendorFootprint(DATA, F);
    var rows = [];
    cliff.byDomain.forEach(function (d) {
      rows.push({ sev: d.count >= 5 ? 'Red' : 'Amber', type: 'Contract expiry',
        subject: d.domain, detail: d.count + ' non-FTE contracts end within ' + cliff.windowDays + ' days',
        owner: 'Vendor Management Lead', n: d.count });
    });
    cov.critical.forEach(function (c) {
      rows.push({ sev: c.singlePoint ? 'Red' : 'Amber', type: c.singlePoint ? 'Single point of failure' : 'Thin cover',
        subject: c.capability, detail: c.headcount + ' person' + (c.headcount === 1 ? '' : 's') +
          ' across ' + c.teamCount + ' team' + (c.teamCount === 1 ? '' : 's'),
        owner: 'Workforce Lead', n: 10 - c.headcount });
    });
    vf.fragmentedTeams.forEach(function (t) {
      rows.push({ sev: 'Amber', type: 'Vendor fragmentation', subject: t.team,
        detail: t.vendorCount + ' vendors supplying one team (' + t.vendors.join(', ') + ')',
        owner: 'Vendor Management Lead', n: t.vendorCount });
    });
    if (!rows.length) { $('#t-wfrisk').innerHTML = '<div class="empty-state">No workforce risks flagged in this view.</div>'; return; }
    var order = { Red: 0, Amber: 1, Green: 2 };
    rows.sort(function (a, b) { return order[a.sev] - order[b.sev] || b.n - a.n; });
    var h = '<table class="matrix"><thead><tr><th>Risk</th><th>Where</th><th>Detail</th><th>Owner</th><th>Severity</th></tr></thead><tbody>';
    rows.forEach(function (r) {
      h += '<tr><td><b>' + esc(r.type) + '</b></td><td>' + esc(r.subject) + '</td>' +
        '<td style="color:var(--muted)">' + esc(r.detail) + '</td><td>' + esc(r.owner) + '</td>' +
        '<td><span class="rag-pill rag-' + r.sev + '">' + (r.sev === 'Red' ? 'High' : 'Medium') + '</span></td></tr>';
    });
    $('#t-wfrisk').innerHTML = h + '</tbody></table>';
  }

  function renderCoverage(F) {
    var cov = METRICS.roleCoverage(DATA, F);
    if (!cov.rows.length) { $('#t-coverage').innerHTML = '<div class="empty-state">No workforce matches the current filters.</div>'; return; }
    var h = '<table class="matrix"><thead><tr><th>Capability</th><th style="text-align:right">People</th>' +
      '<th style="text-align:right">FTE</th><th style="text-align:right">Teams</th>' +
      '<th style="text-align:right">Domains</th><th>Cover</th></tr></thead><tbody>';
    cov.rows.forEach(function (r) {
      var flag = r.singlePoint ? '<span class="rag-pill rag-Red">Single point of failure</span>'
               : r.critical ? '<span class="rag-pill rag-Amber">Critical — thin cover</span>'
               : r.duplicated ? '<span class="rag-pill rag-Amber">Spread across many teams</span>'
               : '<span class="rag-pill rag-Green">Covered</span>';
      h += '<tr class="clickable" data-cap="' + esc(r.capability) + '"><td>' + esc(r.capability) + '</td>' +
        '<td class="num">' + r.headcount + '</td><td class="num">' + r.fte + '</td>' +
        '<td class="num">' + r.teamCount + '</td><td class="num">' + r.domainCount + '</td><td>' + flag + '</td></tr>';
    });
    $('#t-coverage').innerHTML = h + '</tbody></table>';
    $$('#t-coverage tr.clickable').forEach(function (tr) {
      tr.onclick = function (e) { APP.toggleFilter('capability', tr.dataset.cap, e.ctrlKey || e.metaKey); };
    });
  }

  /* ------------------------------------------------ function accountability --- */
  function renderAccountability(F) {
    var acc = METRICS.functionAccountability(DATA, F);
    var host = $('#t-accountability');
    if (!acc.rows.length) { host.innerHTML = '<div class="empty-state">No functions match the current filters.</div>'; return; }
    var h = '<table class="matrix"><thead><tr><th>Function</th><th>Accountable owner</th>' +
      '<th style="text-align:right">Roles behind</th><th style="text-align:right">Unrealized</th>' +
      '<th style="text-align:right">Attain</th><th style="text-align:right">Open actions</th>' +
      '<th>Status</th></tr></thead><tbody>';
    acc.rows.forEach(function (f) {
      h += '<tr class="clickable" data-fn="' + esc(f.functionName) + '">' +
        '<td><button class="fn-drill" data-drill="' + esc(f.functionName) + '">' + esc(f.functionName) + ' \u203a</button></td>' +
        '<td>' + esc(f.owner) + '</td>' +
        '<td class="num"' + (f.behind ? ' style="color:var(--jasper);font-weight:500"' : '') + '>' + f.behind + '</td>' +
        '<td class="num">' + fmt$(f.unrealizedUSD) + '</td>' +
        '<td class="num">' + fmtPct(f.attainment) + '</td>' +
        '<td class="num">' + f.openActions + (f.overdueActions ? ' <span style="color:var(--jasper)">(' + f.overdueActions + ' overdue)</span>' : '') + '</td>' +
        '<td><span class="rag-pill rag-' + f.rag + '">' + f.rag + '</span></td></tr>';
    });
    host.innerHTML = h + '</tbody></table>';
    $$('#t-accountability tr.clickable').forEach(function (tr) {
      tr.onclick = function (e) {
        if (e.target.closest('.fn-drill')) return;
        APP.toggleFilter('functionName', tr.dataset.fn, e.ctrlKey || e.metaKey);
      };
    });
    $$('#t-accountability .fn-drill').forEach(function (b) {
      b.onclick = function (e) { e.stopPropagation(); drilldown(b.dataset.drill); };
    });
  }

  /* ------------------------------------------------------ definition check --- */
  function renderDefinition(mix) {
    function blk(label, v, on) {
      return '<div class="def-block' + (on ? ' headline' : '') + '">' +
        '<div class="def-label">' + label + (on ? ' <span class="def-tag">in use</span>' : '') + '</div>' +
        '<div class="def-value">' + p1(v.ratio) + '</div>' +
        '<div class="def-sub">' + v.fte + ' FTE of ' + v.total + ' · ' +
        (v.gapHeads > 0 ? '<span class="bad">' + v.gapHeads + ' short</span>'
                        : '<span class="good">' + Math.abs(v.gapHeads) + ' clear</span>') + '</div></div>';
    }
    var on = DATA.policy.bpoHubCountsAsNonFte;
    $('#def-check').innerHTML =
      blk('BPO Hub counted as non-FTE', mix.inclHub, on) +
      blk('BPO Hub excluded', mix.exclHub, !on) +
      '<div class="def-note">One reading says <b>' + (mix.inclHub.onTarget ? 'on' : 'off') +
      '</b> target, the other <b>' + (mix.exclHub.onTarget ? 'on' : 'off') + '</b>. Nothing about the people changed. ' +
      'The switch lives on the Reference tab.</div>';
  }

  /* ---------------------------------------------------------- decisions --- */
  function renderTriggers(ih) {
    if (!ih.triggers.length) { $('#t-triggers').innerHTML = '<div class="empty-state">No trigger points defined for this selection.</div>'; return; }
    var h = '<div class="trigger-grid">';
    ih.triggers.forEach(function (t) {
      h += '<div class="trigger-card rag-border-' + t.rag + '">' +
        '<div class="trigger-metric">' + esc(t.triggerPoint.metric) + '</div>' +
        '<div class="trigger-threshold">Fires when <b>' + esc(t.triggerPoint.threshold) + '</b></div>' +
        '<div class="trigger-action">→ ' + esc(t.triggerPoint.action) + '</div>' +
        '<div class="trigger-owner">' + esc(t.id) + ' · ' + esc(t.owner) + '</div></div>';
    });
    $('#t-triggers').innerHTML = h + '</div>';
  }

  function renderInitiatives(ih) {
    if (!ih.rows.length) { $('#t-initiatives').innerHTML = '<div class="empty-state">No initiatives match the current filters.</div>'; return; }
    var h = '<table class="matrix"><thead><tr><th>Initiative</th><th>Owner</th><th>Due</th>' +
      '<th style="text-align:right">Need</th><th style="text-align:right">Have</th><th style="text-align:right">Gap</th>' +
      '<th>Depends on</th><th>Status</th></tr></thead><tbody>';
    ih.rows.forEach(function (r) {
      var dep = r.dependsOn.length ? r.dependsOn.map(function (d) {
        return '<span class="dep-chip' + (r.blockers.indexOf(d) >= 0 ? ' blocked' : '') + '">' + esc(d) + '</span>';
      }).join(' ') : '<span style="color:var(--muted)">—</span>';
      h += '<tr class="clickable" data-domain="' + esc(r.domain) + '"><td>' + esc(r.name) +
        (r.atRiskFromDependency ? ' <span class="rag-pill rag-Red">Blocked</span>' : '') + '</td>' +
        '<td>' + esc(r.owner) + '</td><td>' + esc(r.dueDate) + '</td>' +
        '<td class="num">' + r.requiredHeadcount + '</td><td class="num">' + r.assignedHeadcount + '</td>' +
        '<td class="num"' + (r.resourceGap > 0 ? ' style="color:var(--jasper);font-weight:500"' : '') + '>' +
        (r.resourceGap > 0 ? '−' + r.resourceGap : '0') + '</td>' +
        '<td>' + dep + '</td><td><span class="rag-pill rag-' + r.rag + '">' + r.rag + '</span></td></tr>';
    });
    $('#t-initiatives').innerHTML = h + '</tbody></table>';
    $$('#t-initiatives tr.clickable').forEach(function (tr) {
      tr.onclick = function (e) { APP.toggleFilter('domain', tr.dataset.domain, e.ctrlKey || e.metaKey); };
    });
  }

  function renderNotes(an) {
    if (!an.flagged.length) { $('#notes-out').innerHTML = '<div class="empty-state">No risk signals found in the current notes.</div>'; return; }
    var h = '<div class="theme-row">';
    an.themes.forEach(function (t) { h += '<span class="theme-chip">' + esc(t.theme) + ' <b>' + t.n + '</b></span>'; });
    h += '</div><table class="matrix"><thead><tr><th>Action</th><th>Owner</th><th>Signals</th><th>Severity</th></tr></thead><tbody>';
    an.flagged.slice(0, 10).forEach(function (f) {
      var sev = f.severity === 'High' ? 'Red' : f.severity === 'Medium' ? 'Amber' : 'Green';
      h += '<tr><td><b>' + esc(f.title) + '</b><div style="color:var(--muted);font-size:11px;margin-top:2px">' +
        esc(f.note.slice(0, 130)) + (f.note.length > 130 ? '…' : '') + '</div></td><td>' + esc(f.owner) + '</td>' +
        '<td>' + f.themes.map(function (t) { return '<span class="dep-chip">' + esc(t.theme) + '</span>'; }).join(' ') + '</td>' +
        '<td><span class="rag-pill rag-' + sev + '">' + f.severity + '</span></td></tr>';
    });
    $('#notes-out').innerHTML = h + '</tbody></table>';
  }

  /* ---------------------------------------------------------- reference --- */
  function renderWaves(F) {
    var waves = METRICS.byWave(DATA, F);
    var h = '<table class="matrix"><thead><tr><th>Wave</th><th style="text-align:right">Planned</th>' +
      '<th style="text-align:right">Exited</th><th style="text-align:right">Overdue</th>' +
      '<th style="text-align:right">Attainment</th></tr></thead><tbody>';
    waves.forEach(function (w) {
      h += '<tr class="clickable" data-wave="' + w.wave + '"><td>' + esc(w.label) + '</td>' +
        '<td class="num">' + w.planned + '</td><td class="num">' + w.actual + '</td>' +
        '<td class="num"' + (w.overdue ? ' style="color:var(--jasper)"' : '') + '>' + w.overdue + '</td>' +
        '<td class="num">' + (w.planned ? Math.round(w.actual / w.planned * 100) : 0) + '%</td></tr>';
    });
    $('#t-waves').innerHTML = h + '</tbody></table>';
    $$('#t-waves tr.clickable').forEach(function (tr) {
      tr.onclick = function (e) { APP.toggleFilter('wave', tr.dataset.wave, e.ctrlKey || e.metaKey); };
    });
  }

  function renderPolicy() {
    var p = DATA.policy;
    var rows = [
      ['bpoHubCountsAsNonFte', 'BPO Hub counts as non-FTE', 'toggle',
       'Decides whether transferred roles count against the 70/30 target. Reverses the headline conclusion and the forecast direction.'],
      ['fteTargetRatio', 'FTE target ratio', 'pct', 'The committed FTE share of the workforce.'],
      ['coverageCriticalThreshold', 'Critical coverage threshold', 'int',
       'A capability with this many people or fewer is flagged as thin cover.'],
      ['contractCliffDays', 'Contract cliff window (days)', 'int', 'How far ahead to look for contracts ending.'],
      ['vendorConcentrationThreshold', 'Vendor concentration threshold', 'int',
       'Distinct vendors inside one team before it is flagged as fragmented.']
    ];
    var h = '<div class="switch-grid">';
    rows.forEach(function (r) {
      var key = r[0], ctrl;
      if (r[2] === 'toggle') {
        ctrl = '<button class="switch' + (p[key] ? ' on' : '') + '" data-policy="' + key + '" data-kind="toggle" ' +
          'role="switch" aria-checked="' + (!!p[key]) + '"><span class="knob"></span></button>' +
          '<span class="switch-state">' + (p[key] ? 'Yes' : 'No') + '</span>';
      } else if (r[2] === 'pct') {
        ctrl = '<input type="range" min="50" max="90" value="' + Math.round(p[key] * 100) + '" data-policy="' + key +
          '" data-kind="pct"><span class="switch-state">' + Math.round(p[key] * 100) + '%</span>';
      } else {
        ctrl = '<input type="range" min="1" max="' + (key === 'contractCliffDays' ? 180 : 10) + '" value="' + p[key] +
          '" data-policy="' + key + '" data-kind="int"><span class="switch-state">' + p[key] + '</span>';
      }
      h += '<div class="switch-row"><div class="switch-label"><b>' + esc(r[1]) + '</b><span>' + esc(r[3]) +
        '</span></div><div class="switch-control">' + ctrl + '</div></div>';
    });
    $('#policy-switches').innerHTML = h + '</div>';
    $$('#policy-switches [data-policy]').forEach(function (el) {
      var key = el.dataset.policy, kind = el.dataset.kind;
      if (kind === 'toggle') {
        el.onclick = function () { DATA.policy[key] = !DATA.policy[key]; APP.updateAll(); APP.toast('Definition changed — every tab recalculated'); };
      } else {
        el.oninput = function () {
          DATA.policy[key] = kind === 'pct' ? (+el.value / 100) : +el.value;
          el.parentNode.querySelector('.switch-state').textContent = kind === 'pct' ? el.value + '%' : el.value;
          APP.updateAll();
        };
      }
    });
  }

  function renderDictionary(F) {
    var k = METRICS.kpis(DATA, F), mix = METRICS.workforceMix(DATA, F);
    var w = METRICS.wftSummary(DATA), cov = METRICS.roleCoverage(DATA, F);
    var cc = METRICS.costConcentration(DATA, F), acc = METRICS.functionAccountability(DATA, F);
    // metric · appears on · definition · formula · source · owner · current value
    var D = [
      ['Rolloff Attainment', 'Brief', 'Exits achieved against the time-phased plan, not the full programme',
       'exited \u00f7 planned-to-date', 'Weekly BPO Hub file', 'Transition Lead', fmtPct(k.rolloffAttainment)],
      ['Savings Realized', 'Brief · Savings & Delivery', 'Savings recognised when the onshore role exits and its cost stops',
       '\u03a3 realized savings on exited basis', 'Weekly file + Finance', 'Finance Lead', fmtM(k.realizedUSD)],
      ['YTD Variance', 'Savings & Delivery', 'How far realized savings sit behind the time-phased plan',
       'realized \u2212 plan-to-date', 'Derived', 'Finance Lead', fmt$(k.varianceUSD)],
      ['Realization Rate', 'Brief · Savings & Delivery', 'The share of planned savings that actually converts to realized savings',
       'trailing 2 completed quarters: actual \u00f7 planned', 'Derived', 'Finance Lead', fmtPct(k.realizationRate)],
      ['Projected Year-End', 'Brief · Savings & Delivery', 'Pace-adjusted single-point projection of full-year savings',
       'YTD actual + (remaining pipeline \u00d7 realization rate)', 'Derived', 'Finance Lead', fmtM(k.projectedYearEndUSD)],
      ['Gap to Target', 'Brief', 'Projected shortfall against the leadership baseline commitment',
       'projection \u2212 target', 'Derived', 'Finance Lead', fmt$(k.gapToTargetUSD)],
      ['Overdue Rolloffs', 'Brief · Savings & Delivery', 'Roles past their target exit date and not yet exited',
       'count(planned exit < as-of and not exited)', 'Weekly BPO Hub file', 'Transition Lead', k.overdue + ' roles'],
      ['Cost Leakage', 'Savings & Delivery', 'Onshore cost still being carried past target exit dates',
       'overdue roles \u00d7 daily onshore cost \u00d7 days late', 'Derived \u2014 <b>method not yet ratified</b>', 'Finance Lead', fmt$(k.leakageUSD)],
      ['Cost Concentration', 'Savings & Delivery', 'How few functions carry the majority of annualised onshore cost',
       'function cost \u00f7 total, ranked cumulatively', 'Roster + contracted rates', 'Finance Lead',
       cc.functionsForHalf + ' functions = 50%'],
      ['Delivery Readiness', 'Savings & Delivery', 'Share of a wave with no knowledge transfer started',
       'KT not started \u00f7 roles in wave', 'Weekly BPO Hub file', 'Delivery Lead \u2014 BPO Hub', 'by wave'],
      ['FTE Share', 'Brief · Workforce · Planning', 'FTE as a proportion of the total workforce',
       'FTE \u00f7 (FTE + non-FTE)', 'Roster + contracting register', 'Workforce Lead', p1(mix.headline.ratio)],
      ['Gap to 70 / 30', 'Workforce', 'Additional FTE needed to reach the committed ratio',
       '(total \u00d7 target ratio) \u2212 FTE', 'Derived', 'Workforce Lead', mix.headline.gapHeads + ' people'],
      ['Contract Cliff', 'Workforce', 'Non-FTE positions whose contract ends inside the policy window',
       'count(end date within N days)', 'Contracting register', 'Vendor Management Lead',
       METRICS.contractCliff(DATA, F).count + ' positions'],
      ['Single Points of Failure', 'Workforce · Planning', 'Capabilities held by exactly one person',
       'count(capabilities where headcount = 1)', 'Roster', 'Domain Leads', cov.singlePoints.length + ' capabilities'],
      ['Forecast FTE Share', 'Planning', 'Projected FTE proportion at the end of the forecast horizon',
       'forecast FTE \u00f7 forecast total', 'WFT forecast', 'Workforce Lead', p1(w.ratioEnd)],
      ['Funding Gap', 'Planning', 'Required positions that carry no funding',
       'required \u2212 funded', 'Planning submission', 'Program Management Lead',
       METRICS.fundingAlignment(DATA, F).totals.fundingGap + ' positions'],
      ['Unfunded Positions', 'Planning', 'Positions on the roster with no funding source attached',
       'count(funding source = Unfunded)', 'Roster + finance', 'Program Management Lead',
       METRICS.fundingAlignment(DATA, F).unfundedPositions + ' positions'],
      ['Initiative Resource Gap', 'Decisions', 'People short across every in-flight initiative',
       '\u03a3 max(0, required \u2212 assigned)', 'Initiative register', 'Program Management Lead',
       METRICS.initiativeHealth(DATA, F).totalGap + ' people'],
      ['Overdue Actions', 'Decisions', 'Commitments past their due date and not closed',
       'count(due < as-of and status \u2260 Done)', 'Action register', 'Program Management Lead',
       METRICS.actionStats(DATA, F).overdue + ' items'],
      ['Unrealized Savings', 'Decisions', 'Planned savings not yet realized, summed across functions with a shortfall',
       '\u03a3 max(0, planned \u2212 realized) by function', 'Derived', 'Finance Lead', fmt$(acc.totalUnrealizedUSD)]
    ];
    var h = '<table class="matrix dict"><thead><tr><th>Metric</th><th>Appears on</th><th>Definition</th>' +
      '<th>Formula</th><th>Pulled from</th><th>Owner</th><th style="text-align:right">Current value</th>' +
      '</tr></thead><tbody>';
    D.forEach(function (d) {
      h += '<tr><td><b>' + esc(d[0]) + '</b></td>' +
        '<td>' + d[1].split(' \u00b7 ').map(function (t) { return '<span class="dep-chip">' + esc(t) + '</span>'; }).join(' ') + '</td>' +
        '<td>' + esc(d[2]) + '</td>' +
        '<td style="color:var(--muted)">' + d[3] + '</td><td>' + d[4] + '</td><td>' + esc(d[5]) + '</td>' +
        '<td class="num" style="font-weight:500;color:var(--aberdeen-blue)">' + d[6] + '</td></tr>';
    });
    $('#t-dictionary').innerHTML = h + '</tbody></table>';
  }

  function renderIntegrationMap() {
    var cols = [
      ['Sources', ['HRIS', 'Finance / GL', 'Vendor systems', 'Contracting register', 'Smartsheet trackers']],
      ['Governed backend', ['SharePoint / OneLake landing', 'Bronze → Silver → Gold', 'Certified semantic model']],
      ['Front ends', ['This tracker', 'Power BI reporting', 'Jira delivery', 'Engineering tooling', '2027 CT / EBC submission']]
    ];
    var h = '<div class="int-flow">';
    cols.forEach(function (col, i) {
      h += '<div class="int-col"><div class="int-col-head">' + esc(col[0]) + '</div>';
      col[1].forEach(function (n) { h += '<div class="int-node' + (i === 1 ? ' core' : '') + '">' + esc(n) + '</div>'; });
      h += '</div>' + (i < 2 ? '<div class="int-arrow">→</div>' : '');
    });
    $('#int-map').innerHTML = h + '</div><div class="chart-note">One certified metric layer in the middle is what stops ' +
      'the dashboard, the delivery tracker and the board submission quoting three different numbers.</div>';
  }

  function renderIntegrationStatus() {
    var rows = [
      ['Weekly Excel upload', 'Live today', 'Green'],
      ['EBC / 2027 CT export', 'Live today', 'Green'],
      ['Jira action export', 'Live today', 'Green'],
      ['SharePoint scheduled pickup', 'Planned — phase 2', 'Amber'],
      ['Fabric semantic model', 'Planned — phase 2', 'Amber'],
      ['Jira two-way sync', 'Planned — phase 3', 'Amber'],
      ['Source system feeds', 'Planned — phase 3', 'Amber']
    ];
    var h = '<table class="matrix"><thead><tr><th>Connection</th><th>Status</th></tr></thead><tbody>';
    rows.forEach(function (r) {
      h += '<tr><td>' + esc(r[0]) + '</td><td><span class="rag-pill rag-' + r[2] + '">' + esc(r[1]) + '</span></td></tr>';
    });
    $('#t-integrations').innerHTML = h + '</tbody></table>';
  }

  /* --------------------------------------------- simplified scenario work --- */
  function buildScenario() {
    $('#scen-body').innerHTML =
      '<div class="scen-presets" id="scen-presets"></div>' +
      '<div class="scen-primary"><label for="scen-rate">Realization rate — the share of planned savings that actually lands' +
      '<b id="scen-rate-val">72%</b></label>' +
      '<input type="range" id="scen-rate" min="50" max="100" value="72"></div>' +
      '<details class="scen-adv"><summary>Advanced levers</summary><div class="scen-adv-grid" id="scen-adv"></div></details>' +
      '<div class="scen-out-row" id="scen-out"></div>' +
      '<div class="sensitivity" id="sens-note"></div>' +
      '<div class="scen-tools"><button class="btn-ghost" id="scen-reset">Reset to defaults</button></div>' +
      '<div class="panel-sub"><div class="panel-head" style="margin-top:6px"><div class="titles">' +
      '<h3 style="font-size:13px">Can we staff it?</h3>' +
      '<div class="caption">Capability demand against uncommitted capacity only</div></div>' +
      info('scenResources') + '</div><div id="scen-resources"></div></div>';

    var ADV = [
      ['pace', 'Exit pace vs. plan', 60, 120, '%'],
      ['delay', 'Average rolloff delay', 0, 30, 'd'],
      ['ramp', 'BPO Hub ramp time', 2, 12, 'w'],
      ['attr', 'Attrition / backfill adder', 0, 300, 'K']
    ];
    var S = APP.SCEN().base;
    $('#scen-adv').innerHTML = ADV.map(function (a) {
      return '<div class="slider-row"><label><span>' + a[1] + '</span><b id="sv-' + a[0] + '">' + S[a[0]] + a[4] +
        '</b></label><input type="range" min="' + a[2] + '" max="' + a[3] + '" value="' + S[a[0]] +
        '" data-lever="' + a[0] + '" data-unit="' + a[4] + '"></div>';
    }).join('');

    $('#scen-presets').innerHTML = ['up', 'base', 'down'].map(function (key) {
      var d = APP.SCEN_DEFAULTS[key];
      return '<button class="scen-chip' + (key === 'base' ? ' active' : '') + '" data-preset="' + key + '">' +
        '<b>' + esc(d.name) + '</b><span>' + esc(d.basis) + ' · ' + d.rate + '%</span></button>';
    }).join('');

    $('#scen-rate').oninput = function () {
      APP.SCEN().base.rate = +this.value;
      $('#scen-rate-val').textContent = this.value + '%';
      $$('#scen-presets .scen-chip').forEach(function (c) {
        c.classList.toggle('active', APP.SCEN_DEFAULTS[c.dataset.preset].rate === +$('#scen-rate').value);
      });
      liveScenario();
    };
    $$('#scen-presets .scen-chip').forEach(function (c) {
      c.onclick = function () {
        var d = APP.SCEN_DEFAULTS[c.dataset.preset];
        APP.SCEN().base.rate = d.rate;
        $('#scen-rate').value = d.rate; $('#scen-rate-val').textContent = d.rate + '%';
        $$('#scen-presets .scen-chip').forEach(function (x) { x.classList.toggle('active', x === c); });
        liveScenario();
      };
    });
    $$('#scen-adv input').forEach(function (r) {
      r.oninput = function () {
        APP.SCEN().base[r.dataset.lever] = +r.value;
        $('#sv-' + r.dataset.lever).textContent = r.value + r.dataset.unit;
        liveScenario();
      };
    });
    $('#scen-reset').onclick = function () {
      APP.resetScenarios();
      var b = APP.SCEN().base;
      $('#scen-rate').value = b.rate; $('#scen-rate-val').textContent = b.rate + '%';
      ADV.forEach(function (a) {
        var el = $('#scen-adv input[data-lever="' + a[0] + '"]');
        el.value = b[a[0]]; $('#sv-' + a[0]).textContent = b[a[0]] + a[4];
      });
      $$('#scen-presets .scen-chip').forEach(function (x) { x.classList.toggle('active', x.dataset.preset === 'base'); });
      APP.updateAll();
      APP.toast('Scenario reset to the programme default');
    };
  }

  function liveScenario() {
    var F = APP.getFilters();
    renderScenario(F);
    var r = APP.scenarioResult('base');
    APP.setScenarioNote('Scenario modelling: at ' + APP.SCEN().base.rate + '% realization, year-end reaches <b>' +
      fmtM(r.projectedYearEndUSD) + '</b> (' + fmt$(r.gapToTargetUSD) + ' vs. target).');
    storylines(F);
  }

  function renderScenario(F) {
    var k = METRICS.kpis(DATA, F);
    function outCard(name, sub, r, cls) {
      return '<div class="scen-out' + (cls || '') + '">' +
        '<div class="so-name">' + esc(name) + ' <span>' + esc(sub) + '</span></div>' +
        '<div class="so-ye">' + fmtM(r.projectedYearEndUSD) + '</div>' +
        '<div class="so-gap" style="color:' + (r.gapToTargetUSD >= 0 ? 'var(--jade)' : 'var(--jasper)') + '">' +
        fmt$(r.gapToTargetUSD) + ' vs. target</div>' +
        '<span class="rag-pill rag-' + r.rag + '">' + r.rag + '</span></div>';
    }
    // The three references come from the programme's own history and never move.
    // "Your scenario" is the only thing the sliders change.
    var ref = ['up', 'base', 'down'].map(function (key) {
      var d = APP.SCEN_DEFAULTS[key];
      return outCard(d.name, d.rate + '% · ' + d.basis, APP.referenceResult(key));
    }).join('');
    var mine = APP.scenarioResult('base');
    $('#scen-out').innerHTML =
      '<div class="scen-ref-label">Reference — the programme’s own history</div>' + ref +
      '<div class="scen-ref-label mine">You are modelling</div>' +
      outCard('Your scenario', APP.SCEN().base.rate + '% realization', mine, ' primary');

    // highest-leverage lever, computed live against what you are modelling
    var base = mine.projectedYearEndUSD;
    var S = APP.SCEN().base;
    function probe(over) {
      var m = Object.assign({}, S, over);
      return METRICS.scenario(DATA, F, { realizationRate: m.rate / 100, exitPacePct: m.pace / 100,
        delayDays: m.delay, rampWeeks: m.ramp, attritionAdderUSD: m.attr * 1000 }).projectedYearEndUSD - base;
    }
    var probes = [
      { label: 'A 5-point improvement in realization', gain: probe({ rate: S.rate + 5 }) },
      { label: 'A 10-point acceleration in exit pace', gain: probe({ pace: S.pace + 10 }) },
      { label: 'Cutting average delay by 5 days', gain: probe({ delay: Math.max(0, S.delay - 5) }) }
    ].sort(function (a, b) { return b.gain - a.gain; });
    $('#sens-note').innerHTML = '<b>' + probes[0].label + '</b> is worth <b>' + fmt$(probes[0].gain) +
      '</b> at year-end — the highest-leverage lever available. No scenario shown reaches the ' +
      fmtM(k.targetUSD) + ' commitment.';

    // resourcing
    var sr = METRICS.scenarioResources(DATA, F, { exitPacePct: S.pace / 100 });
    var host = $('#scen-resources');
    if (!sr.rows.length) { host.innerHTML = '<div class="empty-state">No initiatives in scope.</div>'; return; }
    var h = '<table class="matrix"><thead><tr><th>Capability</th><th style="text-align:right">Required</th>' +
      '<th style="text-align:right">Uncommitted</th><th style="text-align:right">Gap</th></tr></thead><tbody>';
    sr.rows.slice(0, 6).forEach(function (r) {
      h += '<tr class="clickable" data-cap="' + esc(r.capability) + '"><td>' + esc(r.capability) + '</td>' +
        '<td class="num">' + r.requiredHeadcount + '</td><td class="num">' + r.availableHeadcount + '</td>' +
        '<td class="num"' + (r.gap > 0 ? ' style="color:var(--jasper);font-weight:500"' : '') + '>' +
        (r.gap > 0 ? '−' + r.gap : '0') + '</td></tr>';
    });
    h += '</tbody></table><div class="chart-note">This scenario is <b>' + sr.totalGap + ' people short</b> across <b>' +
      sr.shortfalls.length + '</b> capabilities, with <b>' + sr.uncommitted + '</b> uncommitted positions available.</div>';
    host.innerHTML = h;
    $$('#scen-resources tr.clickable').forEach(function (tr) {
      tr.onclick = function (e) { APP.toggleFilter('capability', tr.dataset.cap, e.ctrlKey || e.metaKey); };
    });
  }

  /* ----------------------------------------------------------- storyline --- */
  function storylineText(page) {
    var F = APP.getFilters();
    var k = METRICS.kpis(DATA, F);
    if (k.inScope === 0 && page < 3) return 'No roles match the current filters — clear a filter to restore the narrative.';
    var mix = METRICS.workforceMix(DATA, F);
    var att = METRICS.attentionList(DATA, F);
    var s = [];
    var pre = k.filtered ? 'Filtered view — figures reflect the current selection. ' : '';

    if (page === 1) {
      s.push('<b>' + k.exited + ' of ' + k.inScope + '</b> conversions have exited (<b>' + fmtPct(k.rolloffAttainment) +
        '</b> of plan-to-date), but only <b>' + fmtM(k.realizedUSD) + ' of ' + fmtM(k.planToDateUSD) +
        '</b> in savings has landed — <b>' + Math.round(k.behindPct * 100) + '% behind</b>.');
      s.push('At the current <b>' + fmtPct(k.realizationRate) + '</b> realization rate, year-end reaches <b>' +
        fmtM(k.projectedYearEndUSD) + '</b> against the <b>' + fmtM(k.targetUSD) + '</b> commitment — a <b>' +
        fmt$(Math.abs(k.gapToTargetUSD)) + '</b> shortfall.');
      s.push('The workforce sits at <b>' + p1(mix.headline.ratio) + '</b> FTE against a <b>' +
        fmtPct(mix.headline.targetRatio) + '</b> target, <b>' + Math.abs(mix.headline.gapHeads) + ' people</b> ' +
        (mix.headline.gapHeads > 0 ? 'short' : 'clear') + '.');
      if (att.length) {
        var crit = att.filter(function (a) { return a.severity === 'Critical'; });
        s.push('<b>' + att.length + ' items</b> need attention' + (crit.length ? ', <b>' + crit.length + '</b> of them critical' : '') +
          ' — the largest is <b>' + esc(att[0].headline) + '</b>, owned by ' + esc(att[0].owner) + '.');
      }
      if (APP.scenarioNote()) s.push(APP.scenarioNote());
    } else if (page === 2) {
      var drivers = METRICS.driversOfGap(DATA, F, 3);
      var cc = METRICS.costConcentration(DATA, F);
      var od = METRICS.overdueDetail(DATA, F);
      s.push('Savings are <b>' + Math.round(k.behindPct * 100) + '% behind</b> plan-to-date at <b>' +
        fmtM(k.realizedUSD) + '</b>, and the gap is concentrated rather than spread.');
      if (drivers.length) {
        s.push('Three functions carry most of it: ' + drivers.map(function (d) {
          return '<b>' + esc(d.name) + '</b> (' + fmt$(d.gapUSD) + ')'; }).join(', ') + '.');
      }
      s.push('Cost is equally concentrated — the top <b>' + cc.functionsForHalf + ' of ' + cc.rows.length +
        ' functions</b> carry half the ' + fmtM(cc.totalUSD) + ' annualised onshore cost.');
      if (od.count) {
        s.push('<b>' + od.count + ' rolloffs</b> are overdue at an average of <b>' + od.avgDelayDays +
          ' days</b>, costing roughly <b>' + fmt$(od.estMonthlyRunRateUSD) + ' a month</b> while they stay open.');
      }
      var kw = METRICS.ktByWave(DATA, F).filter(function (w) { return w.total; })
        .sort(function (a, b) { return b.exposure - a.exposure; })[0];
      if (kw && kw.exposure > 0.5) {
        s.push('Recommended action: <b>' + esc(kw.label) + '</b> has <b>' + Math.round(kw.exposure * 100) +
          '%</b> of roles with no knowledge transfer started — address that before it becomes a service failure.');
      }
    } else if (page === 3) {
      var cliff = METRICS.contractCliff(DATA, F);
      var cov = METRICS.roleCoverage(DATA, F);
      var vf = METRICS.vendorFootprint(DATA, F);
      s.push('The workforce is <b>' + mix.total + ' positions</b>, <b>' + p1(mix.headline.ratio) +
        '</b> FTE against a <b>' + fmtPct(mix.headline.targetRatio) + '</b> target — <b>' +
        Math.abs(mix.headline.gapHeads) + '</b> people ' + (mix.headline.gapHeads > 0 ? 'short' : 'clear') +
        '. On the alternate definition it reads <b>' + p1(mix.alternate.ratio) + '</b>, which is why the ' +
        'definition needs an owner rather than a default.');
      if (cliff.count) s.push('<b>' + cliff.count + ' contracts</b> worth <b>' + fmt$(cliff.annualCostUSD) +
        '</b> annualised end within ' + cliff.windowDays + ' days — shorter than typical procurement lead time.');
      if (cov.singlePoints.length) s.push('<b>' + cov.singlePoints.length + ' capabilities</b> rest on one person: ' +
        cov.singlePoints.map(function (r) { return esc(r.capability); }).join(', ') + '.');
      if (vf.fragmentedTeams.length) s.push('<b>' + vf.fragmentedTeams.length + ' team(s)</b> carry ' +
        DATA.policy.vendorConcentrationThreshold + ' or more vendors, adding coordination and contract overhead.');
      s.push('Recommended action: cross-train the single-point capabilities before the contract cliff lands.');
    } else if (page === 4) {
      var w = METRICS.wftSummary(DATA);
      var fund = METRICS.fundingAlignment(DATA, F);
      s.push('FTE share moves from <b>' + p1(w.ratioNow) + '</b> today to <b>' + p1(w.ratioEnd) + '</b> by <b>' +
        w.yearEnd.month + '</b> — ' + (w.reachesTarget ? 'reaching' : '<b>not reaching</b>') + ' the ' +
        fmtPct(DATA.policy.fteTargetRatio) + ' target, on a net headcount change of <b>' +
        (w.headcountDelta >= 0 ? '+' : '') + w.headcountDelta + '</b> over ' + w.forecastMonths + ' forecast months.');
      if (w.direction < 0) {
        s.push('The trajectory moves <b>away</b> from target because every role transferred to the BPO Hub counts ' +
          'as non-FTE. The transition and the 70/30 commitment pull against each other and need reconciling.');
      }
      s.push('Across the plan, <b>' + fund.totals.requiredFte + '</b> positions are required, <b>' +
        fund.totals.fundedFte + '</b> funded and <b>' + fund.totals.assignedFte + '</b> assigned — a <b>' +
        fund.totals.fundingGap + '</b> funding gap and <b>' + fund.totals.assignmentGap + '</b> funded but unassigned.');
      s.push('Recommended action: carry the <b>' + fund.unfundedPositions + '</b> unfunded positions into the ' +
        DATA.policy.planningCycle + ' submission, or they disappear from the plan entirely.');
    } else if (page === 5) {
      var ih = METRICS.initiativeHealth(DATA, F);
      var acts = METRICS.actionStats(DATA, F);
      var an = METRICS.analyzeNotes(DATA, F);
      s.push('<b>' + ih.rows.length + ' initiatives</b> are in flight — <b>' + ih.counts.Red + ' red</b>, ' +
        ih.counts.Amber + ' amber, ' + ih.counts.Green + ' green — carrying a combined shortfall of <b>' +
        ih.totalGap + ' people</b>.');
      if (ih.blocked.length) s.push('<b>' + ih.blocked.length + '</b> are blocked by an upstream dependency, including <b>' +
        esc(ih.blocked[0].name) + '</b>.');
      s.push('<b>' + acts.overdue + ' action items</b> are overdue and <b>' + acts.blocked + '</b> blocked, with <b>' +
        acts.high + '</b> high-priority items open.');
      if (an.topTheme) s.push('Note analysis across <b>' + an.analyzed + '</b> updates flags <b>' + an.flagged.length +
        '</b> items, most often on <b>' + esc(an.topTheme.theme.toLowerCase()) + '</b>.');
      var acc = METRICS.functionAccountability(DATA, F);
      if (acc.needingAttention.length) {
        s.push('<b>' + acc.needingAttention.length + ' of ' + acc.rows.length + ' functions</b> are off track, ' +
          'carrying <b>' + fmt$(acc.totalUnrealizedUSD) + '</b> of unrealized savings between them — the largest is <b>' +
          esc(acc.rows[0].functionName) + '</b> under ' + esc(acc.rows[0].owner) + '.');
      }
      if (ih.triggers.length) s.push('Recommended action: review the <b>' + ih.triggers.length +
        '</b> armed trigger points — each is a decision already agreed, waiting on a threshold.');
    }
    return pre + s.join(' ');
  }

  function storylines(F) {
    var stamp = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    [1, 2, 3, 4, 5].forEach(function (p) {
      var el = $('#sl-body-' + p); if (!el) return;
      var boxEl = el.closest('.storyline');
      boxEl.classList.add('regen');
      setTimeout(function () {
        el.innerHTML = storylineText(p);
        var pill = $('#sl-pill-' + p); if (pill) pill.textContent = 'AI-generated · ' + stamp;
        boxEl.classList.remove('regen');
      }, 110);
    });
  }

  /* --------------------------------------------------------------- wire --- */
  function wire() {
    $('#analyze-notes').onclick = function () {
      var an = METRICS.analyzeNotes(DATA, APP.getFilters());
      renderNotes(an);
      $('#analyze-stamp').textContent = 'Analysed ' + an.analyzed + ' notes · ' +
        new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      if (window.ADMIN && APP.session && APP.session.role === 'Admin') ADMIN.log('Ran note analysis', an.flagged.length + ' flagged');
    };
    $('#exp-ebc').onclick = function () { EXPORTS.ebc(); };
    $('#exp-jira').onclick = function () { EXPORTS.jira(); };
    $('#exp-roster').onclick = function () { EXPORTS.roster(); };
  }

  return { INFO: INFO, build: build, update: update, storylineText: storylineText, drilldown: drilldown };
})();
