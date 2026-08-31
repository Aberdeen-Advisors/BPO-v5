/* ============================================================================
   EXPORTS (v2) — files in the shape each downstream destination expects.
   All generated in the browser from METRICS output; nothing is transmitted.
   ============================================================================ */

var EXPORTS = (function () {
  'use strict';

  function filters() { return APP.getFilters(); }
  function stamp() { return DATA.meta.asOfDate; }

  function download(text, name, mime) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: mime || 'text/csv;charset=utf-8' }));
    a.download = name; a.click(); URL.revokeObjectURL(a.href);
  }
  function csv(rows) {
    return rows.map(function (r) {
      return r.map(function (v) {
        v = v == null ? '' : String(v);
        return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
      }).join(',');
    }).join('\n');
  }
  function log(what, detail) {
    if (window.ADMIN && APP.session && APP.session.role === 'Admin') ADMIN.log(what, detail);
  }

  // --- 2027 CT / EBC planning workbook --------------------------------------
  // Sheet shape mirrors a planning submission: position lines by domain and
  // worker type, with funding source and the monthly forecast curve.
  function ebc() {
    var F = filters();
    var people = METRICS.filterWorkforce(DATA, F);
    var wft = METRICS.wftSeries(DATA).filter(function (m) { return m.forecast; });
    var fund = METRICS.fundingAlignment(DATA, F);
    var mix = METRICS.workforceMix(DATA, F);
    var wb = XLSX.utils.book_new();

    // Summary
    var summary = [
      ['2027 CT PLANNING SUBMISSION — WORKFORCE'],
      ['Generated', new Date().toISOString().slice(0, 10)],
      ['Data as of', stamp()],
      ['Basis', 'Illustrative prototype data — not a submission'],
      [],
      ['Metric', 'Value'],
      ['Total positions in scope', mix.total],
      ['FTE', mix.byType.FTE],
      ['Contractor', mix.byType.Contractor],
      ['Vendor', mix.byType.Vendor],
      ['BPO Hub', mix.byType['BPO Hub']],
      ['FTE share (current definition)', Math.round(mix.headline.ratio * 1000) / 10 + '%'],
      ['FTE target ratio', Math.round(DATA.policy.fteTargetRatio * 100) + '%'],
      ['Gap to target (positions)', mix.headline.gapHeads],
      ['BPO Hub counted as non-FTE', DATA.policy.bpoHubCountsAsNonFte ? 'Yes' : 'No'],
      [],
      ['Required positions', fund.totals.requiredFte],
      ['Funded positions', fund.totals.fundedFte],
      ['Assigned positions', fund.totals.assignedFte],
      ['Funding gap', fund.totals.fundingGap],
      ['Unfunded positions on roster', fund.unfundedPositions]
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), 'Summary');

    // Position lines aggregated for planning
    var agg = {};
    people.forEach(function (p) {
      var key = [p.domain, p.businessUnit, p.workerType, p.fundingSource, p.location].join('||');
      var a = agg[key] = agg[key] || { domain: p.domain, businessUnit: p.businessUnit, workerType: p.workerType,
                                       fundingSource: p.fundingSource, location: p.location, positions: 0, annualCost: 0 };
      a.positions++; a.annualCost += p.annualCost;
    });
    var lines = [['Domain', 'BusinessUnit', 'WorkerType', 'FundingSource', 'Location', 'Positions', 'AnnualCostUSD']];
    Object.keys(agg).sort().forEach(function (k) {
      var a = agg[k];
      lines.push([a.domain, a.businessUnit, a.workerType, a.fundingSource, a.location, a.positions, a.annualCost]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(lines), 'PositionLines');

    // Monthly forecast curve
    var fc = [['Month', 'FTE', 'Contractor', 'Vendor', 'BPOHub', 'Total', 'FTESharePct']];
    wft.forEach(function (m) {
      fc.push([m.month, m.fte, m.contractor, m.vendor, m.bpoHub, m.total, Math.round(m.fteRatio * 1000) / 10]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(fc), 'ForecastCurve');

    // Funding by domain
    var fd = [['Domain', 'RequiredFTE', 'FundedFTE', 'AssignedFTE', 'FundingGap', 'AssignmentGap']];
    fund.rows.forEach(function (r) {
      fd.push([r.domain, r.requiredFte, r.fundedFte, r.assignedFte, r.fundingGap, r.assignmentGap]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(fd), 'FundingByDomain');

    XLSX.writeFile(wb, 'bpo-hub-2027-CT-workforce-submission.xlsx');
    APP.toast('2027 CT workbook generated');
    log('Exported 2027 CT / EBC workbook', people.length + ' positions in scope');
  }

  // --- Jira import CSV -------------------------------------------------------
  function jira() {
    var F = filters();
    var as = METRICS.actionStats(DATA, F);
    var byIni = {}; DATA.initiatives.forEach(function (i) { byIni[i.id] = i; });
    var rows = [['Summary', 'Issue Type', 'Priority', 'Assignee', 'Due Date', 'Status', 'Labels', 'Epic Link', 'Description']];
    as.rows.forEach(function (a) {
      var ini = byIni[a.initiativeId];
      rows.push([
        a.title, 'Task', a.priority, a.owner, a.dueDate, a.status,
        [ini ? ini.domain.replace(/\s+/g, '-') : 'unassigned', a.overdue ? 'overdue' : ''].filter(Boolean).join(' '),
        a.initiativeId || '',
        (a.note || '') + (ini ? '\n\nInitiative: ' + ini.name + ' (owner: ' + ini.owner + ')' : '')
      ]);
    });
    download(csv(rows), 'bpo-hub-actions-jira-import.csv');
    APP.toast('Jira import CSV generated — ' + as.rows.length + ' items');
    log('Exported action items for Jira', as.rows.length + ' items');
  }

  // --- Workforce roster CSV --------------------------------------------------
  function roster() {
    var people = METRICS.filterWorkforce(DATA, filters());
    var cols = ['id', 'workerType', 'vendorName', 'team', 'domain', 'businessUnit', 'location',
                'capability', 'level', 'startDate', 'endDate', 'fundingSource', 'assignment', 'annualCost'];
    var rows = [cols];
    people.forEach(function (p) { rows.push(cols.map(function (c) { return p[c]; })); });
    download(csv(rows), 'bpo-hub-workforce-roster.csv');
    APP.toast('Roster exported — ' + people.length + ' positions');
    log('Exported workforce roster', people.length + ' positions');
  }

  return { ebc: ebc, jira: jira, roster: roster };
})();
