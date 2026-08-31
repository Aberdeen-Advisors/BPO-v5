/* ============================================================================
   APP — WORKFORCE, PLANNING, EXECUTION, DICTIONARY & INTEGRATIONS  (v2)
   Presentation only. Every figure comes from METRICS; nothing is computed here.
   ============================================================================ */

var APPX = (function () {
  'use strict';

  var C, SERIES, alpha, chartClick;
  var CH = {};

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return APP.esc(s); }
  function fmt$(v) { return APP.fmt.$(v); }
  function fmtPct(v) { return APP.fmt.pct(v); }
  function n1(v) { return (Math.round(v * 1000) / 10).toFixed(1) + '%'; }

  // ---------------------------------------------------------------- markup ---
  function kpi(id, title, infoKey) {
    return '<div class="kpi-card"><button class="info-btn" data-info="' + infoKey + '" aria-label="Methodology">i</button>' +
      '<h4>' + title + '</h4><div class="kpi-value" id="kv-' + id + '">—</div>' +
      '<div class="kpi-sub" id="ks-' + id + '"></div></div>';
  }
  function setKpi(id, v, sub, cls) {
    var el = $('#kv-' + id); if (!el) return;
    el.innerHTML = v; el.className = 'kpi-value' + (cls ? ' ' + cls : '');
    $('#ks-' + id).innerHTML = sub || '';
  }
  function panel(title, caption, infoKey, inner, extraClass) {
    return '<div class="panel ' + (extraClass || '') + '"><div class="panel-head"><div class="titles">' +
      '<h3>' + title + '</h3><div class="caption">' + caption + '</div></div>' +
      '<button class="info-btn inline-info" data-info="' + infoKey + '" aria-label="Methodology">i</button></div>' +
      inner + '</div>';
  }
  function story(page) {
    return '<div class="storyline" id="sl-' + page + '">' +
      '<div class="story-head"><h4>Storyline</h4><span class="ai-pill" id="sl-pill-' + page + '">AI-generated</span>' +
      '<button class="info-btn inline-info" data-info="storyline" aria-label="How this is generated">i</button></div>' +
      '<div class="story-body" id="sl-body-' + page + '"></div></div>';
  }

  // ------------------------------------------------------------ build pages ---
  function buildPages() {
    // ---------- 06 Workforce Mix ----------
    $('#p6-body').innerHTML = story(6) +
      '<div class="kpi-row">' +
        kpi('wf-total', 'Total Workforce', 'wfTotal') + kpi('wf-ratio', 'FTE Share', 'wfRatio') +
        kpi('wf-gap', 'Gap to 70 / 30 Target', 'wfRatio') + kpi('wf-vendors', 'Distinct Vendors', 'wfVendor') +
        kpi('wf-cliff', 'Contracts Ending &lt; 90 Days', 'wfCliff') + '</div>' +
      '<div class="chart-grid thirds">' +
        panel('Workforce Composition', 'Click a segment to filter the whole application', 'wfTotal',
          '<div class="chart-box" style="height:210px"><canvas id="c-wf-mix"></canvas></div>') +
        panel('FTE Share by Domain', 'Dashed line is the 70% target', 'wfRatio',
          '<div class="chart-box" style="height:210px"><canvas id="c-wf-domain"></canvas></div>') +
        panel('Definition Check', 'The same data, two definitions, opposite conclusions', 'wfDefinition',
          '<div id="def-check"></div>') +
      '</div>' +
      '<div class="chart-grid">' +
        panel('Vendor Footprint', 'Headcount and team spread per vendor', 'wfVendor',
          '<div class="chart-box" style="height:200px"><canvas id="c-wf-vendor"></canvas></div>' +
          '<div class="chart-note" id="vendor-note"></div>') +
        panel('Contract Cliff', 'Non-FTE positions ending inside the policy window', 'wfCliff',
          '<div style="overflow-x:auto;max-height:230px;overflow-y:auto"><div id="t-cliff"></div></div>') +
      '</div>' +
      panel('Location Alignment by Domain', 'Share of each domain sitting in its primary location — low alignment means coordination cost', 'wfLocation',
        '<div style="overflow-x:auto"><div id="t-location"></div></div>');

    // ---------- 07 Workforce Planning ----------
    $('#p7-body').innerHTML = story(7) +
      '<div class="kpi-row">' +
        kpi('wp-now', 'Current FTE Share', 'wfRatio') + kpi('wp-end', 'Forecast FTE Share', 'wftForecast') +
        kpi('wp-head', 'Forecast Headcount Change', 'wftForecast') + kpi('wp-unfunded', 'Unfunded Positions', 'wpFunding') +
        kpi('wp-unassigned', 'Funded, Not Assigned', 'wpFunding') + '</div>' +
      '<div class="chart-grid">' +
        panel('Workforce Over Time', 'Historical actuals then forecast — the shaded band is forecast', 'wftForecast',
          '<div class="chart-box" style="height:250px"><canvas id="c-wft"></canvas></div>') +
        panel('FTE Share Trajectory', 'Against the 70% target line, under both definitions', 'wfDefinition',
          '<div class="chart-box" style="height:250px"><canvas id="c-wft-ratio"></canvas></div>' +
          '<div class="chart-note" id="wft-note"></div>') +
      '</div>' +
      '<div class="chart-grid">' +
        panel('Requirement, Funding and Assignment', 'Where demand, money and people stop lining up', 'wpFunding',
          '<div class="chart-box" style="height:220px"><canvas id="c-funding"></canvas></div>' +
          '<div class="chart-note" id="funding-note"></div>') +
        panel('Capability Coverage', 'Sorted thinnest first — bars in Jasper are single points of failure', 'wpCoverage',
          '<div class="chart-box" style="height:220px"><canvas id="c-coverage"></canvas></div>' +
          '<div class="chart-note" id="coverage-note"></div>') +
      '</div>' +
      panel('Coverage Detail', 'Capability by team spread, with single-point-of-failure and duplication flags', 'wpCoverage',
        '<div style="overflow-x:auto;max-height:300px;overflow-y:auto"><div id="t-coverage"></div></div>');

    // ---------- 08 Work Management ----------
    $('#p8-body').innerHTML = story(8) +
      '<div class="kpi-row">' +
        kpi('wm-ini', 'Initiatives', 'wmInitiative') + kpi('wm-blocked', 'Blocked by Dependency', 'wmDependency') +
        kpi('wm-gap', 'Initiative Resource Gap', 'wmInitiative') + kpi('wm-overdue', 'Overdue Actions', 'wmAction') +
        kpi('wm-triggers', 'Active Trigger Points', 'wmTrigger') + '</div>' +
      '<div class="chart-grid">' +
        panel('Initiative Health', 'Click a segment to filter', 'wmInitiative',
          '<div class="chart-box" style="height:200px"><canvas id="c-ini-rag"></canvas></div>') +
        panel('Action Items by Status', 'Open work across all initiatives', 'wmAction',
          '<div class="chart-box" style="height:200px"><canvas id="c-actions"></canvas></div>') +
      '</div>' +
      panel('Resource Trigger Points', 'Pre-agreed thresholds that force a decision when crossed', 'wmTrigger',
        '<div id="t-triggers"></div>') +
      panel('Initiatives, Dependencies and Staffing', 'Click a row to filter the application to that domain', 'wmDependency',
        '<div style="overflow-x:auto"><div id="t-initiatives"></div></div>') +
      panel('AI-Assisted Note Analysis', 'Free-text status notes scanned for risk signals — deterministic and explainable, same guardrail as the storyline', 'wmNotes',
        '<div class="scen-tools" style="margin:0 0 12px"><button class="btn-ghost" id="analyze-notes">Analyse ' +
        '<span id="note-count">0</span> free-text notes</button><span id="analyze-stamp" style="font-size:11px;color:var(--muted);align-self:center"></span></div>' +
        '<div id="notes-out"></div>');

    // ---------- 09 Metric Dictionary ----------
    $('#p9-body').innerHTML =
      '<div class="storyline" id="sl-9"><div class="story-head"><h4>Why this page exists</h4>' +
      '<span class="ai-pill">Governance</span></div><div class="story-body">' +
      'Project managers report they cannot always explain how a headline metric is derived. ' +
      'Every metric in this tool is defined once, in one place, and computed by a single shared layer — ' +
      'so a chart, an email draft and the chat assistant cannot disagree. ' +
      '<b>The switches below change real definitions.</b> Move one and every page recalculates, ' +
      'which is the fastest way to see how much a definition is actually worth.</div></div>' +
      panel('Definition Switches', 'These are the choices that change the answer. Nothing here is implicit.', 'mdSwitches',
        '<div id="policy-switches"></div>') +
      panel('Metric Dictionary', 'Every metric, its formula, its source and its owner', 'mdDictionary',
        '<div style="overflow-x:auto"><div id="t-dictionary"></div></div>');

    // ---------- 10 Integrations ----------
    $('#p10-body').innerHTML =
      '<div class="storyline" id="sl-10"><div class="story-head"><h4>Target ecosystem</h4>' +
      '<span class="ai-pill">Future state</span></div><div class="story-body">' +
      'Today this tool reads a weekly spreadsheet. The target is a single governed backend that every ' +
      'front end reads from — so the dashboard, the delivery tracker, the planning submission and the ' +
      'engineering tooling all quote the same certified numbers. <b>The exports below are live</b> and produce ' +
      'the real file shapes each destination expects.</div></div>' +
      panel('Integration Map', 'One governed backend, many front ends', 'intMap', '<div id="int-map"></div>') +
      '<div class="chart-grid">' +
        panel('Live Exports', 'Generated from the current filtered view', 'intExport',
          '<div class="scen-tools" style="margin:0">' +
          '<button class="btn-ghost" id="exp-ebc">Export 2027 CT / EBC workbook</button>' +
          '<button class="btn-ghost" id="exp-jira">Export action items (Jira CSV)</button>' +
          '<button class="btn-ghost" id="exp-roster">Export workforce roster (CSV)</button>' +
          '</div><div class="chart-note" id="export-note">Exports respect the active filter. Nothing is transmitted — files are generated in your browser.</div>') +
        panel('Connection Status', 'What is real today versus what is planned', 'intMap',
          '<div id="t-integrations"></div>') +
      '</div>';
  }

  // ----------------------------------------------------------- build charts ---
  function buildCharts(colors, seriesOrder, alphaFn, clickFactory) {
    C = colors; SERIES = seriesOrder; alpha = alphaFn; chartClick = clickFactory;
    var money = function (v) { return v >= 1e6 ? '$' + (v / 1e6) + 'M' : '$' + Math.round(v / 1e3) + 'K'; };

    CH.mix = new Chart($('#c-wf-mix'), {
      type: 'doughnut',
      data: { labels: [], datasets: [{ data: [], backgroundColor: [], borderWidth: 2, borderColor: '#FFFFFF' }] },
      options: { maintainAspectRatio: false, cutout: '58%',
        onClick: chartClick('workerType', function (l) { return String(l).split(' — ')[0]; }),
        plugins: { legend: { position: 'right', labels: { boxWidth: 10, boxHeight: 10, padding: 8 } } } }
    });

    CH.domain = new Chart($('#c-wf-domain'), {
      type: 'bar',
      data: { labels: [], datasets: [
        { label: 'FTE share', data: [], backgroundColor: [], borderRadius: 3 },
        { label: 'Target', data: [], type: 'line', borderColor: C.onyx, borderDash: [6, 4], borderWidth: 1.5, pointRadius: 0 }
      ] },
      options: { maintainAspectRatio: false, onClick: chartClick('domain'),
        scales: { y: { beginAtZero: true, max: 1, ticks: { callback: function (v) { return Math.round(v * 100) + '%'; } }, grid: { color: C.hairline } },
                  x: { grid: { display: false } } },
        plugins: { legend: { display: false },
          tooltip: { callbacks: { label: function (c) { return c.dataset.label + ': ' + Math.round(c.parsed.y * 100) + '%'; } } } } }
    });

    CH.vendor = new Chart($('#c-wf-vendor'), {
      type: 'bar', data: { labels: [], datasets: [{ data: [], backgroundColor: [], borderRadius: 3 }] },
      options: { indexAxis: 'y', maintainAspectRatio: false, onClick: chartClick('vendorName'),
        scales: { x: { beginAtZero: true, grid: { color: C.hairline } }, y: { grid: { display: false } } },
        plugins: { legend: { display: false } } }
    });

    CH.wft = new Chart($('#c-wft'), {
      type: 'line', data: { labels: [], datasets: [] },
      options: { maintainAspectRatio: false,
        scales: { y: { stacked: true, beginAtZero: true, grid: { color: C.hairline } }, x: { grid: { display: false } } },
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, boxHeight: 10 } } } }
    });

    CH.wftRatio = new Chart($('#c-wft-ratio'), {
      type: 'line', data: { labels: [], datasets: [] },
      options: { maintainAspectRatio: false,
        scales: { y: { min: 0.4, max: 0.85, ticks: { callback: function (v) { return Math.round(v * 100) + '%'; } }, grid: { color: C.hairline } },
                  x: { grid: { display: false } } },
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, boxHeight: 10 } },
          tooltip: { callbacks: { label: function (c) { return c.dataset.label + ': ' + (c.parsed.y == null ? '—' : Math.round(c.parsed.y * 100) + '%'); } } } } }
    });

    CH.funding = new Chart($('#c-funding'), {
      type: 'bar',
      data: { labels: [], datasets: [
        { label: 'Required', data: [], backgroundColor: C.blue, borderRadius: 3 },
        { label: 'Funded', data: [], backgroundColor: C.verd, borderRadius: 3 },
        { label: 'Assigned', data: [], backgroundColor: C.sky, borderRadius: 3 }
      ] },
      options: { maintainAspectRatio: false, onClick: chartClick('domain'),
        scales: { y: { beginAtZero: true, grid: { color: C.hairline } }, x: { grid: { display: false } } },
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, boxHeight: 10 } } } }
    });

    CH.coverage = new Chart($('#c-coverage'), {
      type: 'bar', data: { labels: [], datasets: [{ data: [], backgroundColor: [], borderRadius: 3 }] },
      options: { indexAxis: 'y', maintainAspectRatio: false, onClick: chartClick('capability'),
        scales: { x: { beginAtZero: true, grid: { color: C.hairline } }, y: { grid: { display: false } } },
        plugins: { legend: { display: false } } }
    });

    CH.iniRag = new Chart($('#c-ini-rag'), {
      type: 'doughnut',
      data: { labels: [], datasets: [{ data: [], backgroundColor: [], borderWidth: 2, borderColor: '#FFFFFF' }] },
      options: { maintainAspectRatio: false, cutout: '58%',
        plugins: { legend: { position: 'right', labels: { boxWidth: 10, boxHeight: 10, padding: 8 } } } }
    });

    CH.actions = new Chart($('#c-actions'), {
      type: 'bar', data: { labels: [], datasets: [{ data: [], backgroundColor: [], borderRadius: 3 }] },
      options: { maintainAspectRatio: false,
        scales: { y: { beginAtZero: true, grid: { color: C.hairline } }, x: { grid: { display: false } } },
        plugins: { legend: { display: false } } }
    });

    wireButtons();
  }

  // ---------------------------------------------------------------- update ---
  function update(F) {
    var mix = METRICS.workforceMix(DATA, F);
    var vf = METRICS.vendorFootprint(DATA, F);
    var cliff = METRICS.contractCliff(DATA, F);
    var la = METRICS.locationAlignment(DATA, F);
    var cov = METRICS.roleCoverage(DATA, F);
    var wft = METRICS.wftSummary(DATA);
    var fund = METRICS.fundingAlignment(DATA, F);
    var ih = METRICS.initiativeHealth(DATA, F);
    var as = METRICS.actionStats(DATA, F);
    var empty = mix.total === 0;

    // ---- page 6 KPIs
    setKpi('wf-total', empty ? '—' : String(mix.total), 'positions in scope');
    setKpi('wf-ratio', empty ? '—' : n1(mix.headline.ratio),
      'target ' + fmtPct(mix.headline.targetRatio) + ' · ' + (mix.headline.includesHub ? 'BPO Hub counted as non-FTE' : 'BPO Hub excluded'),
      mix.headline.onTarget ? '' : 'warn');
    setKpi('wf-gap', empty ? '—' : (mix.headline.gapHeads > 0 ? '+' + mix.headline.gapHeads : String(mix.headline.gapHeads)),
      mix.headline.gapHeads > 0 ? 'FTE needed to reach target' : 'above target', mix.headline.gapHeads > 0 ? 'bad' : 'good');
    setKpi('wf-vendors', empty ? '—' : String(vf.distinctVendors),
      vf.fragmentedTeams.length + ' team(s) with ' + DATA.policy.vendorConcentrationThreshold + '+ vendors',
      vf.fragmentedTeams.length ? 'warn' : '');
    setKpi('wf-cliff', empty ? '—' : String(cliff.count), fmt$(cliff.annualCostUSD) + ' annualised', cliff.count ? 'bad' : '');

    // ---- page 7 KPIs
    setKpi('wp-now', n1(wft.ratioNow), 'as at ' + APP.fmt.date(DATA.meta.asOfDate));
    setKpi('wp-end', n1(wft.ratioEnd),
      (wft.reachesTarget ? '<span class="good">reaches target</span>' : '<span class="bad">does not reach target</span>') +
      ' by ' + wft.yearEnd.month, wft.reachesTarget ? '' : 'warn');
    setKpi('wp-head', (wft.headcountDelta >= 0 ? '+' : '') + wft.headcountDelta,
      'net positions over ' + wft.forecastMonths + ' forecast months');
    setKpi('wp-unfunded', empty ? '—' : String(fund.unfundedPositions), fmt$(fund.unfundedCostUSD) + ' annualised', 'bad');
    setKpi('wp-unassigned', empty ? '—' : String(fund.unassignedPositions), 'positions with no initiative', 'warn');

    // ---- page 8 KPIs
    setKpi('wm-ini', String(ih.rows.length), ih.counts.Red + ' red · ' + ih.counts.Amber + ' amber · ' + ih.counts.Green + ' green');
    setKpi('wm-blocked', String(ih.blocked.length), 'waiting on an upstream initiative', ih.blocked.length ? 'bad' : '');
    setKpi('wm-gap', String(ih.totalGap), 'people short across all initiatives', ih.totalGap ? 'warn' : '');
    setKpi('wm-overdue', String(as.overdue), as.blocked + ' blocked · ' + as.high + ' high priority open', as.overdue ? 'bad' : '');
    setKpi('wm-triggers', String(ih.triggers.length), 'thresholds being monitored');

    // ---- charts
    var types = ['FTE', 'Contractor', 'Vendor', 'BPO Hub'];
    var typeColors = [C.blue, C.verd, C.sky, C.gold];
    CH.mix.data.labels = types.map(function (t) { return t + ' — ' + (mix.byType[t] || 0); });
    CH.mix.data.datasets[0].data = types.map(function (t) { return mix.byType[t] || 0; });
    CH.mix.data.datasets[0].backgroundColor = dim(typeColors, F, 'workerType', types);
    CH.mix.update();

    var domRows = domainRatios(F);
    CH.domain.data.labels = domRows.map(function (d) { return d.domain; });
    CH.domain.data.datasets[0].data = domRows.map(function (d) { return d.ratio; });
    CH.domain.data.datasets[0].backgroundColor = dim(domRows.map(function (d) {
      return d.ratio >= DATA.policy.fteTargetRatio ? C.jade : C.gold;
    }), F, 'domain', domRows.map(function (d) { return d.domain; }));
    CH.domain.data.datasets[1].data = domRows.map(function () { return DATA.policy.fteTargetRatio; });
    CH.domain.update();

    CH.vendor.data.labels = vf.vendors.map(function (v) { return v.vendor; });
    CH.vendor.data.datasets[0].data = vf.vendors.map(function (v) { return v.headcount; });
    CH.vendor.data.datasets[0].backgroundColor = dim(vf.vendors.map(function () { return C.verd; }),
      F, 'vendorName', vf.vendors.map(function (v) { return v.vendor; }));
    CH.vendor.update();
    $('#vendor-note').innerHTML = vf.fragmentedTeams.length
      ? '<b>' + vf.fragmentedTeams.length + ' team(s)</b> carry ' + DATA.policy.vendorConcentrationThreshold +
        ' or more vendors: ' + vf.fragmentedTeams.map(function (t) { return esc(t.team) + ' (' + t.vendorCount + ')'; }).join(', ') +
        '. Each additional vendor inside one team adds coordination and contract overhead.'
      : 'No team exceeds the vendor concentration threshold.';

    // ---- workforce forecast
    var s = wft.series;
    var labels = s.map(function (m) { return m.month.slice(2); });
    var cut = s.filter(function (m) { return !m.forecast; }).length;
    function seg(key, color, label) {
      return [
        { label: label, data: s.map(function (m, i) { return i < cut ? m[key] : null; }),
          borderColor: color, backgroundColor: alpha(color, .5), fill: true, tension: .25, pointRadius: 0, borderWidth: 2 },
        { label: label + ' (forecast)', data: s.map(function (m, i) { return i >= cut - 1 ? m[key] : null; }),
          borderColor: color, backgroundColor: alpha(color, .22), fill: true, tension: .25, pointRadius: 0,
          borderWidth: 2, borderDash: [6, 4] }
      ];
    }
    CH.wft.data.labels = labels;
    CH.wft.data.datasets = [].concat(seg('fte', C.blue, 'FTE'), seg('contractor', C.verd, 'Contractor'),
                                     seg('vendor', C.sky, 'Vendor'), seg('bpoHub', C.gold, 'BPO Hub'));
    CH.wft.options.plugins.legend.labels.filter = function (i) { return i.text.indexOf('forecast') < 0; };
    CH.wft.update();

    CH.wftRatio.data.labels = labels;
    CH.wftRatio.data.datasets = [
      { label: 'Target', data: s.map(function () { return DATA.policy.fteTargetRatio; }),
        borderColor: C.onyx, borderDash: [7, 5], borderWidth: 1.5, pointRadius: 0 },
      { label: 'Including BPO Hub', data: s.map(function (m) { return m.fteRatioInclHub; }),
        borderColor: C.blue, borderWidth: 3, pointRadius: 0, tension: .25 },
      { label: 'Excluding BPO Hub', data: s.map(function (m) { return m.fteRatioExclHub; }),
        borderColor: C.verd, borderWidth: 2, pointRadius: 0, tension: .25, borderDash: [5, 3] }
    ];
    CH.wftRatio.update();
    $('#wft-note').innerHTML = 'Under the current definition the ratio moves from <b>' + n1(wft.ratioNow) +
      '</b> to <b>' + n1(wft.ratioEnd) + '</b> by ' + wft.yearEnd.month + ' — ' +
      (wft.direction < 0
        ? '<b>away from</b> the target, because every role transferred to the BPO Hub is counted as non-FTE. That is the tension between the transition and the 70/30 goal, and it needs an explicit decision.'
        : '<b>toward</b> the target.');

    // ---- funding
    CH.funding.data.labels = fund.rows.map(function (f) { return f.domain; });
    CH.funding.data.datasets[0].data = fund.rows.map(function (f) { return f.requiredFte; });
    CH.funding.data.datasets[1].data = fund.rows.map(function (f) { return f.fundedFte; });
    CH.funding.data.datasets[2].data = fund.rows.map(function (f) { return f.assignedFte; });
    CH.funding.update();
    $('#funding-note').innerHTML = 'Across the view, <b>' + fund.totals.requiredFte + '</b> positions are required, <b>' +
      fund.totals.fundedFte + '</b> are funded and <b>' + fund.totals.assignedFte + '</b> are actually assigned — a funding gap of <b>' +
      fund.totals.fundingGap + '</b> and an assignment gap of <b>' + fund.totals.assignmentGap + '</b>. ' +
      'Requirements, money and people are tracked in three places today; this is what happens when they are put side by side.';

    // ---- coverage
    var cRows = cov.rows.slice(0, 14);
    CH.coverage.data.labels = cRows.map(function (r) { return r.capability; });
    CH.coverage.data.datasets[0].data = cRows.map(function (r) { return r.headcount; });
    CH.coverage.data.datasets[0].backgroundColor = dim(cRows.map(function (r) {
      return r.singlePoint ? C.jasper : r.critical ? C.gold : C.blue;
    }), F, 'capability', cRows.map(function (r) { return r.capability; }));
    CH.coverage.update();
    $('#coverage-note').innerHTML = '<b>' + cov.singlePoints.length + '</b> capabilities rest on a single person and <b>' +
      cov.critical.length + '</b> are at or below the critical threshold of ' + DATA.policy.coverageCriticalThreshold +
      '. There are also <b>' + cov.spofPairs.length + '</b> domain-and-capability combinations covered by exactly one person.';

    // ---- initiative + action charts
    var ragKeys = ['Green', 'Amber', 'Red'];
    CH.iniRag.data.labels = ragKeys.map(function (k) { return k + ' — ' + (ih.counts[k] || 0); });
    CH.iniRag.data.datasets[0].data = ragKeys.map(function (k) { return ih.counts[k] || 0; });
    CH.iniRag.data.datasets[0].backgroundColor = [C.jade, C.gold, C.jasper];
    CH.iniRag.update();

    var st = as.byStatus.filter(function (x) { return x.n; });
    CH.actions.data.labels = st.map(function (x) { return x.status; });
    CH.actions.data.datasets[0].data = st.map(function (x) { return x.n; });
    CH.actions.data.datasets[0].backgroundColor = st.map(function (x) {
      return x.status === 'Blocked' ? C.jasper : x.status === 'Done' ? C.jade : x.status === 'In Progress' ? C.verd : C.blue;
    });
    CH.actions.update();

    // ---- tables
    renderCliff(cliff);
    renderLocation(la);
    renderCoverageTable(cov);
    renderTriggers(ih);
    renderInitiatives(ih);
    renderDefinitionCheck(mix);
    renderPolicySwitches();
    renderDictionary(F);
    renderIntegrationMap();
    renderIntegrationStatus();
    $('#note-count').textContent = as.rows.length;
    storylines(F);
  }

  function dim(colorArr, F, key, values) {
    var sel = (F && F[key]) || [];
    if (!sel.length) return colorArr;
    return colorArr.map(function (c, i) { return sel.indexOf(values[i]) >= 0 ? c : alpha(c, .18); });
  }

  function domainRatios(F) {
    var people = METRICS.filterWorkforce(DATA, F);
    var m = {};
    people.forEach(function (p) {
      var d = (m[p.domain] = m[p.domain] || { domain: p.domain, fte: 0, total: 0, hub: 0 });
      d.total++; if (p.isFte) d.fte++; if (p.workerType === 'BPO Hub') d.hub++;
    });
    return Object.keys(m).map(function (k) {
      var d = m[k];
      var denom = DATA.policy.bpoHubCountsAsNonFte ? d.total : d.total - d.hub;
      d.ratio = denom ? d.fte / denom : 0;
      return d;
    }).sort(function (a, b) { return a.ratio - b.ratio; });
  }

  // ---------------------------------------------------------------- tables ---
  function renderCliff(cliff) {
    if (!cliff.count) { $('#t-cliff').innerHTML = '<div class="empty-state">No non-FTE contracts end inside the next ' + cliff.windowDays + ' days.</div>'; return; }
    var h = '<table class="matrix"><thead><tr><th>Position</th><th>Type</th><th>Vendor</th><th>Domain</th>' +
      '<th style="text-align:right">Days left</th><th style="text-align:right">Annual cost</th></tr></thead><tbody>';
    cliff.roles.slice(0, 25).forEach(function (p) {
      h += '<tr><td>' + esc(p.id) + '</td><td>' + esc(p.workerType) + '</td><td>' + esc(p.vendorName || '—') +
        '</td><td>' + esc(p.domain) + '</td><td class="num"' + (p.daysRemaining <= 30 ? ' style="color:var(--jasper);font-weight:500"' : '') +
        '>' + p.daysRemaining + '</td><td class="num">' + fmt$(p.annualCost) + '</td></tr>';
    });
    h += '</tbody></table>';
    if (cliff.roles.length > 25) h += '<div class="chart-note">Showing 25 of ' + cliff.roles.length + ' — export for the full list.</div>';
    $('#t-cliff').innerHTML = h;
  }

  function renderLocation(la) {
    if (!la.rows.length) { $('#t-location').innerHTML = '<div class="empty-state">No workforce matches the current filters.</div>'; return; }
    var locs = la.allLocations;
    var h = '<table class="matrix"><thead><tr><th>Domain</th>';
    locs.forEach(function (l) { h += '<th style="text-align:right">' + esc(l) + '</th>'; });
    h += '<th style="text-align:right">Sites</th><th style="text-align:right">Alignment</th><th>Status</th></tr></thead><tbody>';
    la.rows.forEach(function (r) {
      h += '<tr class="clickable" data-domain="' + esc(r.domain) + '"><td>' + esc(r.domain) + '</td>';
      locs.forEach(function (l) {
        var n = r.locations[l] || 0;
        var share = r.total ? n / r.total : 0;
        var bg = n ? 'background:rgba(9,55,95,' + (0.05 + share * 0.35).toFixed(3) + ')' : '';
        h += '<td class="num" style="' + bg + '">' + (n || '—') + '</td>';
      });
      h += '<td class="num">' + r.locationCount + '</td><td class="num">' + fmtPct(r.alignment) + '</td>' +
        '<td><span class="rag-pill rag-' + r.rag + '">' + r.rag + '</span></td></tr>';
    });
    h += '</tbody></table>';
    $('#t-location').innerHTML = h;
    $$('#t-location tr.clickable').forEach(function (tr) {
      tr.onclick = function (e) { APP.toggleFilter('domain', tr.dataset.domain, e.ctrlKey || e.metaKey); };
    });
  }

  function renderCoverageTable(cov) {
    if (!cov.rows.length) { $('#t-coverage').innerHTML = '<div class="empty-state">No workforce matches the current filters.</div>'; return; }
    var h = '<table class="matrix"><thead><tr><th>Capability</th><th style="text-align:right">People</th>' +
      '<th style="text-align:right">FTE</th><th style="text-align:right">Teams</th><th style="text-align:right">Domains</th><th>Flag</th></tr></thead><tbody>';
    cov.rows.forEach(function (r) {
      var flag = r.singlePoint ? '<span class="rag-pill rag-Red">Single point of failure</span>'
               : r.critical ? '<span class="rag-pill rag-Amber">Critical — thin cover</span>'
               : r.duplicated ? '<span class="rag-pill rag-Amber">Spread across many teams</span>'
               : '<span class="rag-pill rag-Green">Covered</span>';
      h += '<tr class="clickable" data-cap="' + esc(r.capability) + '"><td>' + esc(r.capability) + '</td>' +
        '<td class="num">' + r.headcount + '</td><td class="num">' + r.fte + '</td>' +
        '<td class="num">' + r.teamCount + '</td><td class="num">' + r.domainCount + '</td><td>' + flag + '</td></tr>';
    });
    h += '</tbody></table>';
    $('#t-coverage').innerHTML = h;
    $$('#t-coverage tr.clickable').forEach(function (tr) {
      tr.onclick = function (e) { APP.toggleFilter('capability', tr.dataset.cap, e.ctrlKey || e.metaKey); };
    });
  }

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
    var h = '<table class="matrix"><thead><tr><th>Initiative</th><th>Owner</th><th>Domain</th><th>Due</th>' +
      '<th style="text-align:right">Need</th><th style="text-align:right">Have</th><th style="text-align:right">Gap</th>' +
      '<th>Depends on</th><th>Status</th></tr></thead><tbody>';
    ih.rows.forEach(function (r) {
      var dep = r.dependsOn.length
        ? r.dependsOn.map(function (d) {
            var blocked = r.blockers.indexOf(d) >= 0;
            return '<span class="dep-chip' + (blocked ? ' blocked' : '') + '">' + esc(d) + '</span>';
          }).join(' ')
        : '<span style="color:var(--muted)">—</span>';
      h += '<tr class="clickable" data-domain="' + esc(r.domain) + '"><td>' + esc(r.name) +
        (r.atRiskFromDependency ? ' <span class="rag-pill rag-Red">Blocked</span>' : '') + '</td>' +
        '<td>' + esc(r.owner) + '</td><td>' + esc(r.domain) + '</td><td>' + esc(r.dueDate) + '</td>' +
        '<td class="num">' + r.requiredHeadcount + '</td><td class="num">' + r.assignedHeadcount + '</td>' +
        '<td class="num"' + (r.resourceGap > 0 ? ' style="color:var(--jasper);font-weight:500"' : '') + '>' +
        (r.resourceGap > 0 ? '−' + r.resourceGap : '0') + '</td>' +
        '<td>' + dep + '</td><td><span class="rag-pill rag-' + r.rag + '">' + r.rag + '</span></td></tr>';
    });
    h += '</tbody></table>';
    $('#t-initiatives').innerHTML = h;
    $$('#t-initiatives tr.clickable').forEach(function (tr) {
      tr.onclick = function (e) { APP.toggleFilter('domain', tr.dataset.domain, e.ctrlKey || e.metaKey); };
    });
  }

  function renderDefinitionCheck(mix) {
    var a = mix.inclHub, b = mix.exclHub;
    function block(label, v, isHeadline) {
      return '<div class="def-block' + (isHeadline ? ' headline' : '') + '">' +
        '<div class="def-label">' + label + (isHeadline ? ' <span class="def-tag">in use</span>' : '') + '</div>' +
        '<div class="def-value">' + n1(v.ratio) + '</div>' +
        '<div class="def-sub">' + v.fte + ' FTE of ' + v.total + ' · ' +
        (v.gapHeads > 0 ? '<span class="bad">' + v.gapHeads + ' short of target</span>'
                        : '<span class="good">' + Math.abs(v.gapHeads) + ' above target</span>') + '</div></div>';
    }
    var headlineIsIncl = DATA.policy.bpoHubCountsAsNonFte;
    $('#def-check').innerHTML =
      block('BPO Hub counted as non-FTE', a, headlineIsIncl) +
      block('BPO Hub excluded from the ratio', b, !headlineIsIncl) +
      '<div class="def-note">One definition says you are <b>' + (a.onTarget ? 'on' : 'off') + '</b> target, the other says <b>' +
      (b.onTarget ? 'on' : 'off') + '</b>. Nothing about the people changed. This is why the definition needs an owner — ' +
      'switch it on the Metric Dictionary page and watch every number move.</div>';
  }

  // ------------------------------------------------------ metric dictionary ---
  function renderPolicySwitches() {
    var p = DATA.policy;
    var rows = [
      ['bpoHubCountsAsNonFte', 'BPO Hub counts as non-FTE', 'toggle',
       'Decides whether transferred roles count against the 70/30 target. Reverses the headline conclusion.'],
      ['fteTargetRatio', 'FTE target ratio', 'pct',
       'The committed FTE share of the workforce.'],
      ['coverageCriticalThreshold', 'Critical coverage threshold', 'int',
       'A capability with this many people or fewer is flagged as thin cover.'],
      ['contractCliffDays', 'Contract cliff window (days)', 'int',
       'How far ahead to look for non-FTE contracts ending.'],
      ['vendorConcentrationThreshold', 'Vendor concentration threshold', 'int',
       'Distinct vendors inside one team before it is flagged as fragmented.']
    ];
    var h = '<div class="switch-grid">';
    rows.forEach(function (r) {
      var key = r[0], label = r[1], kind = r[2], help = r[3];
      var control;
      if (kind === 'toggle') {
        control = '<button class="switch' + (p[key] ? ' on' : '') + '" data-policy="' + key + '" data-kind="toggle" ' +
          'role="switch" aria-checked="' + (!!p[key]) + '"><span class="knob"></span></button>' +
          '<span class="switch-state">' + (p[key] ? 'Yes' : 'No') + '</span>';
      } else if (kind === 'pct') {
        control = '<input type="range" min="50" max="90" value="' + Math.round(p[key] * 100) +
          '" data-policy="' + key + '" data-kind="pct" style="width:130px;accent-color:var(--verdigris)">' +
          '<span class="switch-state">' + Math.round(p[key] * 100) + '%</span>';
      } else {
        control = '<input type="range" min="1" max="' + (key === 'contractCliffDays' ? 180 : 10) + '" value="' + p[key] +
          '" data-policy="' + key + '" data-kind="int" style="width:130px;accent-color:var(--verdigris)">' +
          '<span class="switch-state">' + p[key] + '</span>';
      }
      h += '<div class="switch-row"><div class="switch-label"><b>' + esc(label) + '</b><span>' + esc(help) + '</span></div>' +
        '<div class="switch-control">' + control + '</div></div>';
    });
    $('#policy-switches').innerHTML = h + '</div>';

    $$('#policy-switches [data-policy]').forEach(function (el) {
      var key = el.dataset.policy, kind = el.dataset.kind;
      if (kind === 'toggle') {
        el.onclick = function () { DATA.policy[key] = !DATA.policy[key]; APP.updateAll(); APP.toast('Definition changed — every page recalculated'); };
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
    var k = METRICS.kpis(DATA, F);
    var mix = METRICS.workforceMix(DATA, F);
    var wft = METRICS.wftSummary(DATA);
    var cov = METRICS.roleCoverage(DATA, F);
    var DICT = [
      ['Conversions Exited', 'Transition', 'Roles whose onshore cost has stopped', 'count(actualExitDate is not null)', 'Weekly BPO Hub file', 'Transition Lead', k.exited + ' of ' + k.inScope],
      ['Rolloff Attainment', 'Transition', 'Exits achieved against the time-phased plan', 'exited ÷ planned-to-date', 'Weekly BPO Hub file', 'Transition Lead', fmtPct(k.rolloffAttainment)],
      ['Realization Rate', 'Savings', 'Share of planned savings actually realized', 'trailing 2 completed quarters: actual ÷ planned', 'Finance + transition file', 'Finance Lead', fmtPct(k.realizationRate)],
      ['Projected Year-End', 'Savings', 'Pace-adjusted year-end savings', 'YTD actual + (remaining pipeline × realization rate)', 'Derived', 'Finance Lead', APP.fmt.M(k.projectedYearEndUSD)],
      ['Cost Leakage', 'Savings', 'Onshore cost carried past target exit dates', 'overdue roles × daily onshore cost × days late', 'Derived — <b>method not yet ratified</b>', 'Finance Lead', fmt$(k.leakageUSD)],
      ['FTE Share', 'Workforce', 'FTE as a share of total workforce', 'FTE ÷ (FTE + non-FTE)', 'Roster + contracting register', 'Workforce Lead', n1(mix.headline.ratio)],
      ['Gap to 70/30', 'Workforce', 'FTE needed to reach the committed ratio', '(total × target ratio) − FTE', 'Derived', 'Workforce Lead', mix.headline.gapHeads + ' people'],
      ['Location Alignment', 'Workforce', 'Concentration of a domain in its primary site', 'largest site headcount ÷ domain headcount', 'Roster', 'Workforce Lead', 'per domain'],
      ['Capability Coverage', 'Workforce', 'People holding a given capability', 'count(people by capability)', 'Roster', 'Domain Leads', cov.singlePoints.length + ' single points'],
      ['Contract Cliff', 'Workforce', 'Non-FTE contracts ending inside the window', 'count(endDate within N days)', 'Contracting register', 'Vendor Management Lead', METRICS.contractCliff(DATA, F).count + ' positions'],
      ['Forecast FTE Share', 'Planning', 'Projected FTE share at horizon end', 'forecast FTE ÷ forecast total', 'WFT forecast', 'Workforce Lead', n1(wft.ratioEnd)],
      ['Funding Gap', 'Planning', 'Required positions not funded', 'required − funded', 'Planning submission', 'Program Management Lead', METRICS.fundingAlignment(DATA, F).totals.fundingGap + ' positions'],
      ['Initiative Resource Gap', 'Execution', 'People short across initiatives', 'Σ max(0, required − assigned)', 'Initiative register', 'Program Management Lead', METRICS.initiativeHealth(DATA, F).totalGap + ' people'],
      ['Overdue Actions', 'Execution', 'Action items past due and not done', 'count(due < as-of and status ≠ Done)', 'Action register', 'Program Management Lead', METRICS.actionStats(DATA, F).overdue + ' items']
    ];
    var h = '<table class="matrix"><thead><tr><th>Metric</th><th>Area</th><th>Definition</th><th>Formula</th>' +
      '<th>Source</th><th>Owner</th><th>Current value</th></tr></thead><tbody>';
    DICT.forEach(function (d) {
      h += '<tr><td><b>' + esc(d[0]) + '</b></td><td>' + esc(d[1]) + '</td><td>' + esc(d[2]) + '</td>' +
        '<td style="color:var(--muted)">' + d[3] + '</td><td>' + d[4] + '</td><td>' + esc(d[5]) + '</td>' +
        '<td style="font-weight:500;color:var(--aberdeen-blue)">' + d[6] + '</td></tr>';
    });
    $('#t-dictionary').innerHTML = h + '</tbody></table>';
  }

  // ---------------------------------------------------------- integrations ---
  function renderIntegrationMap() {
    var nodes = [
      ['Sources', ['HRIS', 'Finance / GL', 'Vendor systems', 'Contracting register', 'Smartsheet trackers']],
      ['Governed backend', ['SharePoint / OneLake landing', 'Bronze → Silver → Gold', 'Certified semantic model']],
      ['Front ends', ['This tracker', 'Power BI reporting', 'Jira delivery', 'Engineering tooling', '2027 CT / EBC submission']]
    ];
    var h = '<div class="int-flow">';
    nodes.forEach(function (col, i) {
      h += '<div class="int-col"><div class="int-col-head">' + esc(col[0]) + '</div>';
      col[1].forEach(function (n) { h += '<div class="int-node' + (i === 1 ? ' core' : '') + '">' + esc(n) + '</div>'; });
      h += '</div>';
      if (i < nodes.length - 1) h += '<div class="int-arrow">→</div>';
    });
    $('#int-map').innerHTML = h + '</div>' +
      '<div class="chart-note">One certified metric layer in the middle is what stops the dashboard, the delivery tracker and the ' +
      'board submission from quoting three different numbers. Every front end reads the same definitions.</div>';
  }

  function renderIntegrationStatus() {
    var rows = [
      ['Weekly Excel upload', 'Live today', 'Green', 'Program lead drags the file in; validated and previewed before commit.'],
      ['EBC / 2027 CT export', 'Live today', 'Green', 'Generates the planning workbook shape from the current view.'],
      ['Jira action export', 'Live today', 'Green', 'CSV in Jira import format — issue type, summary, owner, due date.'],
      ['SharePoint scheduled pickup', 'Planned — phase 2', 'Amber', 'Removes the manual upload; file lands and loads on a schedule.'],
      ['Fabric semantic model', 'Planned — phase 2', 'Amber', 'Certified metric definitions move out of the browser and into the platform.'],
      ['Jira two-way sync', 'Planned — phase 3', 'Amber', 'Requires single sign-on before any authenticated connection can be built.'],
      ['Source system feeds', 'Planned — phase 3', 'Amber', 'Direct ingestion from HRIS, GL and vendor systems.']
    ];
    var h = '<table class="matrix"><thead><tr><th>Connection</th><th>Status</th><th>Notes</th></tr></thead><tbody>';
    rows.forEach(function (r) {
      h += '<tr><td><b>' + esc(r[0]) + '</b></td><td><span class="rag-pill rag-' + r[2] + '">' + esc(r[1]) +
        '</span></td><td style="color:var(--muted)">' + esc(r[3]) + '</td></tr>';
    });
    $('#t-integrations').innerHTML = h + '</tbody></table>';
  }

  // -------------------------------------------------------------- buttons ---
  function wireButtons() {
    $('#analyze-notes').onclick = function () {
      var an = METRICS.analyzeNotes(DATA, APP.getFilters());
      renderNoteAnalysis(an);
      $('#analyze-stamp').textContent = 'Analysed ' + an.analyzed + ' notes · ' +
        new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      if (window.ADMIN && APP.session && APP.session.role === 'Admin') ADMIN.log('Ran note analysis', an.flagged.length + ' flagged');
    };
    $('#exp-ebc').onclick = function () { EXPORTS.ebc(); };
    $('#exp-jira').onclick = function () { EXPORTS.jira(); };
    $('#exp-roster').onclick = function () { EXPORTS.roster(); };
  }

  function renderNoteAnalysis(an) {
    if (!an.flagged.length) { $('#notes-out').innerHTML = '<div class="empty-state">No risk signals found in the current notes.</div>'; return; }
    var h = '<div class="theme-row">';
    an.themes.forEach(function (t) {
      h += '<span class="theme-chip">' + esc(t.theme) + ' <b>' + t.n + '</b></span>';
    });
    h += '</div><table class="matrix"><thead><tr><th>Action</th><th>Owner</th><th>Signals detected</th><th>Severity</th></tr></thead><tbody>';
    an.flagged.slice(0, 12).forEach(function (f) {
      var sev = f.severity === 'High' ? 'Red' : f.severity === 'Medium' ? 'Amber' : 'Green';
      h += '<tr><td><b>' + esc(f.title) + '</b><div style="color:var(--muted);font-size:11px;margin-top:2px">' +
        esc(f.note.slice(0, 130)) + (f.note.length > 130 ? '…' : '') + '</div></td>' +
        '<td>' + esc(f.owner) + '</td>' +
        '<td>' + f.themes.map(function (t) { return '<span class="dep-chip">' + esc(t.theme) + '</span>'; }).join(' ') + '</td>' +
        '<td><span class="rag-pill rag-' + sev + '">' + f.severity + '</span></td></tr>';
    });
    h += '</tbody></table><div class="chart-note">Signals are matched against a maintained keyword set and weighted by ' +
      'status, priority and how overdue the item is. Deterministic by design — it will never invent a risk that is not in the text.</div>';
    $('#notes-out').innerHTML = h;
  }

  // ------------------------------------------------------------ storylines ---
  function storylines(F) {
    var mix = METRICS.workforceMix(DATA, F);
    var vf = METRICS.vendorFootprint(DATA, F);
    var cliff = METRICS.contractCliff(DATA, F);
    var la = METRICS.locationAlignment(DATA, F);
    var cov = METRICS.roleCoverage(DATA, F);
    var wft = METRICS.wftSummary(DATA);
    var fund = METRICS.fundingAlignment(DATA, F);
    var ih = METRICS.initiativeHealth(DATA, F);
    var as = METRICS.actionStats(DATA, F);
    var an = METRICS.analyzeNotes(DATA, F);
    var stamp = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

    var s6 = [];
    if (mix.total === 0) { s6.push('No workforce matches the current filters.'); }
    else {
      s6.push('The workforce is <b>' + mix.total + ' positions</b>, <b>' + n1(mix.headline.ratio) +
        '</b> of them FTE against a <b>' + fmtPct(mix.headline.targetRatio) + '</b> target — <b>' +
        Math.abs(mix.headline.gapHeads) + ' people</b> ' + (mix.headline.gapHeads > 0 ? 'short' : 'clear') + '.');
      s6.push('On the alternate definition it reads <b>' + n1(mix.alternate.ratio) +
        '</b>, so the answer to "are we on target" depends on a decision nobody has formally made.');
      if (vf.fragmentedTeams.length) {
        s6.push('<b>' + vf.distinctVendors + ' vendors</b> are in play and <b>' + vf.fragmentedTeams.length +
          '</b> team(s) carry ' + DATA.policy.vendorConcentrationThreshold + ' or more of them.');
      }
      if (cliff.count) {
        s6.push('<b>' + cliff.count + ' non-FTE contracts</b> worth <b>' + fmt$(cliff.annualCostUSD) +
          '</b> annualised end within ' + cliff.windowDays + ' days.');
      }
      if (la.rows.length) {
        s6.push('Location alignment is weakest in <b>' + esc(la.rows[0].domain) + '</b> at <b>' +
          fmtPct(la.rows[0].alignment) + '</b> across ' + la.rows[0].locationCount + ' sites.');
      }
    }

    var s7 = [];
    s7.push('FTE share moves from <b>' + n1(wft.ratioNow) + '</b> today to <b>' + n1(wft.ratioEnd) +
      '</b> by <b>' + wft.yearEnd.month + '</b> — ' + (wft.reachesTarget ? 'reaching' : '<b>not reaching</b>') +
      ' the ' + fmtPct(DATA.policy.fteTargetRatio) + ' target.');
    if (wft.direction < 0) {
      s7.push('The trajectory moves <b>away</b> from target because every role transferred to the BPO Hub counts as non-FTE. ' +
        'The transition and the 70/30 commitment are pulling in opposite directions and need reconciling.');
    }
    s7.push('Across the plan, <b>' + fund.totals.requiredFte + '</b> positions are required, <b>' + fund.totals.fundedFte +
      '</b> funded and <b>' + fund.totals.assignedFte + '</b> assigned — a <b>' + fund.totals.fundingGap +
      '</b> funding gap and <b>' + fund.totals.assignmentGap + '</b> funded-but-unassigned.');
    if (cov.singlePoints.length) {
      s7.push('<b>' + cov.singlePoints.length + ' capabilities</b> rest on one person: ' +
        cov.singlePoints.map(function (r) { return esc(r.capability); }).join(', ') + '.');
    }
    s7.push('Recommended action: fund the <b>' + fund.unfundedPositions + '</b> unfunded positions into the ' +
      DATA.policy.planningCycle + ' submission and cross-train the single-point capabilities before the contract cliff lands.');

    var s8 = [];
    s8.push('<b>' + ih.rows.length + ' initiatives</b> are in flight — <b>' + ih.counts.Red + ' red</b>, ' +
      ih.counts.Amber + ' amber, ' + ih.counts.Green + ' green — carrying a combined resource gap of <b>' +
      ih.totalGap + ' people</b>.');
    if (ih.blocked.length) {
      s8.push('<b>' + ih.blocked.length + '</b> are blocked by an upstream dependency, including <b>' +
        esc(ih.blocked[0].name) + '</b>.');
    }
    s8.push('<b>' + as.overdue + ' action items</b> are overdue and <b>' + as.blocked + '</b> are blocked, with <b>' +
      as.high + '</b> high-priority items still open.');
    if (an.topTheme) {
      s8.push('Note analysis across <b>' + an.analyzed + '</b> free-text updates flags <b>' + an.flagged.length +
        '</b> items, most often on <b>' + esc(an.topTheme.theme.toLowerCase()) + '</b> (' + an.topTheme.n + ' mentions).');
    }
    if (ih.triggers.length) {
      s8.push('Recommended action: review the <b>' + ih.triggers.length + '</b> live trigger points — each one is a ' +
        'pre-agreed threshold that forces a decision rather than a debate.');
    }

    [[6, s6], [7, s7], [8, s8]].forEach(function (pair) {
      var el = $('#sl-body-' + pair[0]); if (!el) return;
      var box = el.closest('.storyline');
      box.classList.add('regen');
      setTimeout(function () {
        el.innerHTML = pair[1].join(' ');
        var pill = $('#sl-pill-' + pair[0]); if (pill) pill.textContent = 'AI-generated · ' + stamp;
        box.classList.remove('regen');
      }, 120);
    });
  }

  // ------------------------------------------- scenario resource drill-down ---
  function scenarioResources(F, opts) {
    var host = $('#scen-resources'); if (!host) return;
    var sr = METRICS.scenarioResources(DATA, F, opts);
    if (!sr.rows.length) { host.innerHTML = '<div class="empty-state">No initiatives in scope.</div>'; return; }
    var h = '<div class="chart-note" style="margin:0 0 8px">Capability demand from in-flight initiatives against <b>uncommitted</b> ' +
      'capacity — people already assigned to an initiative cannot staff a scenario twice. ' +
      '<b>' + sr.uncommitted + '</b> of ' + sr.peopleInScope + ' positions are currently uncommitted.</div>';
    h += '<table class="matrix"><thead><tr><th>Capability</th><th style="text-align:right">Required</th>' +
      '<th style="text-align:right">Uncommitted</th><th style="text-align:right">Gap</th></tr></thead><tbody>';
    sr.rows.slice(0, 8).forEach(function (r) {
      h += '<tr class="clickable" data-cap="' + esc(r.capability) + '"><td>' + esc(r.capability) + '</td>' +
        '<td class="num">' + r.requiredHeadcount + '</td><td class="num">' + r.availableHeadcount + '</td>' +
        '<td class="num"' + (r.gap > 0 ? ' style="color:var(--jasper);font-weight:500"' : '') + '>' +
        (r.gap > 0 ? '−' + r.gap : '0') + '</td></tr>';
    });
    h += '</tbody></table>';
    h += '<div class="sensitivity" style="margin-top:10px">This scenario is <b>' + sr.totalGap +
      ' people short</b> across <b>' + sr.shortfalls.length + '</b> capabilities. ' +
      (sr.totalGap > 0 ? 'Click a capability to see who is available.' : 'Uncommitted capacity covers the demand.') + '</div>';
    host.innerHTML = h;
    $$('#scen-resources tr.clickable').forEach(function (tr) {
      tr.onclick = function (e) { APP.toggleFilter('capability', tr.dataset.cap, e.ctrlKey || e.metaKey); };
    });
  }

  return { buildPages: buildPages, buildCharts: buildCharts, update: update,
           scenarioResources: scenarioResources, renderNoteAnalysis: renderNoteAnalysis };
})();
