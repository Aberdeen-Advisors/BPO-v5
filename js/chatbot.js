/* ============================================================================
   CHATBOT — grounded in METRICS. Every answer is computed by the same
   aggregation layer as the charts, so the two can never disagree.
   Keyword-and-intent parser — no LLM required for the demo; the README
   documents the one-config swap to a live model.
   ============================================================================ */

var CHATBOT = (function () {
  'use strict';

  function $(s) { return document.querySelector(s); }
  var fmtM, fmt$, fmtPct, esc;

  var SUGGESTIONS = [
    'What percentage of hires are starting on time?',
    'Are we delivering the BPO Hub transition according to plan?',
    'Which business units and locations are ahead of or behind target?',
    'What’s driving the savings gap?',
    'Which functions have zero realization?',
    'How many rolloffs are overdue and what are they costing us?',
    'What happens to year-end savings if realization improves to 85%?',
    'Are we hitting the 70/30 FTE target?',
    'Which capabilities are single points of failure?',
    'How many contracts are ending soon?',
    'What is blocked right now?'
  ];

  function ctx() {
    var filters = APP.getFilters();
    var k = METRICS.kpis(DATA, filters);
    return { filters: filters, k: k, filtered: k.filtered };
  }
  function asOfLine(c) {
    return '<span class="asof">As of ' + APP.fmt.date(DATA.meta.asOfDate) +
      (c.filtered ? ' · respecting the active filter (' + c.k.inScope + ' roles in view)' : ' · full program view') + '</span>';
  }
  function viewLink(label, filters, page) {
    var id = 'vl-' + Math.random().toString(36).slice(2, 8);
    setTimeout(function () {
      var btn = document.getElementById(id);
      if (btn) btn.onclick = function () {
        APP.setFilters(filters || {});
        APP.gotoPage(page || 1);
        $('#chat-panel').classList.remove('open');
      };
    }, 0);
    return '<button class="view-link" id="' + id + '">' + label + ' →</button>';
  }

  // ---------- intent handlers ----------
  function ansHiresOnTime(c) {
    var k = c.k;
    return '<b>' + fmtPct(k.hireOnTimePct) + '</b> of BPO Hub hires started on time — <b>' +
      k.hireOnTime + ' of ' + k.hired + '</b> hired roles.' +
      '<ul><li>' + k.hired + ' of ' + k.hiredPlanned + ' planned backfills are hired (' + fmtPct(k.hired / (k.hiredPlanned || 1)) + ')</li>' +
      '<li>' + (k.hired - k.hireOnTime) + ' hires started later than their target date</li>' +
      '<li>' + k.stabilized + ' roles are fully stabilized (KT complete)</li></ul>' +
      viewLink('View Savings & Delivery', c.filters, 2) + asOfLine(c);
  }

  function ansOnPlan(c) {
    var k = c.k;
    var behind = Math.round(k.behindPct * 100);
    return '<b>Partially — exits are close to plan, but savings are ' + behind + '% behind.</b>' +
      '<ul><li>Rolloff attainment is <b>' + fmtPct(k.rolloffAttainment) + '</b> (' + k.exited + ' exited vs. ' + k.plannedToDate + ' planned to date)</li>' +
      '<li>Savings realized are <b>' + fmtM(k.realizedUSD) + '</b> against <b>' + fmtM(k.planToDateUSD) + '</b> plan-to-date (' + fmt$(k.varianceUSD) + ')</li>' +
      '<li>At the current <b>' + fmtPct(k.realizationRate) + '</b> realization rate, year-end lands at <b>' + fmtM(k.projectedYearEndUSD) +
      '</b> vs. the <b>' + fmtM(k.targetUSD) + '</b> target — a ' + fmt$(Math.abs(k.gapToTargetUSD)) + ' gap</li>' +
      '<li>' + k.overdue + ' rolloffs are overdue and ' + METRICS.zeroRealization(DATA, c.filters).length + ' functions have realized nothing</li></ul>' +
      viewLink('View the Executive Brief', c.filters, 1) + asOfLine(c);
  }

  function dimTable(c, dim, label) {
    var rows = METRICS.aheadBehind(DATA, c.filters, dim);
    var html = '<table><tr><th>' + label + '</th><th>Savings attain.</th><th>Position</th></tr>';
    rows.forEach(function (r) {
      html += '<tr><td>' + esc(r.name) + '</td><td>' + fmtPct(r.savingsAttainment) + '</td><td>' +
        (r.savingsAttainment >= 0.8 ? 'Ahead / on target' : r.savingsAttainment >= 0.4 ? 'Behind' : 'Materially behind') + '</td></tr>';
    });
    return html + '</table>';
  }

  function ansAheadBehind(c, q) {
    var parts = [];
    var wantDomain = /domain/.test(q), wantBU = /business unit|bu\b/.test(q), wantLoc = /location|site/.test(q);
    var none = !wantDomain && !wantBU && !wantLoc;
    var lead = '<b>Measured on savings attainment (≥80% = on target):</b>';
    if (wantDomain || none) parts.push(dimTable(c, 'domain', 'Domain'));
    if (wantBU || none) parts.push(dimTable(c, 'businessUnit', 'Business Unit'));
    if (wantLoc || none) parts.push(dimTable(c, 'location', 'Location'));
    return lead + parts.join('') + viewLink('View Savings & Delivery', c.filters, 2) + asOfLine(c);
  }

  function ansGapDrivers(c) {
    var drivers = METRICS.driversOfGap(DATA, c.filters, 3);
    var zero = METRICS.zeroRealization(DATA, c.filters);
    var zeroSum = zero.reduce(function (a, z) { return a + z.plannedUSD; }, 0);
    return '<b>Three functions account for ' + fmt$(drivers.reduce(function (a, d) { return a + d.gapUSD; }, 0)) +
      ' of the unrealized savings.</b>' +
      '<ul>' + drivers.map(function (d) {
        return '<li><b>' + esc(d.name) + '</b> — ' + fmt$(d.gapUSD) + ' unrealized (' + fmtPct(d.attainment) + ' attainment)</li>';
      }).join('') + '</ul>' +
      (zero.length ? 'On top of that, <b>' + zero.length + ' functions have realized zero</b> — ' + fmt$(zeroSum) + ' of planned savings untouched.' : '') +
      viewLink('View Savings & Delivery', c.filters, 2) + asOfLine(c);
  }

  function ansZeroRealization(c) {
    var zero = METRICS.zeroRealization(DATA, c.filters);
    if (!zero.length) return '<b>No functions in the current view have zero realization.</b>' + asOfLine(c);
    var total = zero.reduce(function (a, z) { return a + z.plannedUSD; }, 0);
    return '<b>' + zero.length + ' functions have realized no savings at all — ' + fmt$(total) + ' of planned savings.</b>' +
      '<table><tr><th>Function</th><th>Planned</th><th>Roles</th></tr>' +
      zero.map(function (z) {
        return '<tr><td>' + esc(z.name) + '</td><td>' + fmt$(z.plannedUSD) + '</td><td>' + z.headcount + '</td></tr>';
      }).join('') + '</table>' +
      'All are Wave 4 infrastructure functions with no exits yet — pulling them forward is the single biggest lever on the gap.' +
      viewLink('View these functions', { functionName: zero.map(function (z) { return z.name; }) }, 2) + asOfLine(c);
  }

  function ansOverdue(c) {
    var od = METRICS.overdueDetail(DATA, c.filters);
    if (!od.count) return '<b>No rolloffs are overdue in the current view.</b>' + asOfLine(c);
    return '<b>' + od.count + ' rolloffs are overdue</b>, running an average of <b>' + od.avgDelayDays + ' days</b> late.' +
      '<ul><li>Cumulative cost leakage to date: <b>' + fmt$(od.cumulativeLeakageUSD) + '</b></li>' +
      '<li>Current run-rate: roughly <b>' + fmt$(od.estMonthlyRunRateUSD) + ' per month</b> while they remain onshore</li>' +
      '<li>All are Wave 2 roles past their July target dates</li></ul>' +
      viewLink('View overdue roles', { statusBucket: ['Overdue / at risk'] }, 2) + asOfLine(c);
  }

  function ansScenario(c, q) {
    var m = q.match(/(\d{2,3})\s*%/);
    var rate = m ? Math.min(100, parseInt(m[1], 10)) / 100 : 0.85;
    var res = METRICS.scenario(DATA, c.filters, { realizationRate: rate });
    var base = METRICS.scenario(DATA, c.filters, { realizationRate: c.k.realizationRate });
    return '<b>At ' + fmtPct(rate) + ' realization, year-end savings reach ' + fmtM(res.projectedYearEndUSD) + '</b> — ' +
      fmt$(res.projectedYearEndUSD - base.projectedYearEndUSD) + ' better than the current-pace projection.' +
      '<ul><li>Gap to the ' + fmtM(c.k.targetUSD) + ' target: <b>' + fmt$(res.gapToTargetUSD) + '</b></li>' +
      '<li>Formula: ' + fmtM(c.k.realizedUSD) + ' YTD + (' + fmtM(c.k.remainingPipelineUSD) + ' remaining × ' + fmtPct(rate) + ')</li>' +
      '<li>' + (res.projectedYearEndUSD >= c.k.targetUSD ? 'This closes the gap.' : 'Even at this pace the target is missed — closing it fully needs the zero-realization functions pulled forward.') + '</li></ul>' +
      viewLink('Open the Scenario Workbench', c.filters, 2) + asOfLine(c);
  }

  function ansExits(c) {
    var k = c.k;
    return '<b>' + k.exited + ' of ' + k.inScope + ' conversions have exited (' + fmtPct(k.exitedPct) + ').</b>' +
      '<ul><li>' + k.stabilized + ' stabilized (KT complete) · ' + k.coverageGap + ' exited before their BPO Hub role stabilized</li>' +
      '<li>Rolloff attainment: ' + fmtPct(k.rolloffAttainment) + ' vs. plan-to-date</li>' +
      '<li>' + k.overdue + ' overdue · average delay ' + k.avgDelayDays + ' days</li></ul>' +
      viewLink('View the Executive Brief', c.filters, 1) + asOfLine(c);
  }

  function ansSavings(c) {
    var k = c.k;
    return '<b>' + fmtM(k.realizedUSD) + ' of savings is realized YTD against ' + fmtM(k.planToDateUSD) + ' planned — ' +
      Math.round(k.behindPct * 100) + '% behind.</b>' +
      '<ul><li>Full-year target: ' + fmtM(k.targetUSD) + ' · projected year-end: <b>' + fmtM(k.projectedYearEndUSD) + '</b></li>' +
      '<li>Realization ratio (trailing 2 completed quarters): ' + fmtPct(k.realizationRate) + '</li>' +
      '<li>Savings at risk: ' + fmt$(k.savingsAtRiskUSD) + ' · cost leakage: ' + fmt$(k.leakageUSD) + '</li></ul>' +
      viewLink('View Savings & Delivery', c.filters, 2) + asOfLine(c);
  }

  function ansKT(c) {
    var funnel = METRICS.ktFunnel(DATA, c.filters);
    return '<b>' + c.k.ktNotStarted + ' roles have not started knowledge transfer;</b> ' + c.k.stabilized + ' are complete.' +
      '<table><tr><th>KT stage</th><th>Roles</th></tr>' +
      funnel.map(function (s) { return '<tr><td>' + esc(s.stage) + '</td><td>' + s.n + '</td></tr>'; }).join('') +
      '</table>' + viewLink('View Indonesia View', c.filters, 3) + asOfLine(c);
  }

  function ansForecast(c) {
    var methods = FORECAST.methods(DATA, c.filters);
    var band = FORECAST.confidenceBand(DATA, c.filters);
    return '<b>Year-end forecasts range from ' + fmtM(Math.min.apply(null, methods.map(function (m) { return m.projectedUSD; }))) +
      ' to ' + fmtM(Math.max.apply(null, methods.map(function (m) { return m.projectedUSD; }))) + ' depending on method.</b>' +
      '<table><tr><th>Method</th><th>Year-end</th></tr>' +
      methods.map(function (m) { return '<tr><td>' + esc(m.label) + '</td><td>' + fmtM(m.projectedUSD) + '</td></tr>'; }).join('') +
      '</table>Confidence band: ' + fmtM(band.lowUSD) + '–' + fmtM(band.highUSD) +
      (band.crossesTarget ? ' — the upper band reaches the target.' : ' — the band does not reach the ' + fmtM(c.k.targetUSD) + ' target.') +
      viewLink('View Savings & Delivery', c.filters, 2) + asOfLine(c);
  }

  function ansFunction(c, fnName) {
    var f = { functionName: [fnName] };
    Object.keys(c.filters).forEach(function (d) { if (d !== 'functionName') f[d] = c.filters[d]; });
    var k = METRICS.kpis(DATA, f);
    return '<b>' + esc(fnName) + ': ' + k.exited + ' of ' + k.inScope + ' roles exited, ' + fmt$(k.realizedUSD) +
      ' of ' + fmt$(k.plannedFYUSD) + ' planned savings realized (' + fmtPct(k.plannedFYUSD ? k.realizedUSD / k.plannedFYUSD : 0) + ').</b>' +
      '<ul><li>' + k.stabilized + ' stabilized · ' + k.overdue + ' overdue · ' + k.ktNotStarted + ' KT not started</li>' +
      '<li>Baseline onshore cost: ' + fmtM(k.baselineOnshoreCostUSD) + '</li></ul>' +
      viewLink('Filter dashboard to ' + esc(fnName), f, 2) + asOfLine(c);
  }


  // ---------- v2: workforce, planning and execution ----------
  function ansFteRatio(c) {
    var mix = METRICS.workforceMix(DATA, c.filters);
    var h = mix.headline, a = mix.alternate;
    return '<b>' + Math.round(h.ratio * 1000) / 10 + '% of the workforce is FTE</b> against a ' +
      fmtPct(h.targetRatio) + ' target — ' + (h.gapHeads > 0 ? h.gapHeads + ' people short.' : Math.abs(h.gapHeads) + ' people clear.') +
      '<table><tr><th>Definition</th><th>FTE share</th><th>Gap</th></tr>' +
      '<tr><td>' + (h.includesHub ? 'BPO Hub counted as non-FTE' : 'BPO Hub excluded') + ' (in use)</td><td>' +
      Math.round(h.ratio * 1000) / 10 + '%</td><td>' + h.gapHeads + '</td></tr>' +
      '<tr><td>' + (a.includesHub ? 'BPO Hub counted as non-FTE' : 'BPO Hub excluded') + '</td><td>' +
      Math.round(a.ratio * 1000) / 10 + '%</td><td>' + a.gapHeads + '</td></tr></table>' +
      'The two definitions disagree on whether you are on target. That decision has no owner yet.' +
      viewLink('View Workforce', c.filters, 3) + asOfLine(c);
  }

  function ansCoverage(c) {
    var cov = METRICS.roleCoverage(DATA, c.filters);
    if (!cov.singlePoints.length && !cov.critical.length) {
      return '<b>No capability in this view falls below the critical coverage threshold.</b>' + asOfLine(c);
    }
    return '<b>' + cov.singlePoints.length + ' capabilities rest on a single person</b> and ' +
      cov.critical.length + ' are at or below the critical threshold of ' + DATA.policy.coverageCriticalThreshold + '.' +
      '<table><tr><th>Capability</th><th>People</th><th>Teams</th></tr>' +
      cov.critical.slice(0, 8).map(function (r) {
        return '<tr><td>' + esc(r.capability) + '</td><td>' + r.headcount + '</td><td>' + r.teamCount + '</td></tr>';
      }).join('') + '</table>' +
      'There are also <b>' + cov.spofPairs.length + '</b> domain-and-capability combinations covered by exactly one person.' +
      viewLink('View Workforce', c.filters, 3) + asOfLine(c);
  }

  function ansCliff(c) {
    var cl = METRICS.contractCliff(DATA, c.filters);
    if (!cl.count) return '<b>No non-FTE contracts end within ' + cl.windowDays + ' days in this view.</b>' + asOfLine(c);
    return '<b>' + cl.count + ' non-FTE contracts end within ' + cl.windowDays + ' days</b>, worth ' +
      fmt$(cl.annualCostUSD) + ' annualised.' +
      '<ul>' + cl.byDomain.slice(0, 5).map(function (d) {
        return '<li>' + esc(d.domain) + ' — <b>' + d.count + '</b></li>';
      }).join('') + '</ul>' +
      'Procurement lead time is typically longer than this window, so anything in it is already urgent.' +
      viewLink('View Workforce', c.filters, 3) + asOfLine(c);
  }

  function ansVendors(c) {
    var vf = METRICS.vendorFootprint(DATA, c.filters);
    return '<b>' + vf.distinctVendors + ' distinct vendors</b> supply people in this view, and <b>' +
      vf.fragmentedTeams.length + '</b> team(s) carry ' + DATA.policy.vendorConcentrationThreshold + ' or more.' +
      '<table><tr><th>Vendor</th><th>People</th><th>Teams</th></tr>' +
      vf.vendors.slice(0, 7).map(function (v) {
        return '<tr><td>' + esc(v.vendor) + '</td><td>' + v.headcount + '</td><td>' + v.teams + '</td></tr>';
      }).join('') + '</table>' +
      viewLink('View Workforce', c.filters, 3) + asOfLine(c);
  }

  function ansBlocked(c) {
    var ih = METRICS.initiativeHealth(DATA, c.filters);
    var as = METRICS.actionStats(DATA, c.filters);
    return '<b>' + ih.blocked.length + ' initiatives are blocked by a dependency</b> and ' +
      as.blocked + ' action items are blocked.' +
      '<ul>' + ih.blocked.slice(0, 5).map(function (r) {
        return '<li><b>' + esc(r.name) + '</b> — waiting on ' + r.blockers.join(', ') + '</li>';
      }).join('') + '</ul>' +
      '<b>' + as.overdue + '</b> action items are overdue and <b>' + ih.totalGap +
      '</b> people short across all initiatives.' +
      viewLink('View Decisions', c.filters, 5) + asOfLine(c);
  }

  function ansWftForecast(c) {
    var w = METRICS.wftSummary(DATA);
    return '<b>FTE share moves from ' + Math.round(w.ratioNow * 1000) / 10 + '% to ' +
      Math.round(w.ratioEnd * 1000) / 10 + '% by ' + w.yearEnd.month + '</b> — ' +
      (w.reachesTarget ? 'reaching' : 'not reaching') + ' the ' + fmtPct(DATA.policy.fteTargetRatio) + ' target.' +
      '<ul><li>Net headcount change over the forecast: <b>' + (w.headcountDelta >= 0 ? '+' : '') + w.headcountDelta + '</b></li>' +
      '<li>' + w.historicalMonths + ' months of actuals, ' + w.forecastMonths + ' months forecast</li>' +
      '<li>' + (w.direction < 0 ? 'The trajectory moves <b>away</b> from target, because roles transferred to the BPO Hub count as non-FTE.' : 'The trajectory moves toward target.') + '</li></ul>' +
      viewLink('View Workforce', c.filters, 3) + asOfLine(c);
  }

  function ansFunding(c) {
    var f = METRICS.fundingAlignment(DATA, c.filters);
    return '<b>' + f.totals.fundingGap + ' positions are required but not funded</b>, and ' +
      f.totals.assignmentGap + ' are funded but not assigned to anyone.' +
      '<ul><li>Required <b>' + f.totals.requiredFte + '</b> · funded <b>' + f.totals.fundedFte +
      '</b> · assigned <b>' + f.totals.assignedFte + '</b></li>' +
      '<li><b>' + f.unfundedPositions + '</b> positions on the roster carry no funding source (' + fmt$(f.unfundedCostUSD) + ')</li>' +
      '<li><b>' + f.unassignedPositions + '</b> people are not mapped to any initiative</li></ul>' +
      viewLink('View Planning & Forecast', c.filters, 4) + asOfLine(c);
  }

  function ansNotes(c) {
    var an = METRICS.analyzeNotes(DATA, c.filters);
    return '<b>' + an.flagged.length + ' of ' + an.analyzed + ' status notes carry risk signals</b>' +
      (an.topTheme ? ', most often about <b>' + esc(an.topTheme.theme.toLowerCase()) + '</b>.' : '.') +
      '<table><tr><th>Theme</th><th>Mentions</th></tr>' +
      an.themes.map(function (t) { return '<tr><td>' + esc(t.theme) + '</td><td>' + t.n + '</td></tr>'; }).join('') +
      '</table>' + an.high.length + ' item(s) rate high severity.' +
      viewLink('View Decisions', c.filters, 5) + asOfLine(c);
  }

  // ---------- router ----------
  function answer(qRaw) {
    var q = qRaw.toLowerCase();
    var c = ctx();

    // function name mention takes priority when combined with a metric word
    var fnHit = DATA.functions.map(function (f) { return f.name; }).filter(function (n) {
      return q.indexOf(n.toLowerCase()) >= 0;
    })[0];

    if (/70\s*\/?\s*30|fte|non-fte|full.time|ratio|mix/.test(q) && !/realization/.test(q)) return ansFteRatio(c);
    if (/single point|coverage|capabilit|spof|cross.train|duplicat/.test(q)) return ansCoverage(c);
    if (/contract|cliff|expir|ending|renew/.test(q)) return ansCliff(c);
    if (/vendor|supplier|third.part/.test(q)) return ansVendors(c);
    if (/blocked|blocker|dependenc|stuck|trigger/.test(q)) return ansBlocked(c);
    if (/workforce|headcount forecast|wft|staffing|roster/.test(q) && /forecast|future|trend|plan|project/.test(q)) return ansWftForecast(c);
    if (/unfunded|funding|funded|assign/.test(q)) return ansFunding(c);
    if (/note|free.text|sentiment|signal|theme/.test(q)) return ansNotes(c);
    if (/action item|overdue action|to.?do|open action/.test(q)) return ansBlocked(c);
    if (/hire|hiring|start(ing)? on time|onboard/.test(q) && /time|%|percent|rate/.test(q)) return ansHiresOnTime(c);
    if (/zero|no realization|nothing realized|realized nothing/.test(q)) return ansZeroRealization(c);
    if (/overdue|late roll|past due|costing us/.test(q)) return ansOverdue(c);
    if (/what if|improve|happens|rises|increases|scenario/.test(q) && /\d{2,3}\s*%|realization/.test(q)) return ansScenario(c, q);
    if (/driv(ing|ers)|gap.*(why|driv)|why.*(gap|behind)|what.*gap/.test(q)) return ansGapDrivers(c);
    if (/ahead|behind/.test(q) && /(domain|business unit|location|bu\b|which|who)/.test(q)) return ansAheadBehind(c, q);
    if (/according to plan|on plan|on track|delivering|are we/.test(q)) return ansOnPlan(c);
    if (fnHit) return ansFunction(c, fnHit);
    if (/forecast|project|year.?end|land/.test(q)) return ansForecast(c);
    if (/kt|knowledge transfer|stabiliz/.test(q)) return ansKT(c);
    if (/saving|realiz|dollar|\$|cost leak|leakage/.test(q)) return ansSavings(c);
    if (/exit|rolloff|conversion|headcount|role/.test(q)) return ansExits(c);
    if (/hire|onboard/.test(q)) return ansHiresOnTime(c);

    return 'I can only answer questions about the programme data currently loaded — transition exits, savings, ' +
      'realization, leakage and knowledge transfer, plus workforce mix, vendors, contracts, capability coverage, ' +
      'funding, forecasts, initiatives and action items. Try one of the suggested questions below.' + asOfLine(c);
  }

  // ---------- UI ----------
  function addMsg(html, who) {
    var div = document.createElement('div');
    div.className = 'chat-msg ' + who;
    div.innerHTML = html;
    $('#chat-body').appendChild(div);
    $('#chat-body').scrollTop = $('#chat-body').scrollHeight;
  }
  function addSuggestions() {
    var wrap = document.createElement('div');
    wrap.className = 'chat-suggest';
    SUGGESTIONS.forEach(function (s) {
      var b = document.createElement('button');
      b.textContent = s;
      b.onclick = function () { ask(s); };
      wrap.appendChild(b);
    });
    $('#chat-body').appendChild(wrap);
  }
  function ask(q) {
    addMsg(esc(q), 'user');
    setTimeout(function () { addMsg(answer(q), 'bot'); }, 180);
  }

  function init() {
    fmtM = APP.fmt.M; fmt$ = APP.fmt.$; fmtPct = APP.fmt.pct; esc = APP.esc;
    $('#chat-fab').onclick = function () {
      var panel = $('#chat-panel');
      panel.classList.toggle('open');
      if (panel.classList.contains('open') && !$('#chat-body').children.length) {
        addMsg('I answer from the same metrics layer as every chart on this dashboard, so my numbers always match the visuals. ' +
          'Ask me about exits, savings, functions, waves, or scenarios — or pick a question:', 'bot');
        addSuggestions();
      }
    };
    $('#chat-close').onclick = function () { $('#chat-panel').classList.remove('open'); };
    $('#chat-send').onclick = send;
    $('#chat-text').addEventListener('keydown', function (e) { if (e.key === 'Enter') send(); });
    function send() {
      var v = $('#chat-text').value.trim();
      if (!v) return;
      $('#chat-text').value = '';
      ask(v);
    }
  }

  return { init: init, answer: answer };
})();
