/* ============================================================================
   APP — shell, routing, cross-filtering, charts, storyline, scenarios, admin.
   All figures come from METRICS (single aggregation layer) — never hardcoded.
   ============================================================================ */

/* Mock auth for the demo ONLY. Production replaces this entire block with
   corporate SSO (e.g. Entra ID / SAML) — see README "Moving to SSO". */
var AUTH_CONFIG = {
  mode: 'none',
  roles: ['Viewer', 'Admin'],
  defaultRole: 'Admin',
  note: 'No sign-in in this build. Production replaces this with corporate SSO, ' +
        'which supplies the identity and the role; the in-app switcher is demo-only.'
};

var APP = (function () {
  'use strict';

  // ---------- palette (brand-locked) ----------
  var C = {
    blue: '#09375F', verd: '#44B0B1', sky: '#5CC8FF', gold: '#F7D002',
    jade: '#00A676', jasper: '#DB504A', onyx: '#404040',
    muted: 'rgba(9,55,95,.62)', hairline: 'rgba(9,55,95,.10)'
  };
  var SERIES = [C.blue, C.verd, C.sky, C.gold, C.jade, C.jasper]; // brand order
  function alpha(hex, a) {
    var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  // ---------- state ----------
  var SESSION = null;
  var FILTERS = {};
  var CHARTS = {};
  var CURRENT_PAGE = 1;
  var SCENARIO_NOTE = '';
  // Defaults reproduce the ratified scenario table: 85% / 72% / 67% realization,
  // all other levers neutral — the sliders let users deviate from there.
  var SCEN_DEFAULTS = {
    up:   { name: 'Upside',    rate: 85, pace: 100, delay: 10, ramp: 6, attr: 0 },
    base: { name: 'Base Case', rate: 72, pace: 100, delay: 10, ramp: 6, attr: 0 },
    down: { name: 'Downside',  rate: 67, pace: 100, delay: 10, ramp: 6, attr: 0 }
  };
  var SCEN = JSON.parse(JSON.stringify(SCEN_DEFAULTS));
  var FC_METHOD = 'trailing';

  // ---------- tiny DOM + format helpers ----------
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function fmtM(v) { return '$' + (v / 1e6).toFixed(1) + 'M'; }
  function fmtK(v) { return '$' + Math.round(v / 1e3) + 'K'; }
  function fmt$(v) { var a = Math.abs(v); return a >= 950000 ? (v < 0 ? '-' : '') + fmtM(a) : (v < 0 ? '-' : '') + fmtK(a); }
  function fmtPct(v) { return Math.round(v * 100) + '%'; }
  function fmtDate(iso) {
    var d = new Date(iso.length > 10 ? iso : iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._h); toast._h = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }
  var DIM_LABELS = {
    wave: 'Wave', functionName: 'Function', businessUnit: 'Business Unit', location: 'Location',
    domain: 'Domain', status: 'Status', ktStatus: 'KT Status', ktStage: 'KT Stage',
    statusBucket: 'Status', varianceBucket: 'Exit Timing',
    workerType: 'Worker Type', team: 'Team', capability: 'Capability',
    fundingSource: 'Funding', vendorName: 'Vendor'
  };
  var WAVE_LABELS = { W1: 'W1 · Feb–Jun', W2: 'W2 · Jul', W3: 'W3 · Aug', W4: 'W4 · Sep' };

  // ---------- filters ----------
  function activeFilterCount() {
    return METRICS.ALL_DIMS.reduce(function (n, d) { return n + ((FILTERS[d] || []).length ? 1 : 0); }, 0);
  }
  function toggleFilter(dim, value, additive) {
    var cur = FILTERS[dim] || [];
    if (additive) {
      FILTERS[dim] = cur.indexOf(value) >= 0 ? cur.filter(function (v) { return v !== value; }) : cur.concat([value]);
    } else {
      FILTERS[dim] = (cur.length === 1 && cur[0] === value) ? [] : [value];
    }
    if (!FILTERS[dim].length) delete FILTERS[dim];
    updateAll();
  }
  function setFilters(dict) { FILTERS = dict || {}; updateAll(); }
  function clearFilters() { FILTERS = {}; updateAll(); }
  function isSel(dim, value) {
    var f = FILTERS[dim] || [];
    return !f.length || f.indexOf(value) >= 0;
  }
  function fade(colorArr, dim, keys) {
    var f = FILTERS[dim] || [];
    if (!f.length) return colorArr;
    return colorArr.map(function (c, i) { return f.indexOf(keys[i]) >= 0 ? c : alpha(c[0] === '#' ? c : '#09375F', .18); });
  }

  function renderFilterChips() {
    var host = $('#filter-chips'); host.innerHTML = '';
    var any = false;
    METRICS.ALL_DIMS.forEach(function (dim) {
      (FILTERS[dim] || []).forEach(function (v) {
        any = true;
        var chip = document.createElement('span'); chip.className = 'filter-chip';
        var disp = dim === 'wave' ? (WAVE_LABELS[v] || v) : v;
        chip.innerHTML = '<span class="dim">' + esc(DIM_LABELS[dim] || dim) + ':</span> ' + esc(disp);
        var x = document.createElement('button'); x.textContent = '×'; x.setAttribute('aria-label', 'Remove filter');
        x.onclick = function () { toggleFilter(dim, v, true); };
        chip.appendChild(x); host.appendChild(chip);
      });
    });
    if (any) {
      var clear = document.createElement('button'); clear.className = 'clear-all'; clear.textContent = 'Clear all';
      clear.onclick = clearFilters; host.appendChild(clear);
    } else {
      var none = document.createElement('span'); none.style.cssText = 'font-size:12px;color:var(--muted)';
      none.textContent = 'None — click any chart element or use the slicers';
      host.appendChild(none);
    }
    var k = METRICS.kpis(DATA, FILTERS);
    var wf = METRICS.filterWorkforce(DATA, FILTERS).length;
    $('#role-count').innerHTML = 'Showing <b>' + k.inScope + '</b> of <b>' + DATA.roles.length +
      '</b> transition roles · <b>' + wf + '</b> of <b>' + DATA.workforce.length + '</b> workforce positions';
  }

  function renderSlicers() {
    var rail = $('#slicer-rail'); rail.innerHTML =
      '<div style="font-size:10px;font-weight:500;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);padding:0 2px 10px;">Slicers</div>';
    var vals = METRICS.slicerValues(DATA);
    var wfVals = METRICS.workforceSlicerValues(DATA);
    Object.keys(wfVals).forEach(function (k) { vals[k] = wfVals[k]; });
    var groups = [['Transition & shared', METRICS.SLICER_DIMS],
                  ['Workforce', METRICS.WORKFORCE_ONLY_DIMS]];
    groups.forEach(function (grp) {
      var head = document.createElement('div');
      head.className = 'slicer-section';
      head.textContent = grp[0];
      rail.appendChild(head);
      grp[1].forEach(function (dim) {
      var g = document.createElement('div'); g.className = 'slicer-group' + (FILTERS[dim] && FILTERS[dim].length ? ' open' : '');
      var head = document.createElement('button');
      var n = (FILTERS[dim] || []).length;
      head.innerHTML = '<span>' + esc(DIM_LABELS[dim]) + (n ? ' <span class="count-badge">' + n + '</span>' : '') + '</span><span class="slicer-caret">▶</span>';
      head.onclick = function () { g.classList.toggle('open'); };
      g.appendChild(head);
      var opts = document.createElement('div'); opts.className = 'slicer-opts';
      vals[dim].forEach(function (v) {
        var lab = document.createElement('label');
        var cb = document.createElement('input'); cb.type = 'checkbox';
        cb.checked = (FILTERS[dim] || []).indexOf(v) >= 0;
        cb.onchange = function () { toggleFilter(dim, v, true); };
        lab.appendChild(cb);
        var span = document.createElement('span');
        span.textContent = dim === 'wave' ? (WAVE_LABELS[v] || v) : v;
        lab.appendChild(span); opts.appendChild(lab);
      });
      g.appendChild(opts); rail.appendChild(g);
      });
    });
  }

  // ---------- methodology popovers ----------
  var INFO = {
    exited: ['Conversions Exited', 'Basis: Exited — the onshore role has ended and its cost has stopped. Denominator: all in-scope roles. Savings are recognized at exit, not at BPO Hub stabilization; if the program moves to a stabilized basis, every dollar figure changes.'],
    stabilized: ['Conversions Stabilized', 'Knowledge transfer complete and the BPO Hub role is primary support. Denominator: all in-scope roles.'],
    attain: ['Rolloff Attainment', 'Exited roles ÷ roles planned to have exited by the as-of date (time-phased plan, not full-program).'],
    overdue: ['Overdue Rolloffs', 'Roles past their target exit date and not yet exited. Currently concentrated in Wave 2.'],
    delay: ['Average Rolloff Delay', 'Mean days past target exit date across the overdue population only.'],
    ytd: ['YTD Savings Realized', 'Realized savings on the exited basis vs. the time-phased plan-to-date. Calculated from rate arbitrage (onshore cost stopped less BPO Hub cost added) — not invoiced amounts.'],
    proj: ['Projected Year-End', 'YTD actual + remaining planned pipeline × trailing-2Q realization rate. A single-point, pace-adjusted projection — see Savings & Projection for methods and the confidence band.'],
    rate: ['Realization Ratio', 'Actual ÷ planned savings over the trailing two completed quarters. The partial current quarter is excluded.'],
    leak: ['Rolloff Cost Leakage', 'Cumulative onshore cost carried past target exit dates (overdue roles × daily onshore cost × days late). Methodology to be ratified with the data owner — directional today.'],
    risk: ['Savings at Risk', 'Planned savings tied to at-risk or unstarted exits. Methodology to be ratified with the data owner — directional today.'],
    baseCost: ['Baseline Onshore Cost', 'Fully-loaded annualized cost of all in-scope onshore roles (rate × estimated weekly hours). Savings model is rate arbitrage only — no severance, KT, or overlap costs included.'],
    remCost: ['Remaining Onshore Cost', 'Baseline annualized cost less onshore spend eliminated year-to-date. Exits eliminate cost from their exit date forward (time-phased), which is why this exceeds the annualized cost of not-yet-exited roles.'],
    hired: ['Roles Hired & Onboarded', 'BPO Hub backfills hired against the 1:1 replacement plan. Assumes 1:1 output replacement with no ramp-up discount.'],
    covgap: ['Coverage Gap', 'Onshore roles exited before their BPO Hub counterpart stabilized (Exited − Stabilized). A delivery-risk exposure — it does not reduce reported savings because savings recognize at exit.'],
    ktns: ['KT Not Started', 'Roles with no knowledge-transfer activity logged.'],
    planTd: ['YTD Planned', 'Plan time-phased to planned conversion dates — not a day-one lump sum.'],
    varr: ['YTD Variance', 'Actual minus plan-to-date.'],
    gap: ['Gap to Target', 'Projection minus the leadership baseline commitment.'],
    fnTable: ['Headcount & Cost Variance', 'Headcount: exited vs. full-program plan. Cost: realized to date vs. function-allocated full-year plan. RAG: ≥80% green · 40–79% amber · <40% red. The function-allocated plan sums to less than the leadership target — the difference is an unallocated reconciliation gap that should be resolved before the baseline is locked.'],
    quarterly: ['Quarterly Savings', 'Time-phased plan vs. actual by quarter. The current quarter is partial and excluded from the realization ratio. Under an active filter the series is scaled to the filtered population’s share of plan and actuals.'],
    cumulative: ['Cumulative Savings Curve', 'Running total of planned vs. actual savings. The shaded band realizes the remaining pipeline at the historical quarterly rate ±1 standard deviation. Dashed line = selected forecast method.'],
    leakTrend: ['Leakage Trend', 'Cumulative cost of delayed exits by month. Trending it rather than snapshotting makes acceleration visible early. Projection extends the recent monthly pace, damped as the overdue queue clears.'],
    funnel: ['Knowledge Transfer Readiness', 'All in-scope conversions by KT stage. Stabilized = KT complete and BPO Hub is primary support.'],
    scen: ['Scenario Workbench', 'Year-end = YTD actual + remaining pipeline × realization rate, adjusted for exit pace, delay, ramp time, and attrition cost. Sliders recompute live; no scenario is a commitment.'],
    fnfc: ['Per-Function Forecast', 'Each function’s remaining planned savings realized at the program trailing rate (halved for functions with no exits yet). Sorted by dollar gap.'],
    wfTotal: ['Workforce Composition', 'Every position in scope by engagement type: FTE, individual contractor, vendor-supplied, and BPO Hub. Source is the roster combined with the contracting register.'],
    wfRatio: ['FTE Share vs. 70/30 Target', 'FTE divided by total workforce. Whether the BPO Hub counts in the denominator is a policy switch on the Metric Dictionary page — it changes the answer, so it is never implicit here.'],
    wfDefinition: ['Definition Check', 'The same roster measured two ways. Under one definition the programme is on target; under the other it is not. Nothing about the people changes. This exists so the definition gets an owner and a decision.'],
    wfVendor: ['Vendor Footprint', 'Distinct vendors supplying people, and how many teams each appears in. A team carrying several vendors pays a coordination and contract-management cost that rarely appears in any budget line.'],
    wfCliff: ['Contract Cliff', 'Non-FTE positions whose contract ends inside the policy window. Procurement lead times are typically longer than the window, so anything here is already urgent.'],
    wfLocation: ['Location Alignment', 'The share of a domain sitting in its single largest location. A domain split across four sites carries coordination cost and handover risk that a headcount number alone will not show.'],
    wftForecast: ['Workforce Forecast', 'Historical monthly actuals followed by a forecast. Forecast segments are dashed. This is a planning curve, not a commitment — it assumes current hiring and attrition patterns hold.'],
    wpFunding: ['Requirement, Funding and Assignment', 'Three separate numbers that are usually tracked in three separate places: what the work requires, what has been funded, and what is actually assigned to a person. The gaps between them are the point.'],
    wpCoverage: ['Capability Coverage', 'People holding each capability, and how many teams it spans. One person holding a capability is a single point of failure. The same capability spread very widely may be duplication — or may be appropriate. Both need a human judgement.'],
    wmInitiative: ['Initiative Health', 'RAG status, required versus assigned headcount, and dependency position for every initiative in scope. Resource gap is required minus assigned.'],
    wmDependency: ['Dependency Management', 'An initiative is flagged blocked when something it depends on is neither complete nor green. Dependency chips turn red when that upstream item is the blocker.'],
    wmTrigger: ['Resource Trigger Points', 'Thresholds agreed in advance so a decision is automatic rather than debated. When a trigger fires, the named action happens.'],
    wmAction: ['Action Items', 'Open commitments with an owner and a due date. Overdue means past due and not closed, measured against the as-of date.'],
    wmNotes: ['AI-Assisted Note Analysis', 'Free-text status notes are scanned against a maintained keyword set grouped into themes, then weighted by status, priority and how overdue an item is. Deterministic and explainable — it cannot invent a risk that is not in the text. In production this becomes a language model behind the same interface.'],
    mdSwitches: ['Definition Switches', 'These change real calculations across every page. They exist because project managers reported being unable to explain how several headline metrics are derived — the fix is to make each choice visible and owned rather than buried in code.'],
    mdDictionary: ['Metric Dictionary', 'One row per metric: what it means, how it is calculated, where the data comes from, who owns the definition, and its current value. This is the reference a certified semantic model would eventually enforce.'],
    intMap: ['Integration Map', 'Target ecosystem. A single governed backend feeds every front end, so the dashboard, the delivery tracker and the planning submission cannot quote different numbers.'],
    intExport: ['Live Exports', 'Real files in the shape each destination expects, generated from the current filtered view in your browser. Nothing is transmitted anywhere.'],
    scenResources: ['Scenario Resource Drill-Down', 'Capability demand from in-flight initiatives against uncommitted capacity only — someone already assigned to an initiative cannot staff a scenario twice. Scales with the exit pace lever.'],
    storyline: ['AI-generated storyline', 'Generated by a deterministic narrative engine over the same metrics layer as every chart, so it can never contradict a visual. Regenerates on every filter or data change. In production this swaps to a live LLM call behind the same metrics guardrail.']
  };
  function infoBtn(key) { return '<button class="info-btn" data-info="' + key + '" aria-label="Methodology">i</button>'; }
  function bindInfoPops(root) {
    $$('.info-btn', root).forEach(function (btn) {
      btn.onclick = function (e) {
        e.stopPropagation();
        var pop = $('#info-pop'), item = INFO[btn.dataset.info];
        if (!item) return;
        pop.innerHTML = '<h5>' + esc(item[0]) + ' — methodology & assumptions</h5>' + esc(item[1]);
        pop.classList.add('open');
        var r = btn.getBoundingClientRect();
        pop.style.top = Math.min(window.innerHeight - 190, r.bottom + 8) + 'px';
        pop.style.left = Math.max(10, Math.min(window.innerWidth - 315, r.left - 140)) + 'px';
      };
    });
  }
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.info-btn') && !e.target.closest('#info-pop')) $('#info-pop').classList.remove('open');
    if (!e.target.closest('#admin-slot')) { var m = $('#actions-menu'); if (m) m.classList.remove('open'); }
  });

  // ---------- KPI card helpers ----------
  function kpiCard(id, title, infoKey) {
    return '<div class="kpi-card">' + infoBtn(infoKey) + '<h4>' + title + '</h4>' +
      '<div class="kpi-value" id="kv-' + id + '">—</div><div class="kpi-sub" id="ks-' + id + '"></div></div>';
  }
  function setKpi(id, valueHtml, subHtml, cls) {
    var v = $('#kv-' + id); if (!v) return;
    v.innerHTML = valueHtml; v.className = 'kpi-value' + (cls ? ' ' + cls : '');
    $('#ks-' + id).innerHTML = subHtml || '';
  }

  // ---------- page structure (built once) ----------
  function storylineBlock(page) {
    return '<div class="storyline" id="sl-' + page + '">' +
      '<div class="story-head"><h4>Storyline</h4><span class="ai-pill" id="sl-pill-' + page + '">AI-generated</span>' +
      '<button class="info-btn inline-info" data-info="storyline" aria-label="How this is generated">i</button></div>' +
      '<div class="story-body" id="sl-body-' + page + '"></div>' +
      '<button class="what-changed-toggle" data-page="' + page + '">What changed vs. prior dataset ▾</button>' +
      '<div class="what-changed" id="wc-' + page + '"></div></div>';
  }
  function panelHead(title, caption, infoKey, moreDim) {
    return '<div class="panel-head"><div class="titles"><h3>' + title + '</h3>' +
      '<div class="caption">' + caption + '</div></div>' +
      (moreDim ? '<button class="more-btn" data-drill="' + moreDim + '" title="Drill through">⋯</button>' : '') +
      '<button class="info-btn inline-info" data-info="' + infoKey + '" aria-label="Methodology">i</button></div>';
  }

  function buildStructure() {
    $('#p1-body').innerHTML =
      storylineBlock(1) +
      '<div class="kpi-row">' +
        kpiCard('exited', 'Conversions Exited', 'exited') + kpiCard('stab', 'Conversions Stabilized', 'stabilized') +
        kpiCard('attain', 'Rolloff Attainment', 'attain') + kpiCard('overdue', 'Overdue Rolloffs', 'overdue') +
        kpiCard('delay', 'Average Rolloff Delay', 'delay') + '</div>' +
      '<div class="kpi-row">' +
        kpiCard('ytd', 'YTD Savings Realized', 'ytd') + kpiCard('proj', 'Projected Year-End', 'proj') +
        kpiCard('rate', 'Realization Ratio', 'rate') + kpiCard('leak', 'Rolloff Cost Leakage', 'leak') +
        kpiCard('risk', 'Savings at Risk', 'risk') + '</div>' +
      '<div class="chart-grid thirds">' +
        '<div class="panel">' + panelHead('Conversion Status (RAG)', 'All in-scope conversions — mutually exclusive buckets', 'exited') +
          '<div class="chart-box" style="height:210px"><canvas id="c-donut"></canvas></div></div>' +
        '<div class="panel">' + panelHead('Planned vs. Actual Exits by Wave', 'Planned sums to full program · actual on exited basis', 'attain', 'wave') +
          '<div class="chart-box" style="height:210px"><canvas id="c-waves"></canvas></div></div>' +
        '<div class="panel">' + panelHead('Exit Date Variance', 'Days early / late vs. target exit date · exited roles', 'delay') +
          '<div class="chart-box" style="height:186px"><canvas id="c-hist"></canvas></div>' +
          '<div class="chart-note" id="hist-note"></div></div>' +
      '</div>';

    $('#p2-body').innerHTML =
      storylineBlock(2) +
      '<div class="kpi-row">' +
        kpiCard('o-hc', 'Baseline Onshore Headcount', 'exited') + kpiCard('o-cost', 'Baseline Onshore Cost', 'baseCost') +
        kpiCard('o-rem', 'Remaining Onshore Cost', 'remCost') + kpiCard('o-leak', 'Rolloff Cost Leakage', 'leak') +
        kpiCard('o-risk', 'Savings at Risk', 'risk') + '</div>' +
      '<div class="chart-grid">' +
        '<div class="panel">' + panelHead('Baseline Headcount by Function', 'Anonymized function grouping', 'baseCost', 'functionName') +
          '<div class="chart-box" style="height:430px"><canvas id="c-fnhc"></canvas></div></div>' +
        '<div class="panel">' + panelHead('Roles by Conversion Wave', 'Planned exits per wave, colored by wave state', 'attain', 'wave') +
          '<div class="chart-box" style="height:190px"><canvas id="c-wavestack"></canvas></div>' +
          '<div class="chart-note" id="wave-note"></div></div>' +
      '</div>' +
      '<div class="panel">' + panelHead('Rolloff Cost Leakage Trend', 'Cumulative leakage by month — trending it makes acceleration visible early', 'leakTrend') +
        '<div class="chart-box" style="height:200px"><canvas id="c-leak"></canvas></div>' +
        '<div class="chart-note" id="leak-note"></div></div>';

    $('#p3-body').innerHTML =
      storylineBlock(3) +
      '<div class="kpi-row">' +
        kpiCard('b-hired', 'Roles Hired & Onboarded', 'hired') + kpiCard('b-stab', 'Roles Stabilized', 'stabilized') +
        kpiCard('b-exited', 'Onshore Roles Exited', 'exited') + kpiCard('b-gap', 'Coverage Gap', 'covgap') +
        kpiCard('b-ktns', 'KT Not Started', 'ktns') + '</div>' +
      '<div class="chart-grid">' +
        '<div class="panel">' + panelHead('Knowledge Transfer Readiness', 'All in-scope conversions by KT stage', 'funnel') +
          '<div class="chart-box" style="height:250px"><canvas id="c-funnel"></canvas></div></div>' +
        '<div class="panel">' + panelHead('BPO Hub Headcount by Function', 'Mirrors the onshore function grouping · hired roles', 'hired', 'functionName') +
          '<div class="chart-box" style="height:250px"><canvas id="c-bpofn"></canvas></div></div>' +
      '</div>';

    $('#p4-body').innerHTML =
      storylineBlock(4) +
      '<div class="panel">' + panelHead('Headcount & Cost Variance by Function',
        'Click a row to cross-filter · thresholds ≥80% green · 40–79% amber · <40% red', 'fnTable') +
        '<div style="overflow-x:auto"><div id="t-variance"></div></div>' +
        '<div class="chart-note" id="reconcile-note"></div></div>';

    $('#p5-body').innerHTML =
      storylineBlock(5) +
      '<div class="kpi-row">' +
        kpiCard('s-plan', 'YTD Planned', 'planTd') + kpiCard('s-act', 'YTD Actual', 'ytd') +
        kpiCard('s-var', 'YTD Variance', 'varr') + kpiCard('s-proj', 'Projected Year-End', 'proj') +
        kpiCard('s-gap', 'Gap to Target', 'gap') + '</div>' +
      '<div class="chart-grid">' +
        '<div class="panel">' + panelHead('Quarterly Savings: Planned vs. Actual', 'Current quarter shown as partial and excluded from the realization ratio', 'quarterly') +
          '<div class="chart-box" style="height:230px"><canvas id="c-qtr"></canvas></div></div>' +
        '<div class="panel">' + panelHead('Cumulative Savings Curve & Forecast', 'Confidence band vs. the target line', 'cumulative') +
          '<div class="forecast-picker" id="fc-picker"></div>' +
          '<div class="chart-box" style="height:200px"><canvas id="c-cum"></canvas></div>' +
          '<div class="method-note" id="fc-note"></div></div>' +
      '</div>' +
      '<div class="chart-grid">' +
        '<div class="panel">' + panelHead('Cost Leakage Forecast', 'Existing trend extended forward', 'leakTrend') +
          '<div class="chart-box" style="height:190px"><canvas id="c-leakfc"></canvas></div>' +
          '<div class="method-note" id="leakfc-note"></div></div>' +
        '<div class="panel">' + panelHead('Per-Function Year-End Forecast', 'Sorted by dollar gap, descending', 'fnfc', 'functionName') +
          '<div style="overflow-x:auto;max-height:230px;overflow-y:auto"><div id="t-fnfc"></div></div>' +
          '<div class="chart-note" id="anomaly-note"></div></div>' +
      '</div>' +
      '<div class="panel">' + panelHead('Scenario Workbench — Year-End Projection', 'Adjust the levers; everything recomputes live. Formula: YTD actual + remaining pipeline × realization, with pace / delay / ramp / attrition adjustments.', 'scen') +
        '<div class="scen-grid" id="scen-grid"></div>' +
        '<div class="chart-grid" style="margin-bottom:0">' +
          '<div><div class="chart-box" style="height:210px"><canvas id="c-scen"></canvas></div></div>' +
          '<div><div id="t-scen" style="overflow-x:auto"></div><div class="sensitivity" id="sens-note"></div>' +
          '<div class="scen-tools"><button class="btn-ghost" id="scen-reset">Reset to defaults</button>' +
          '<button class="btn-ghost" id="scen-save">Save scenario set…</button>' +
          '<select id="scen-load" style="border:1px solid var(--hairline-strong);border-radius:6px;padding:6px 10px;font-size:11.5px;color:var(--onyx)"><option value="">Load saved…</option></select></div></div>' +
        '</div></div>' +
      '<div class="panel">' + panelHead('Scenario Resource Drill-Down',
        'Which capabilities a scenario actually needs, and whether uncommitted people exist to staff it', 'scenResources') +
        '<div id="scen-resources"></div></div>';

    if (window.APPX) APPX.buildPages();
    buildScenarioCards();
    buildForecastPicker();
    bindInfoPops(document);
    $$('.what-changed-toggle').forEach(function (btn) {
      btn.onclick = function () { $('#wc-' + btn.dataset.page).classList.toggle('open'); };
    });
    $$('.more-btn').forEach(function (btn) {
      btn.onclick = function (e) {
        e.stopPropagation();
        gotoPage(4);
        toast('Drill-through: Variance Detail' + (activeFilterCount() ? ' (filters applied)' : ''));
      };
    });
    buildCharts();
  }

  // ---------- Chart.js setup ----------
  function buildCharts() {
    Chart.defaults.font.family = "'Poppins', Arial, sans-serif";
    Chart.defaults.font.size = 11;
    Chart.defaults.color = C.onyx;
    Chart.defaults.animation.duration = 250;
    Chart.defaults.plugins.tooltip.backgroundColor = C.blue;
    Chart.defaults.plugins.tooltip.cornerRadius = 6;
    Chart.defaults.plugins.tooltip.titleFont = { weight: 500 };

    var moneyTick = function (v) { return v >= 1e6 ? '$' + (v / 1e6) + 'M' : '$' + Math.round(v / 1e3) + 'K'; };

    CHARTS.donut = new Chart($('#c-donut'), {
      type: 'doughnut',
      data: { labels: [], datasets: [{ data: [], backgroundColor: [], borderWidth: 2, borderColor: '#FFFFFF' }] },
      options: {
        maintainAspectRatio: false, cutout: '58%',
        onClick: chartClick('statusBucket'),
        plugins: { legend: { position: 'right', labels: { boxWidth: 10, boxHeight: 10, padding: 10 } } }
      }
    });

    CHARTS.waves = new Chart($('#c-waves'), {
      type: 'bar',
      data: { labels: [], datasets: [
        { label: 'Planned', data: [], backgroundColor: [], borderRadius: 3 },
        { label: 'Actual (exited)', data: [], backgroundColor: [], borderRadius: 3 }
      ] },
      options: {
        maintainAspectRatio: false,
        onClick: chartClick('wave'),
        scales: { y: { beginAtZero: true, grid: { color: C.hairline } }, x: { grid: { display: false } } },
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, boxHeight: 10 } } }
      }
    });

    CHARTS.hist = new Chart($('#c-hist'), {
      type: 'bar',
      data: { labels: [], datasets: [{ data: [], backgroundColor: [], borderRadius: 3 }] },
      options: {
        maintainAspectRatio: false,
        onClick: chartClick('varianceBucket'),
        scales: { y: { beginAtZero: true, grid: { color: C.hairline } }, x: { grid: { display: false } } },
        plugins: { legend: { display: false } }
      }
    });

    CHARTS.fnhc = new Chart($('#c-fnhc'), {
      type: 'bar',
      data: { labels: [], datasets: [{ data: [], backgroundColor: [], borderRadius: 3 }] },
      options: {
        indexAxis: 'y', maintainAspectRatio: false,
        onClick: chartClick('functionName'),
        scales: { x: { beginAtZero: true, grid: { color: C.hairline } }, y: { grid: { display: false } } },
        plugins: { legend: { display: false } }
      }
    });

    CHARTS.wavestack = new Chart($('#c-wavestack'), {
      type: 'bar',
      data: { labels: [], datasets: [{ data: [], backgroundColor: [], borderRadius: 3 }] },
      options: {
        indexAxis: 'y', maintainAspectRatio: false,
        onClick: chartClick('wave'),
        scales: { x: { beginAtZero: true, grid: { color: C.hairline } }, y: { grid: { display: false } } },
        plugins: { legend: { display: false } }
      }
    });

    CHARTS.leak = new Chart($('#c-leak'), {
      type: 'line',
      data: { labels: [], datasets: [{
        label: 'Cumulative leakage', data: [], borderColor: C.gold, backgroundColor: alpha(C.gold, .15),
        fill: true, tension: .3, pointBackgroundColor: C.gold, pointBorderColor: C.blue, pointRadius: 4
      }] },
      options: {
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true, ticks: { callback: moneyTick }, grid: { color: C.hairline } }, x: { grid: { display: false } } },
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return fmt$(c.parsed.y); } } } }
      }
    });

    CHARTS.funnel = new Chart($('#c-funnel'), {
      type: 'bar',
      data: { labels: [], datasets: [{ data: [], backgroundColor: [], borderRadius: 3 }] },
      options: {
        indexAxis: 'y', maintainAspectRatio: false,
        onClick: chartClick('ktStage', function (label) {
          return label === 'Stabilized (complete)' ? 'Complete' : label;
        }),
        scales: { x: { beginAtZero: true, grid: { color: C.hairline } }, y: { grid: { display: false } } },
        plugins: { legend: { display: false } }
      }
    });

    CHARTS.bpofn = new Chart($('#c-bpofn'), {
      type: 'bar',
      data: { labels: [], datasets: [{ data: [], backgroundColor: [], borderRadius: 3 }] },
      options: {
        indexAxis: 'y', maintainAspectRatio: false,
        onClick: chartClick('functionName'),
        scales: { x: { beginAtZero: true, grid: { color: C.hairline } }, y: { grid: { display: false } } },
        plugins: { legend: { display: false } }
      }
    });

    CHARTS.qtr = new Chart($('#c-qtr'), {
      type: 'bar',
      data: { labels: [], datasets: [
        { label: 'Planned', data: [], backgroundColor: [], borderRadius: 3 },
        { label: 'Actual', data: [], backgroundColor: [], borderRadius: 3 }
      ] },
      options: {
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true, ticks: { callback: moneyTick }, grid: { color: C.hairline } }, x: { grid: { display: false } } },
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, boxHeight: 10 } },
          tooltip: { callbacks: { label: function (c) { return c.dataset.label + ': ' + fmt$(c.parsed.y); } } } }
      }
    });

    CHARTS.cum = new Chart($('#c-cum'), {
      type: 'line', data: { labels: [], datasets: [] },
      options: {
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true, ticks: { callback: moneyTick }, grid: { color: C.hairline } }, x: { grid: { display: false } } },
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, boxHeight: 10, filter: function (i) { return !/band/i.test(i.text); } } },
          tooltip: { callbacks: { label: function (c) { return c.dataset.label + ': ' + (c.parsed.y == null ? '—' : fmt$(c.parsed.y)); } } } }
      }
    });

    CHARTS.leakfc = new Chart($('#c-leakfc'), {
      type: 'line', data: { labels: [], datasets: [] },
      options: {
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true, ticks: { callback: moneyTick }, grid: { color: C.hairline } }, x: { grid: { display: false } } },
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return fmt$(c.parsed.y); } } } }
      }
    });

    buildV2Charts();
    CHARTS.scen = new Chart($('#c-scen'), {
      type: 'line', data: { labels: [], datasets: [] },
      options: {
        maintainAspectRatio: false, animation: { duration: 80 },
        scales: { y: { beginAtZero: true, ticks: { callback: moneyTick }, grid: { color: C.hairline } }, x: { grid: { display: false } } },
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, boxHeight: 10 } },
          tooltip: { callbacks: { label: function (c) { return c.dataset.label + ': ' + (c.parsed.y == null ? '—' : fmt$(c.parsed.y)); } } } }
      }
    });
  }

  function buildV2Charts() {
    if (window.APPX) APPX.buildCharts(C, SERIES, alpha, chartClick);
  }

  function chartClick(dim, mapLabel) {
    return function (evt, elements, chart) {
      if (!elements.length) {
        if (FILTERS[dim] && FILTERS[dim].length) { delete FILTERS[dim]; updateAll(); }
        return;
      }
      var i = elements[0].index;
      var label = chart.data.labels[i];
      var value = mapLabel ? mapLabel(label) : label;
      if (dim === 'wave') {
        var m = Object.keys(WAVE_LABELS).filter(function (k) { return WAVE_LABELS[k] === label; });
        value = m.length ? m[0] : label;
      }
      toggleFilter(dim, value, evt.native && (evt.native.ctrlKey || evt.native.metaKey));
    };
  }

  // ---------- update everything ----------
  function updateAll() {
    var k = METRICS.kpis(DATA, FILTERS);
    var empty = k.inScope === 0;
    renderFilterChips(); renderSlicers();

    // page 1 KPIs
    setKpi('exited', empty ? '—' : k.exited + ' <small>/ ' + k.inScope + '</small>', empty ? 'No roles match the current filters' : fmtPct(k.exitedPct) + ' of filtered population');
    setKpi('stab', empty ? '—' : k.stabilized + ' <small>/ ' + k.inScope + '</small>', empty ? '' : fmtPct(k.stabilizedPct) + ' — KT complete');
    setKpi('attain', empty ? '—' : fmtPct(k.rolloffAttainment), empty ? '' : k.exited + ' exited vs. ' + k.plannedToDate + ' planned to date');
    setKpi('overdue', empty ? '—' : String(k.overdue), 'past target date, not yet exited', k.overdue ? 'bad' : '');
    setKpi('delay', empty ? '—' : k.avgDelayDays + ' <small>days</small>', 'mean variance · overdue population only');
    setKpi('ytd', empty ? '—' : fmtM(k.realizedUSD) + ' <small>/ ' + fmtM(k.planToDateUSD) + ' plan</small>',
      empty ? '' : '<span class="bad">' + fmt$(k.varianceUSD) + ' · ' + Math.round(k.behindPct * 100) + '% behind plan-to-date</span>');
    setKpi('proj', empty ? '—' : fmtM(k.projectedYearEndUSD) + ' <small>/ ' + fmtM(k.targetUSD) + ' target</small>',
      empty ? '' : '<span class="warn">' + fmt$(k.gapToTargetUSD) + ' gap · pace-adjusted</span>');
    setKpi('rate', fmtPct(k.realizationRate), 'trailing 2 completed quarters');
    setKpi('leak', empty ? '—' : fmt$(k.leakageUSD), 'cost of delayed exits, cumulative', 'warn');
    setKpi('risk', empty ? '—' : fmt$(k.savingsAtRiskUSD), 'tied to at-risk / unstarted exits', 'bad');

    // page 2 KPIs
    setKpi('o-hc', empty ? '—' : String(k.inScope), 'roles in conversion scope');
    setKpi('o-cost', empty ? '—' : fmtM(k.baselineOnshoreCostUSD), 'fully-loaded, annualized');
    setKpi('o-rem', empty ? '—' : fmtM(k.remainingOnshoreCostUSD), empty ? '' : k.notExited + ' roles not yet exited');
    setKpi('o-leak', empty ? '—' : fmt$(k.leakageUSD), 'cumulative cost of delayed exits', 'warn');
    setKpi('o-risk', empty ? '—' : fmt$(k.savingsAtRiskUSD), 'tied to at-risk / unstarted exits', 'bad');

    // page 3 KPIs
    setKpi('b-hired', empty ? '—' : k.hired + ' <small>/ ' + k.hiredPlanned + '</small>',
      empty ? '' : fmtPct(k.hired / (k.hiredPlanned || 1)) + ' of planned backfills · <span class="good">' + fmtPct(k.hireOnTimePct) + ' started on time</span>');
    setKpi('b-stab', empty ? '—' : k.stabilized + ' <small>/ ' + k.inScope + '</small>', empty ? '' : fmtPct(k.stabilizedPct) + ' — KT complete');
    setKpi('b-exited', empty ? '—' : k.exited + ' <small>/ ' + k.inScope + '</small>', empty ? '' : fmtPct(k.exitedPct) + ' of onshore footprint');
    setKpi('b-gap', empty ? '—' : String(k.coverageGap), 'exited before BPO Hub role stabilized', 'bad');
    setKpi('b-ktns', empty ? '—' : String(k.ktNotStarted), 'no knowledge-transfer activity logged', 'warn');

    // page 5 KPIs
    setKpi('s-plan', empty ? '—' : fmtM(k.planToDateUSD), 'time-phased to conversion dates');
    setKpi('s-act', empty ? '—' : fmtM(k.realizedUSD), 'realized on exited basis');
    setKpi('s-var', empty ? '—' : fmt$(k.varianceUSD), Math.round(k.behindPct * 100) + '% behind plan-to-date', 'bad');
    setKpi('s-proj', empty ? '—' : fmtM(k.projectedYearEndUSD), fmtM(k.realizedUSD) + ' + (' + fmtM(k.remainingPipelineUSD) + ' × ' + fmtPct(k.realizationRate) + ')');
    setKpi('s-gap', empty ? '—' : fmt$(k.gapToTargetUSD), 'vs. ' + fmtM(k.targetUSD) + ' baseline commitment', 'bad');

    updateCharts(k, empty);
    if (window.APPX) APPX.update(FILTERS);
    renderVarianceTable();
    renderForecast();
    renderScenarios();
    renderStorylines(k);
    renderDataStamp();
  }

  function updateCharts(k, empty) {
    // donut
    var sb = METRICS.statusBuckets(DATA, FILTERS);
    var sbKeys = Object.keys(sb);
    var sbColors = [C.jade, C.verd, C.gold, C.jasper];
    CHARTS.donut.data.labels = sbKeys.map(function (kk) { return kk + ' — ' + sb[kk]; });
    CHARTS.donut.data.datasets[0].data = sbKeys.map(function (kk) { return sb[kk]; });
    CHARTS.donut.data.datasets[0].backgroundColor = fade(sbColors, 'statusBucket', sbKeys);
    CHARTS.donut.update();

    // waves clustered
    var waves = METRICS.byWave(DATA, FILTERS);
    var wKeys = waves.map(function (w) { return w.wave; });
    CHARTS.waves.data.labels = waves.map(function (w) { return w.label; });
    CHARTS.waves.data.datasets[0].data = waves.map(function (w) { return w.planned; });
    CHARTS.waves.data.datasets[1].data = waves.map(function (w) { return w.actual; });
    CHARTS.waves.data.datasets[0].backgroundColor = fade(waves.map(function () { return C.verd; }), 'wave', wKeys);
    CHARTS.waves.data.datasets[1].backgroundColor = fade(waves.map(function () { return C.blue; }), 'wave', wKeys);
    CHARTS.waves.update();

    // histogram
    var h = METRICS.exitVarianceHist(DATA, FILTERS);
    var hKeys = h.buckets.map(function (b) { return b.label; });
    CHARTS.hist.data.labels = hKeys;
    CHARTS.hist.data.datasets[0].data = h.buckets.map(function (b) { return b.n; });
    CHARTS.hist.data.datasets[0].backgroundColor = fade(
      [C.blue, C.blue, C.jade, C.jasper, C.jasper], 'varianceBucket', hKeys);
    CHARTS.hist.update();
    $('#hist-note').innerHTML = empty ? '' : 'On-time-or-early rate: <b>' + fmtPct(h.onTimeOrEarlyPct) + '</b> (' + h.onTimeOrEarly + ' of ' + h.exited + ' exited)';

    // function headcount (onshore)
    var fns = METRICS.byDimension(DATA, FILTERS, 'functionName');
    var fnKeys = fns.map(function (f) { return f.key; });
    CHARTS.fnhc.data.labels = fnKeys;
    CHARTS.fnhc.data.datasets[0].data = fns.map(function (f) { return f.headcount; });
    CHARTS.fnhc.data.datasets[0].backgroundColor = fade(fns.map(function () { return C.blue; }), 'functionName', fnKeys);
    CHARTS.fnhc.update();

    // roles by wave (colored by wave state)
    var waveColors = { W1: C.jade, W2: C.jasper, W3: C.gold, W4: C.verd };
    CHARTS.wavestack.data.labels = waves.map(function (w) { return w.label; });
    CHARTS.wavestack.data.datasets[0].data = waves.map(function (w) { return w.planned; });
    CHARTS.wavestack.data.datasets[0].backgroundColor = fade(waves.map(function (w) { return waveColors[w.wave]; }), 'wave', wKeys);
    CHARTS.wavestack.update();
    $('#wave-note').innerHTML = empty ? '' : 'Not yet exited: <b>' + k.notExited + ' roles</b> · of which <b>' + k.overdue + '</b> overdue (labels state wave status; color is supporting only)';

    // leakage trend
    var lk = METRICS.leakageTrend(DATA, FILTERS);
    CHARTS.leak.data.labels = lk.map(function (p) { return p.month; });
    CHARTS.leak.data.datasets[0].data = lk.map(function (p) { return p.cumulativeUSD; });
    CHARTS.leak.update();
    var lastTwo = lk.slice(-3), firstThree = lk.slice(0, 3);
    $('#leak-note').innerHTML = empty ? '' :
      'Leakage is accelerating — the last three months added <b>' +
      fmt$(lk[lk.length - 1].cumulativeUSD - lk[Math.max(0, lk.length - 4)].cumulativeUSD) +
      '</b> vs. <b>' + fmt$(firstThree[firstThree.length - 1].cumulativeUSD) + '</b> in the first three.';

    // KT funnel
    var fun = METRICS.ktFunnel(DATA, FILTERS);
    var funKeys = fun.map(function (s) { return s.stage; });
    var funColors = [alpha(C.blue, .25), C.jasper, C.gold, C.gold, C.sky, C.jade];
    CHARTS.funnel.data.labels = funKeys;
    CHARTS.funnel.data.datasets[0].data = fun.map(function (s) { return s.n; });
    CHARTS.funnel.data.datasets[0].backgroundColor = fade(funColors, 'ktStage',
      fun.map(function (s) { return s.stage === 'Stabilized (complete)' ? 'Complete' : s.stage; }));
    CHARTS.funnel.update();

    // BPO Hub headcount by function (hired roles only)
    var bfns = METRICS.byDimension(DATA, FILTERS, 'functionName', { hiredOnly: true });
    var bKeys = bfns.map(function (f) { return f.key; });
    CHARTS.bpofn.data.labels = bKeys;
    CHARTS.bpofn.data.datasets[0].data = bfns.map(function (f) { return f.headcount; });
    CHARTS.bpofn.data.datasets[0].backgroundColor = fade(bfns.map(function () { return C.verd; }), 'functionName', bKeys);
    CHARTS.bpofn.update();

    // quarterly
    var q = METRICS.quarterly(DATA, FILTERS).filter(function (p) { return !p.future; });
    CHARTS.qtr.data.labels = q.map(function (p) { return p.period + (p.partial ? ' · partial' : ''); });
    CHARTS.qtr.data.datasets[0].data = q.map(function (p) { return p.plannedUSD; });
    CHARTS.qtr.data.datasets[1].data = q.map(function (p) { return p.actualUSD; });
    CHARTS.qtr.data.datasets[0].backgroundColor = q.map(function (p) { return alpha(C.verd, p.partial ? .45 : 1); });
    CHARTS.qtr.data.datasets[1].backgroundColor = q.map(function (p) { return alpha(C.blue, p.partial ? .45 : 1); });
    CHARTS.qtr.update();
  }

  // ---------- variance table (page 4) ----------
  function renderVarianceTable() {
    var fv = METRICS.functionVariance(DATA, FILTERS);
    var host = $('#t-variance');
    if (!fv.rows.length) { host.innerHTML = '<div class="empty-state">No roles match the current filters. <button class="clear-all" onclick="APP.clearFilters()">Clear all filters</button></div>'; $('#reconcile-note').innerHTML = ''; return; }
    var isAdmin = SESSION && SESSION.role === 'Admin';
    var html = '<table class="matrix"><thead><tr><th rowspan="2">Function</th>' +
      '<th class="grp" colspan="3">Headcount</th><th class="grp" colspan="4">Savings ($K)</th><th rowspan="2">Status</th>' +
      (isAdmin ? '<th rowspan="2"></th>' : '') + '</tr>' +
      '<tr><th style="text-align:right">Plan</th><th style="text-align:right">Exited</th><th style="text-align:right">Attain</th>' +
      '<th style="text-align:right">Planned</th><th style="text-align:right">Actual</th><th style="text-align:right">Variance</th><th style="text-align:right">Attain</th></tr></thead><tbody>';
    var sel = FILTERS.functionName || [];
    fv.rows.forEach(function (r) {
      var rowCls = 'clickable' + (sel.length ? (sel.indexOf(r.functionName) >= 0 ? ' selected' : ' dimmed') : '');
      html += '<tr class="' + rowCls + '" data-fn="' + esc(r.functionName) + '">' +
        '<td>' + esc(r.functionName) + '</td>' +
        '<td class="num">' + r.plan + '</td><td class="num">' + r.exited + '</td><td class="num">' + fmtPct(r.attainment) + '</td>' +
        '<td class="num">' + Math.round(r.plannedK).toLocaleString() + '</td><td class="num">' + Math.round(r.actualK).toLocaleString() + '</td>' +
        '<td class="num"' + (r.varianceK < 0 ? ' style="color:var(--jasper)"' : '') + '>' + Math.round(r.varianceK).toLocaleString() + '</td>' +
        '<td class="num">' + fmtPct(r.savingsAttainment) + '</td>' +
        '<td><span class="rag-pill rag-' + r.rag + '">' + r.rag + '</span></td>' +
        (isAdmin ? '<td>' + (r.rag !== 'Green' ? '<button class="take-action-btn" data-action-fn="' + esc(r.functionName) + '">Take action</button>' : '') + '</td>' : '') +
        '</tr>';
    });
    var t = fv.totals;
    html += '<tr class="totals"><td>Total — allocated to function</td><td class="num">' + t.plan + '</td><td class="num">' + t.exited + '</td>' +
      '<td class="num">' + fmtPct(t.attainment) + '</td><td class="num">' + Math.round(t.plannedK).toLocaleString() + '</td>' +
      '<td class="num">' + Math.round(t.actualK).toLocaleString() + '</td><td class="num" style="color:var(--jasper)">' + Math.round(t.varianceK).toLocaleString() + '</td>' +
      '<td class="num">' + fmtPct(t.savingsAttainment) + '</td><td><span class="rag-pill rag-' + t.rag + '">' + t.rag + '</span></td>' + (isAdmin ? '<td></td>' : '') + '</tr>';
    if (fv.reconcileK > 1) {
      html += '<tr class="reconcile"><td colspan="4">Reconciliation gap — leadership target not yet allocated to any function</td>' +
        '<td class="num">' + Math.round(fv.reconcileK).toLocaleString() + '</td><td class="num">—</td><td class="num">—</td><td class="num">—</td>' +
        '<td><span class="rag-pill" style="border:1px solid var(--amber-text);color:var(--amber-text)">Open</span></td>' + (isAdmin ? '<td></td>' : '') + '</tr>';
      html += '<tr class="totals"><td>Leadership target (baseline commitment)</td><td class="num">' + t.plan + '</td><td class="num">' + t.exited + '</td>' +
        '<td class="num">' + fmtPct(t.attainment) + '</td><td class="num">' + Math.round(fv.targetK).toLocaleString() + '</td>' +
        '<td class="num">' + Math.round(t.actualK).toLocaleString() + '</td>' +
        '<td class="num" style="color:var(--jasper)">' + Math.round(t.actualK - fv.targetK).toLocaleString() + '</td>' +
        '<td class="num">' + fmtPct(fv.targetAttainment) + '</td><td><span class="rag-pill rag-Red">Red</span></td>' + (isAdmin ? '<td></td>' : '') + '</tr>';
    }
    html += '</tbody></table>';
    host.innerHTML = html;
    $('#reconcile-note').innerHTML = fv.reconcileK > 1 ?
      '<b>Reconciliation note:</b> function-level planned savings sum to <b>' + fmt$(t.plannedK * 1000) + '</b> against a <b>' +
      fmt$(fv.targetK * 1000) + '</b> leadership commitment. The <b>' + fmt$(fv.reconcileK * 1000) +
      '</b> difference is not attributable to any function — either an allocation gap in the plan or an over-commitment in the target. Resolve before treating the baseline as locked.' : '';
    $$('#t-variance tr.clickable').forEach(function (tr) {
      tr.onclick = function (e) {
        if (e.target.closest('.take-action-btn')) return;
        toggleFilter('functionName', tr.dataset.fn, e.ctrlKey || e.metaKey);
      };
    });
    $$('#t-variance .take-action-btn').forEach(function (btn) {
      btn.onclick = function (e) { e.stopPropagation(); ADMIN.flagForReview(btn.dataset.actionFn); };
    });
  }

  // ---------- forecasts (page 5) ----------
  function buildForecastPicker() {
    var host = $('#fc-picker');
    host.innerHTML = '';
    [['trailing', 'Trailing-2Q rate'], ['linreg', 'Linear regression'], ['ewma', 'Weighted recent']].forEach(function (m) {
      var b = document.createElement('button');
      b.textContent = m[1]; b.dataset.m = m[0];
      b.className = m[0] === FC_METHOD ? 'active' : '';
      b.onclick = function () { FC_METHOD = m[0]; buildForecastPicker(); renderForecast(); };
      host.appendChild(b);
    });
  }

  function renderForecast() {
    var q = METRICS.quarterly(DATA, FILTERS);
    var k = METRICS.kpis(DATA, FILTERS);
    var methods = FORECAST.methods(DATA, FILTERS);
    var m = methods.filter(function (x) { return x.key === FC_METHOD; })[0] || methods[0];
    var band = FORECAST.confidenceBand(DATA, FILTERS);
    var labels = q.map(function (p) { return p.period.split(' ')[0]; });
    var lastActualIdx = 2;

    var projLine = labels.map(function (_, i) { return i < lastActualIdx ? null : (i === lastActualIdx ? q[i].cumActualUSD : m.projectedUSD); });
    var bandLow = labels.map(function (_, i) { return i < lastActualIdx ? null : (i === lastActualIdx ? q[i].cumActualUSD : band.lowUSD); });
    var bandHigh = labels.map(function (_, i) { return i < lastActualIdx ? null : (i === lastActualIdx ? q[i].cumActualUSD : band.highUSD); });

    CHARTS.cum.data.labels = labels;
    CHARTS.cum.data.datasets = [
      { label: 'Target', data: labels.map(function () { return k.targetUSD; }), borderColor: C.onyx, borderDash: [7, 5], borderWidth: 1.5, pointRadius: 0, fill: false },
      { label: 'Planned cumulative', data: q.map(function (p) { return p.cumPlannedUSD; }), borderColor: C.verd, backgroundColor: C.verd, pointRadius: 4, tension: .25, fill: false },
      { label: 'Actual cumulative', data: q.map(function (p) { return p.cumActualUSD; }), borderColor: C.blue, backgroundColor: C.blue, pointRadius: 4, tension: .25, fill: false, borderWidth: 3 },
      { label: 'Projection (' + m.label + ')', data: projLine, borderColor: C.blue, borderDash: [7, 5], pointRadius: 5, pointStyle: 'circle', pointBackgroundColor: '#FFFFFF', pointBorderColor: C.blue, fill: false },
      { label: 'band-low', data: bandLow, borderColor: 'transparent', pointRadius: 0, fill: false },
      { label: 'band-high', data: bandHigh, borderColor: 'transparent', backgroundColor: alpha(C.sky, .22), pointRadius: 0, fill: '-1' }
    ];
    CHARTS.cum.update();

    var confCls = m.confidence === 'high' ? 'conf-high' : m.confidence === 'low' ? 'conf-low' : 'conf-med';
    var cross = band.crossesTarget ?
      'The upper band crosses the target — reaching it is possible at best-case pace.' :
      'The band does not cross the ' + fmtM(k.targetUSD) + ' target within the horizon.';
    $('#fc-note').innerHTML = '<span class="' + confCls + '"><span class="conf-dot"></span>' +
      m.confidence.charAt(0).toUpperCase() + m.confidence.slice(1) + ' confidence</span> · Year-end <b>' + fmtM(m.projectedUSD) +
      '</b> (' + fmt$(m.projectedUSD - k.targetUSD) + ' vs. target). ' + esc(m.note) + ' ' + esc(band.note) + ' ' + cross;

    // leakage forecast
    var lf = FORECAST.leakageForecast(DATA, FILTERS);
    var allLabels = lf.series.map(function (p) { return p.month; }).concat(lf.projected.map(function (p) { return p.month; }));
    var actualData = lf.series.map(function (p) { return p.cumulativeUSD; }).concat(lf.projected.map(function () { return null; }));
    var projData = lf.series.map(function (p, i) { return i === lf.series.length - 1 ? p.cumulativeUSD : null; })
      .concat(lf.projected.map(function (p) { return p.cumulativeUSD; }));
    CHARTS.leakfc.data.labels = allLabels;
    CHARTS.leakfc.data.datasets = [
      { label: 'Actual', data: actualData, borderColor: C.gold, backgroundColor: alpha(C.gold, .15), fill: true, tension: .3, pointBackgroundColor: C.gold, pointBorderColor: C.blue, pointRadius: 3.5 },
      { label: 'Projected', data: projData, borderColor: C.jasper, borderDash: [6, 4], pointRadius: 3, pointBackgroundColor: '#FFFFFF', pointBorderColor: C.jasper, fill: false }
    ];
    CHARTS.leakfc.update();
    $('#leakfc-note').innerHTML = lf.yearEndUSD ? '<span class="conf-low"><span class="conf-dot"></span>Low confidence</span> · Unchecked, leakage reaches <b>' +
      fmt$(lf.yearEndUSD) + '</b> by year-end. ' + esc(lf.note || '') : '';

    // per-function forecast table + anomalies
    var rows = FORECAST.byFunction(DATA, FILTERS).slice(0, 10);
    var html = '<table class="matrix"><thead><tr><th>Function</th><th style="text-align:right">Planned</th>' +
      '<th style="text-align:right">Projected YE</th><th style="text-align:right">Gap</th><th>RAG</th></tr></thead><tbody>';
    rows.forEach(function (r) {
      html += '<tr><td>' + esc(r.name) + '</td><td class="num">' + fmt$(r.plannedUSD) + '</td>' +
        '<td class="num">' + fmt$(r.projectedUSD) + '</td>' +
        '<td class="num"' + (r.gapUSD > 0 ? ' style="color:var(--jasper)"' : '') + '>' + fmt$(-r.gapUSD) + '</td>' +
        '<td><span class="rag-pill rag-' + r.rag + '">' + r.rag + '</span></td></tr>';
    });
    html += '</tbody></table>';
    $('#t-fnfc').innerHTML = html;

    var an = FORECAST.anomalies(DATA, FILTERS);
    var isAdmin = SESSION && SESSION.role === 'Admin';
    $('#anomaly-note').innerHTML = an.length ?
      '⚠ Anomaly: ' + an.map(function (a) {
        return '<b>' + esc(a.name) + '</b> moved ' + (a.delta >= 0 ? '+' : '') + Math.round(a.delta * 100) +
          ' pts vs. prior week (' + a.sigma.toFixed(1) + 'σ from the population mean, expected ' + esc(a.expected) + ')' +
          (isAdmin ? ' <button class="take-action-btn" data-anom="' + esc(a.name) + '">Flag for review</button>' : '');
      }).join(' · ') :
      'No functions moved more than 2σ from their trailing realization this week.';
    $$('#anomaly-note [data-anom]').forEach(function (btn) {
      btn.onclick = function () { ADMIN.flagForReview(btn.dataset.anom, true); };
    });
  }

  // ---------- scenario workbench ----------
  function buildScenarioCards() {
    var host = $('#scen-grid'); host.innerHTML = '';
    [['up', 'upside'], ['base', 'base'], ['down', 'downside']].forEach(function (pair) {
      var key = pair[0], cls = pair[1], s = SCEN[key];
      var card = document.createElement('div'); card.className = 'scen-card ' + cls; card.id = 'scen-' + key;
      card.innerHTML = '<h5>' + esc(s.name) + '<span class="rag-pill" id="scen-rag-' + key + '"></span></h5>' +
        '<div class="scen-out"><span class="ye" id="scen-ye-' + key + '">—</span><span class="gap" id="scen-gap-' + key + '"></span></div>' +
        sl(key, 'rate', 'Realization rate', 50, 100, s.rate, '%') +
        sl(key, 'pace', 'Exit pace vs. plan', 60, 120, s.pace, '%') +
        sl(key, 'delay', 'Avg rolloff delay', 0, 30, s.delay, 'd') +
        sl(key, 'ramp', 'BPO Hub ramp time', 2, 12, s.ramp, 'w') +
        sl(key, 'attr', 'Attrition / backfill adder', 0, 300, s.attr, 'K');
      host.appendChild(card);
    });
    function sl(key, lever, label, min, max, val, unit) {
      return '<div class="slider-row"><label><span>' + label + '</span><b id="sv-' + key + '-' + lever + '">' + val + unit + '</b></label>' +
        '<input type="range" min="' + min + '" max="' + max + '" value="' + val + '" data-scen="' + key + '" data-lever="' + lever + '" data-unit="' + unit + '" aria-label="' + label + '"></div>';
    }
    $$('#scen-grid input[type=range]').forEach(function (r) {
      r.oninput = function () {
        SCEN[r.dataset.scen][r.dataset.lever] = +r.value;
        $('#sv-' + r.dataset.scen + '-' + r.dataset.lever).textContent = r.value + r.dataset.unit;
        renderScenarios(true);
      };
    });
    $('#scen-reset').onclick = function () {
      SCEN = JSON.parse(JSON.stringify(SCEN_DEFAULTS)); SCENARIO_NOTE = '';
      buildScenarioCards(); renderScenarios(); renderStorylines(METRICS.kpis(DATA, FILTERS));
      toast('Scenarios reset to program defaults');
    };
    $('#scen-save').onclick = function () {
      var name = prompt('Name this scenario set:'); if (!name) return;
      var saved = JSON.parse(localStorage.getItem('bpoScenarios') || '{}');
      saved[name] = SCEN; localStorage.setItem('bpoScenarios', JSON.stringify(saved));
      populateScenLoad(); toast('Scenario set "' + name + '" saved');
      if (window.ADMIN) ADMIN.log('Saved scenario set', name);
    };
    populateScenLoad();
  }
  function populateScenLoad() {
    var sel = $('#scen-load'); if (!sel) return;
    var saved = JSON.parse(localStorage.getItem('bpoScenarios') || '{}');
    sel.innerHTML = '<option value="">Load saved…</option>' + Object.keys(saved).map(function (n) {
      return '<option>' + esc(n) + '</option>';
    }).join('');
    sel.onchange = function () {
      if (!sel.value) return;
      SCEN = JSON.parse(localStorage.getItem('bpoScenarios'))[sel.value];
      buildScenarioCards(); renderScenarios(); toast('Loaded "' + sel.value + '"');
    };
  }

  function scenarioResult(key) {
    var s = SCEN[key];
    return METRICS.scenario(DATA, FILTERS, {
      realizationRate: s.rate / 100, exitPacePct: s.pace / 100,
      delayDays: s.delay, rampWeeks: s.ramp, attritionAdderUSD: s.attr * 1000
    });
  }

  function renderScenarios(fromSlider) {
    var k = METRICS.kpis(DATA, FILTERS);
    var q = METRICS.quarterly(DATA, FILTERS);
    var labels = q.map(function (p) { return p.period.split(' ')[0]; });
    var res = { up: scenarioResult('up'), base: scenarioResult('base'), down: scenarioResult('down') };
    var colors = { up: C.jade, base: C.blue, down: C.jasper };

    Object.keys(res).forEach(function (key) {
      var r = res[key];
      var ye = $('#scen-ye-' + key); if (!ye) return;
      ye.textContent = fmtM(r.projectedYearEndUSD);
      var gapEl = $('#scen-gap-' + key);
      gapEl.textContent = fmt$(r.gapToTargetUSD) + ' vs. target';
      gapEl.style.color = r.gapToTargetUSD >= 0 ? 'var(--jade)' : 'var(--jasper)';
      var ragEl = $('#scen-rag-' + key);
      ragEl.className = 'rag-pill rag-' + r.rag; ragEl.textContent = r.rag;
    });

    CHARTS.scen.data.labels = labels;
    var actual = q.map(function (p) { return p.cumActualUSD; });
    CHARTS.scen.data.datasets = [
      { label: 'Target', data: labels.map(function () { return k.targetUSD; }), borderColor: C.onyx, borderDash: [7, 5], borderWidth: 1.5, pointRadius: 0 },
      { label: 'Actual', data: actual, borderColor: C.blue, borderWidth: 3, pointRadius: 4, pointBackgroundColor: C.blue, tension: .25 }
    ].concat(['up', 'base', 'down'].map(function (key) {
      return {
        label: SCEN[key].name, borderColor: colors[key], borderDash: [6, 4], pointRadius: 4,
        pointBackgroundColor: '#FFFFFF', pointBorderColor: colors[key],
        data: labels.map(function (_, i) { return i < 2 ? null : i === 2 ? actual[2] : res[key].projectedYearEndUSD; })
      };
    }));
    CHARTS.scen.update();

    var html = '<table class="matrix"><thead><tr><th>Scenario</th><th style="text-align:right">Realization</th>' +
      '<th style="text-align:right">Year-End</th><th style="text-align:right">Gap to Target</th><th style="text-align:right">Δ vs. Base</th></tr></thead><tbody>';
    ['up', 'base', 'down'].forEach(function (key) {
      var r = res[key];
      html += '<tr' + (key === 'base' ? ' style="background:var(--blue-tint);font-weight:500"' : '') + '><td>' + esc(SCEN[key].name) + '</td>' +
        '<td class="num">' + SCEN[key].rate + '%</td><td class="num">' + fmtM(r.projectedYearEndUSD) + '</td>' +
        '<td class="num" style="color:' + (r.gapToTargetUSD >= 0 ? 'var(--jade)' : 'var(--jasper)') + '">' + fmt$(r.gapToTargetUSD) + '</td>' +
        '<td class="num">' + (key === 'base' ? '—' : fmt$(r.projectedYearEndUSD - res.base.projectedYearEndUSD)) + '</td></tr>';
    });
    html += '</tbody></table>';
    $('#t-scen').innerHTML = html;

    // sensitivity: which lever moves year-end most (per standard increment)
    var base = res.base.projectedYearEndUSD;
    var probes = [
      { label: 'A 5-point improvement in realization', s: { rate: SCEN.base.rate + 5 } },
      { label: 'A 10-point acceleration in exit pace', s: { pace: SCEN.base.pace + 10 } },
      { label: 'Cutting average delay by 5 days', s: { delay: Math.max(0, SCEN.base.delay - 5) } }
    ].map(function (p) {
      var merged = Object.assign({}, SCEN.base, p.s);
      var v = METRICS.scenario(DATA, FILTERS, {
        realizationRate: merged.rate / 100, exitPacePct: merged.pace / 100,
        delayDays: merged.delay, rampWeeks: merged.ramp, attritionAdderUSD: merged.attr * 1000
      });
      return { label: p.label, gain: v.projectedYearEndUSD - base };
    }).sort(function (a, b) { return b.gain - a.gain; });
    if (window.APPX) APPX.scenarioResources(FILTERS, {
      realizationRate: SCEN.base.rate / 100, exitPacePct: SCEN.base.pace / 100,
      delayDays: SCEN.base.delay, rampWeeks: SCEN.base.ramp, attritionAdderUSD: SCEN.base.attr * 1000
    });
    $('#sens-note').innerHTML = '<b>' + probes[0].label + '</b> is worth <b>' + fmt$(probes[0].gain) +
      '</b> at year-end — the highest-leverage lever on the board.';

    if (fromSlider) {
      SCENARIO_NOTE = 'Scenario modeling: at ' + SCEN.base.rate + '% realization and ' + SCEN.base.pace +
        '% exit pace, year-end reaches <b>' + fmtM(res.base.projectedYearEndUSD) + '</b> (' +
        fmt$(res.base.gapToTargetUSD) + ' vs. target).';
      var body = $('#sl-body-5');
      if (body) renderStorylines(k);
    }
  }

  // ---------- storyline (rule-based narrative; swaps to a live LLM via config) ----------
  function generateStoryline(page, k) {
    if (k.inScope === 0) return 'No roles match the current filters — clear a filter to restore the narrative.';
    var d = METRICS.deltasVsPrior(DATA, FILTERS);
    var drivers = METRICS.driversOfGap(DATA, FILTERS, 3);
    var zero = METRICS.zeroRealization(DATA, FILTERS);
    var ktRisk = METRICS.ktRiskRoles(DATA, FILTERS);
    var od = METRICS.overdueDetail(DATA, FILTERS);
    var s = [];
    var filteredNote = k.filtered ? 'Filtered view — figures reflect the current selection. ' : '';

    if (page === 2) {
      s.push('The baseline footprint is <b>' + k.inScope + ' onshore roles</b> at <b>' + fmtM(k.baselineOnshoreCostUSD) +
        '</b> fully-loaded annualized cost, of which <b>' + fmtM(k.remainingOnshoreCostUSD) + '</b> is still being carried.');
    } else if (page === 3) {
      s.push('<b>' + k.hired + ' of ' + k.hiredPlanned + '</b> BPO Hub roles are hired (<b>' + fmtPct(k.hireOnTimePct) +
        '</b> started on time), but only <b>' + k.stabilized + '</b> are stabilized and <b>' + k.ktNotStarted +
        '</b> have no knowledge transfer logged — a delivery-risk exposure, not yet a cost exposure, because savings recognize at exit.');
    } else {
      s.push('<b>' + k.exited + ' of ' + k.inScope + '</b> conversions have exited (<b>' + fmtPct(k.exitedPct) +
        '</b>), and <b>' + fmtM(k.realizedUSD) + ' of the ' + fmtM(k.planToDateUSD) +
        '</b> plan-to-date savings has been realized — <b>' + Math.round(k.behindPct * 100) + '% behind</b>.');
    }
    s.push('At the trailing realization rate of <b>' + fmtPct(k.realizationRate) + '</b>, year-end lands at <b>' +
      fmtM(k.projectedYearEndUSD) + '</b> against the <b>' + fmtM(k.targetUSD) + '</b> target — a <b>' +
      fmt$(Math.abs(k.gapToTargetUSD)) + '</b> gap.');
    if (d && d.biggestMover && Math.abs(d.biggestMover.delta) >= 0.02) {
      s.push('<b>' + esc(d.biggestMover.name) + '</b> is the biggest mover since ' + fmtDate(d.priorAsOf) +
        ', ' + (d.biggestMover.delta > 0 ? 'improving' : 'slipping') + ' from <b>' + fmtPct(d.biggestMover.from) +
        '</b> to <b>' + fmtPct(d.biggestMover.to) + '</b> realization.');
    }
    if (drivers.length && page !== 3) {
      s.push('The gap concentrates in ' + drivers.map(function (x) {
        return '<b>' + esc(x.name) + '</b> (−' + fmt$(x.gapUSD).replace('$', '$') + ')';
      }).join(', ') + '.');
    }
    var exceptions = [];
    if (od.count) exceptions.push('<b>' + od.count + '</b> rolloffs are overdue (average <b>' + od.avgDelayDays + ' days</b>, ' + fmt$(od.cumulativeLeakageUSD) + ' cumulative leakage)');
    if (zero.length) exceptions.push('<b>' + zero.length + '</b> functions remain at zero realization (' + fmt$(zero.reduce(function (a, z) { return a + z.plannedUSD; }, 0)) + ' planned)');
    if (ktRisk.length) exceptions.push('<b>' + ktRisk.length + '</b> roles within 30 days of exit have not started KT');
    if (exceptions.length && page !== 2) s.push('Exceptions: ' + exceptions.join('; ') + '.');
    if (zero.length) {
      s.push('Recommended action: pull forward the ' + (zero.length > 1 ? zero.length + ' zero-realization functions' : 'zero-realization function') +
        ' — <b>' + fmt$(zero.reduce(function (a, z) { return a + z.plannedUSD; }, 0)) + '</b> of unrealized planned savings — and clear the overdue Wave 2 exits before leakage compounds.');
    }
    if (page === 5 && SCENARIO_NOTE) s.push(SCENARIO_NOTE);
    return filteredNote + s.join(' ');
  }

  function renderStorylines(k) {
    var stamp = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    for (var p = 1; p <= 5; p++) {
      var body = $('#sl-body-' + p); if (!body) continue;
      var slBox = body.closest('.storyline');
      slBox.classList.add('regen');
      (function (body, p, slBox) {
        setTimeout(function () {
          body.innerHTML = generateStoryline(p, k);
          $('#sl-pill-' + p).textContent = 'AI-generated · ' + stamp;
          slBox.classList.remove('regen');
        }, 120);
      })(body, p, slBox);
      renderWhatChanged(p);
    }
  }

  function renderWhatChanged(page) {
    var host = $('#wc-' + page); if (!host) return;
    var d = METRICS.deltasVsPrior(DATA, FILTERS);
    if (!d) { host.innerHTML = '<em>No prior dataset for comparison.</em>'; return; }
    function row(label, from, to, fmt, invert) {
      var delta = to - from;
      var cls = delta === 0 ? 'delta-flat' : ((delta > 0) !== !!invert ? 'delta-up' : 'delta-down');
      var arrow = delta === 0 ? '→' : delta > 0 ? '▲' : '▼';
      return '<tr><td>' + label + '</td><td class="num">' + fmt(from) + '</td><td class="num">' + fmt(to) +
        '</td><td class="num ' + cls + '">' + arrow + ' ' + fmt(Math.abs(delta)).replace('-', '') + '</td></tr>';
    }
    var n = function (v) { return String(Math.round(v)); };
    var pc = function (v) { return Math.round(v * 100) + '%'; };
    host.innerHTML = '<table><tr><th style="text-align:left;font-weight:500;color:var(--muted)">Metric</th>' +
      '<th style="color:var(--muted);font-weight:500">' + fmtDate(d.priorAsOf) + '</th>' +
      '<th style="color:var(--muted);font-weight:500">' + fmtDate(DATA.meta.asOfDate) + '</th>' +
      '<th style="color:var(--muted);font-weight:500">Δ</th></tr>' +
      row('Roles exited', d.exited.from, d.exited.to, n) +
      row('Roles stabilized', d.stabilized.from, d.stabilized.to, n) +
      row('Overdue rolloffs', d.overdue.from, d.overdue.to, n, true) +
      row('Savings realized', d.realizedUSD.from, d.realizedUSD.to, fmt$) +
      row('Cumulative leakage', d.leakageUSD.from, d.leakageUSD.to, fmt$, true) +
      '</table>';
  }

  // ---------- data stamp ----------
  function renderDataStamp() {
    var m = DATA.meta;
    var age = Math.floor((new Date() - new Date(m.asOfDate + 'T00:00:00')) / 86400000);
    var stale = age > m.staleAfterDays;
    $('#data-stamp').innerHTML = 'Data as of <b>' + fmtDate(m.asOfDate) + '</b> · Last refreshed ' +
      new Date(m.lastRefresh).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) +
      (stale ? '<br><span class="stale">⚠ Data is ' + age + ' days old — refresh expected weekly</span>' : '');
    var chatAsof = $('#chat-asof');
    if (chatAsof) chatAsof.textContent = 'Demo mode — illustrative data · as of ' + fmtDate(m.asOfDate);
  }

  // ---------- pages ----------
  function gotoPage(n) {
    CURRENT_PAGE = n;
    $$('.page').forEach(function (p) { p.classList.remove('active'); });
    $('#page-' + n).classList.add('active');
    $$('.pagetab').forEach(function (t) { t.classList.toggle('active', +t.dataset.page === n); });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // charts sized while hidden need a resize pass
    setTimeout(function () { Object.keys(CHARTS).forEach(function (c) { CHARTS[c].resize(); }); }, 30);
  }

  // ---------- role (no sign-in by design) ----------
  // This build has NO authentication: the tool opens straight into the dashboard.
  // In production the deployment sits behind corporate SSO, which supplies both the
  // identity and the role — see AUTH_CONFIG above and the README.
  // The switcher below exists purely so the Viewer/Admin capability can be shown live.
  function init() {
    SESSION = { email: 'demo@client.example', role: sessionStorage.getItem('bpoRole') || 'Admin' };
    buildStructure();
    $$('.pagetab').forEach(function (t) { t.onclick = function () { gotoPage(+t.dataset.page); }; });
    renderRoleSwitch();
    applyRole();
    updateAll();
    if (window.CHATBOT) CHATBOT.init();
  }

  function renderRoleSwitch() {
    var host = $('#role-switch'); if (!host) return;
    host.innerHTML = '';
    ['Viewer', 'Admin'].forEach(function (r) {
      var b = document.createElement('button');
      b.textContent = r;
      b.className = SESSION.role === r ? 'active' : '';
      b.setAttribute('aria-pressed', SESSION.role === r ? 'true' : 'false');
      b.onclick = function () { setRole(r); };
      host.appendChild(b);
    });
  }

  // Admin controls are created here and ONLY here — as Viewer they are absent
  // from the DOM entirely, not merely hidden or disabled.
  function applyRole() {
    var slot = $('#admin-slot');
    slot.innerHTML = '';
    if (SESSION.role === 'Admin' && window.ADMIN) ADMIN.mount(slot);
  }

  function setRole(role) {
    SESSION.role = role;
    sessionStorage.setItem('bpoRole', role);
    renderRoleSwitch();
    applyRole();
    updateAll();
    toast('Viewing as ' + role);
  }

  // ---------- data refresh (called by upload.js) ----------
  function refreshData() {
    renderSlicers();
    FILTERS = {};
    updateAll();
    toast('Dataset refreshed — storyline and forecasts regenerated');
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    get session() { return SESSION; },
    getFilters: function () { return JSON.parse(JSON.stringify(FILTERS)); },
    setFilters: setFilters, toggleFilter: toggleFilter, clearFilters: clearFilters, setRole: setRole,
    gotoPage: gotoPage, updateAll: updateAll, refreshData: refreshData,
    generateStoryline: generateStoryline,
    fmt: { M: fmtM, K: fmtK, $: fmt$, pct: fmtPct, date: fmtDate }, esc: esc, toast: toast,
    scenarioResult: scenarioResult, SCEN: function () { return SCEN; }
  };
})();
