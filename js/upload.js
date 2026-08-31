/* ============================================================================
   UPLOAD — weekly Excel refresh. Parsed entirely client-side with SheetJS;
   nothing leaves the browser. Validates, previews deltas, then commits to
   localStorage so change detection survives a reload.
   ============================================================================ */

var UPLOAD = (function () {
  'use strict';

  function $(s) { return document.querySelector(s); }
  function esc(s) { return APP.esc(s); }

  var ROLE_COLS = ['id', 'functionName', 'businessUnit', 'location', 'domain', 'wave',
    'plannedExitDate', 'actualExitDate', 'status', 'ktStatus', 'ktStage',
    'onshoreAnnualCost', 'bpoAnnualCost', 'plannedSavingsUSD', 'realizedSavingsUSD',
    'bpoHireDate', 'bpoStartOnTime'];
  var REQUIRED = ['id', 'functionName', 'wave', 'plannedExitDate', 'status', 'ktStatus',
    'onshoreAnnualCost', 'plannedSavingsUSD'];
  var STATUSES = ['Exited', 'Stabilized', 'In Progress', 'Not Started'];
  var KT_STATUSES = ['Complete', 'In Progress', 'Not Started'];
  var KT_STAGES = ['Not started', 'Phase 1 — Access setup', 'Phase 2 — KT / playback',
    'Phase 3 — Secondary support', 'Phase 4 — Primary support', 'Complete'];
  var WAVES = ['W1', 'W2', 'W3', 'W4'];

  // ---------- template ----------
  function downloadTemplate() {
    var wb = XLSX.utils.book_new();
    var sample = DATA.roles.slice(0, 3).map(function (r) {
      var row = {};
      ROLE_COLS.forEach(function (c) { row[c] = r[c]; });
      return row;
    });
    var wsRoles = XLSX.utils.json_to_sheet(sample, { header: ROLE_COLS });
    XLSX.utils.book_append_sheet(wb, wsRoles, 'Roles');
    var wsPeriods = XLSX.utils.json_to_sheet(DATA.periods.map(function (p) {
      return { period: p.period, plannedSavingsUSD: p.plannedSavingsUSD,
               actualSavingsUSD: p.actualSavingsUSD, partial: p.partial ? 'Y' : 'N' };
    }), { header: ['period', 'plannedSavingsUSD', 'actualSavingsUSD', 'partial'] });
    XLSX.utils.book_append_sheet(wb, wsPeriods, 'Periods');
    var wsMeta = XLSX.utils.aoa_to_sheet([
      ['key', 'value'],
      ['asOfDate', DATA.meta.asOfDate],
      ['targetSavingsUSD', DATA.meta.targetSavingsUSD],
      ['planToDateUSD', DATA.meta.planToDateUSD],
      ['leakageCumulativeUSD', DATA.meta.leakageCumulativeUSD],
      ['savingsAtRiskUSD', DATA.meta.savingsAtRiskUSD]
    ]);
    XLSX.utils.book_append_sheet(wb, wsMeta, 'Meta');
    var wsReadme = XLSX.utils.aoa_to_sheet([
      ['BPO Hub Transition — weekly data template'],
      [''],
      ['One row per role on the Roles sheet. The three rows included are EXAMPLES — replace them.'],
      ['Dates: YYYY-MM-DD. Costs and savings: whole US dollars, numeric.'],
      ['status: ' + STATUSES.join(' | ')],
      ['ktStatus: ' + KT_STATUSES.join(' | ')],
      ['ktStage: ' + KT_STAGES.join(' | ')],
      ['wave: ' + WAVES.join(' | ')],
      ['bpoStartOnTime: TRUE / FALSE, blank if not hired'],
      ['Leave actualExitDate blank for roles not yet exited.'],
      ['Periods sheet: one row per quarter, actuals blank for future quarters, partial = Y for the current quarter.'],
      ['Meta sheet: update asOfDate every submission.']
    ]);
    XLSX.utils.book_append_sheet(wb, wsReadme, 'ReadMe');
    XLSX.writeFile(wb, 'bpo-hub-weekly-template.xlsx');
    APP.toast('Blank template downloaded');
  }

  // ---------- parsing helpers ----------
  function toISO(v) {
    if (v == null || v === '') return null;
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if (typeof v === 'number') { // Excel serial
      var d = new Date(Math.round((v - 25569) * 86400 * 1000));
      return d.toISOString().slice(0, 10);
    }
    var s = String(v).trim().slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : String(v);
  }
  function validDate(s) { return s == null || (/^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + 'T00:00:00'))); }

  // ---------- validation ----------
  function validate(rolesRaw, periodsRaw) {
    var errors = [], warnings = [], passes = [];
    if (!rolesRaw.length) { errors.push({ row: '-', msg: 'Roles sheet is empty or missing.' }); return { errors: errors, warnings: warnings, passes: passes }; }

    var cols = Object.keys(rolesRaw[0]);
    var missing = REQUIRED.filter(function (c) { return cols.indexOf(c) < 0; });
    if (missing.length) errors.push({ row: 'header', msg: 'Missing required columns: ' + missing.join(', ') });
    else passes.push('All required columns present (' + REQUIRED.length + ')');

    var ids = {};
    var dupes = 0, badDates = 0, badStatus = 0, badCost = 0;
    rolesRaw.forEach(function (r, i) {
      var row = i + 2; // header offset, 1-indexed
      if (ids[r.id]) { errors.push({ row: row, msg: 'Duplicate role id "' + r.id + '"' }); dupes++; }
      ids[r.id] = true;
      ['plannedExitDate', 'actualExitDate', 'bpoHireDate'].forEach(function (c) {
        if (r[c] != null && r[c] !== '' && !validDate(toISO(r[c]))) { errors.push({ row: row, msg: 'Invalid date in ' + c + ': "' + r[c] + '"' }); badDates++; }
      });
      if (STATUSES.indexOf(r.status) < 0) { errors.push({ row: row, msg: 'Status "' + r.status + '" not in allowed set' }); badStatus++; }
      if (r.ktStatus != null && KT_STATUSES.indexOf(r.ktStatus) < 0) { errors.push({ row: row, msg: 'KT status "' + r.ktStatus + '" not in allowed set' }); badStatus++; }
      if (r.wave != null && WAVES.indexOf(String(r.wave)) < 0) warnings.push({ row: row, msg: 'Wave "' + r.wave + '" is not W1–W4' });
      ['onshoreAnnualCost', 'plannedSavingsUSD', 'realizedSavingsUSD', 'bpoAnnualCost'].forEach(function (c) {
        if (r[c] != null && r[c] !== '' && isNaN(Number(r[c]))) { errors.push({ row: row, msg: c + ' is not numeric: "' + r[c] + '"' }); badCost++; }
      });
    });
    if (!dupes) passes.push('Role IDs are unique (' + rolesRaw.length + ' rows)');
    if (!badDates) passes.push('All dates parse as YYYY-MM-DD');
    if (!badStatus) passes.push('Statuses within the allowed sets');
    if (!badCost) passes.push('Costs and savings are numeric');

    if (rolesRaw.length !== DATA.meta.inScopeRoles) {
      warnings.push({ row: '-', msg: 'Row count (' + rolesRaw.length + ') differs from the current in-scope population (' + DATA.meta.inScopeRoles + ') — confirm scope change intended.' });
    } else passes.push('Row count reconciles to the in-scope population (' + rolesRaw.length + ')');

    if (!periodsRaw || !periodsRaw.length) warnings.push({ row: '-', msg: 'No Periods sheet found — quarterly series will be kept from the current dataset.' });
    else passes.push('Periods sheet found (' + periodsRaw.length + ' quarters)');

    return { errors: errors.slice(0, 40), warnings: warnings.slice(0, 20), passes: passes };
  }

  // ---------- transform to DATA shape ----------
  function buildDataset(rolesRaw, periodsRaw, metaRaw) {
    var meta = JSON.parse(JSON.stringify(DATA.meta));
    (metaRaw || []).forEach(function (kv) {
      if (kv.key && meta.hasOwnProperty(kv.key)) {
        meta[kv.key] = kv.key === 'asOfDate' ? toISO(kv.value) : Number(kv.value) || meta[kv.key];
      }
    });
    meta.lastRefresh = new Date().toISOString();
    meta.inScopeRoles = rolesRaw.length;
    var A = new Date(meta.asOfDate + 'T00:00:00');

    var roles = rolesRaw.map(function (r) {
      var planned = toISO(r.plannedExitDate), actual = toISO(r.actualExitDate);
      var exited = !!actual;
      var overdue = !exited && planned && new Date(planned + 'T00:00:00') < A;
      var v = exited && planned ? Math.round((new Date(actual) - new Date(planned)) / 86400000) : null;
      var ktStage = r.ktStage || (r.ktStatus === 'Complete' ? 'Complete' : r.ktStatus === 'In Progress' ? 'Phase 2 — KT / playback' : 'Not started');
      return {
        id: String(r.id), functionName: String(r.functionName || 'Unmapped / Unclassified'),
        businessUnit: String(r.businessUnit || 'Operations'), location: String(r.location || 'Onshore — Site 1'),
        domain: String(r.domain || 'Unclassified'), wave: String(r.wave || 'W4'),
        plannedExitDate: planned, actualExitDate: actual, exitVarianceDays: v, overdue: overdue,
        status: String(r.status), ktStatus: String(r.ktStatus || 'Not Started'), ktStage: ktStage,
        statusBucket: exited ? (ktStage === 'Complete' ? 'Exited & stabilized' : 'Exited, stabilizing')
          : (overdue ? 'Overdue / at risk' : 'In progress, not exited'),
        varianceBucket: !exited ? 'Not exited' : v < -15 ? '>15d early' : v < 0 ? '1–15d early'
          : v === 0 ? 'On time' : v <= 30 ? '1–30d late' : '>30d late',
        onshoreAnnualCost: Number(r.onshoreAnnualCost) || 0, bpoAnnualCost: Number(r.bpoAnnualCost) || 0,
        plannedSavingsUSD: Number(r.plannedSavingsUSD) || 0, realizedSavingsUSD: Number(r.realizedSavingsUSD) || 0,
        bpoHireDate: toISO(r.bpoHireDate),
        bpoStartOnTime: r.bpoHireDate ? (String(r.bpoStartOnTime).toUpperCase() === 'TRUE' || r.bpoStartOnTime === true) : null
      };
    });

    var periods = DATA.periods;
    if (periodsRaw && periodsRaw.length) {
      var cp = 0, ca = 0;
      periods = periodsRaw.map(function (p) {
        var q = {
          period: String(p.period),
          plannedSavingsUSD: Number(p.plannedSavingsUSD) || 0,
          actualSavingsUSD: p.actualSavingsUSD === '' || p.actualSavingsUSD == null ? null : Number(p.actualSavingsUSD),
          partial: String(p.partial).toUpperCase() === 'Y' || p.partial === true
        };
        cp += q.plannedSavingsUSD; q.cumPlanned = cp;
        if (q.actualSavingsUSD != null) { ca += q.actualSavingsUSD; q.cumActual = ca; } else q.cumActual = null;
        q.realizationRate = q.actualSavingsUSD != null && !q.partial ? q.actualSavingsUSD / q.plannedSavingsUSD : null;
        return q;
      });
    }

    // function reference table derived from the uploaded roles
    var fnMap = {};
    roles.forEach(function (r) {
      var f = fnMap[r.functionName] = fnMap[r.functionName] ||
        { name: r.functionName, businessUnit: r.businessUnit, domain: r.domain,
          baselineHeadcount: 0, exitedHeadcount: 0, baselineCostUSD: 0, plannedSavingsUSD: 0, realizedSavingsUSD: 0 };
      f.baselineHeadcount++; if (r.actualExitDate) f.exitedHeadcount++;
      f.baselineCostUSD += r.onshoreAnnualCost;
      f.plannedSavingsUSD += r.plannedSavingsUSD; f.realizedSavingsUSD += r.realizedSavingsUSD;
    });
    var functions = Object.keys(fnMap).map(function (k) {
      var f = fnMap[k]; f.varianceUSD = f.realizedSavingsUSD - f.plannedSavingsUSD; return f;
    });

    // snapshot the CURRENT dataset as "prior" so change detection compares against it
    var curK = METRICS.kpis(DATA, null);
    var priorFn = {};
    METRICS.byDimension(DATA, null, 'functionName').forEach(function (x) { priorFn[x.key] = x.savingsAttainment; });
    var prior = {
      asOfDate: DATA.meta.asOfDate, exited: curK.exited, stabilized: curK.stabilized, overdue: curK.overdue,
      realizedUSD: curK.realizedUSD, planToDateUSD: curK.planToDateUSD,
      leakageCumulativeUSD: DATA.meta.leakageCumulativeUSD, hiresOnTimePct: curK.hireOnTimePct,
      realizationByFunction: priorFn
    };

    return { meta: meta, roles: roles, periods: periods, functions: functions, leakage: DATA.leakage, prior: prior };
  }

  // ---------- modal flow ----------
  var parsed = null;

  function openModal() {
    parsed = null;
    ADMIN.openModal(
      '<h3>Upload weekly data</h3>' +
      '<div class="modal-sub">Drop the completed Excel template. Parsed entirely in your browser — nothing is uploaded to any server.</div>' +
      '<div class="drop-zone" id="drop-zone">Drag &amp; drop the .xlsx / .csv here, or <u>click to browse</u>' +
      '<input type="file" id="file-input" accept=".xlsx,.xls,.csv" style="display:none"></div>' +
      '<div class="vald-list" id="vald-out"></div>' +
      '<div class="modal-actions" id="upload-actions">' +
      '<button class="btn-ghost" id="up-template">Download blank template</button>' +
      '<button class="btn-ghost" id="up-cancel">Cancel</button></div>'
    );
    var dz = $('#drop-zone'), fi = $('#file-input');
    dz.onclick = function () { fi.click(); };
    dz.ondragover = function (e) { e.preventDefault(); dz.classList.add('drag'); };
    dz.ondragleave = function () { dz.classList.remove('drag'); };
    dz.ondrop = function (e) { e.preventDefault(); dz.classList.remove('drag'); if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]); };
    fi.onchange = function () { if (fi.files.length) handleFile(fi.files[0]); };
    $('#up-template').onclick = downloadTemplate;
    $('#up-cancel').onclick = ADMIN.closeModal;
  }

  function handleFile(file) {
    var reader = new FileReader();
    reader.onload = function (e) {
      var out = $('#vald-out');
      try {
        var wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });
        var rolesSheet = wb.Sheets['Roles'] || wb.Sheets[wb.SheetNames[0]];
        var rolesRaw = XLSX.utils.sheet_to_json(rolesSheet, { defval: null });
        var periodsRaw = wb.Sheets['Periods'] ? XLSX.utils.sheet_to_json(wb.Sheets['Periods'], { defval: null }) : null;
        var metaRaw = wb.Sheets['Meta'] ? XLSX.utils.sheet_to_json(wb.Sheets['Meta'], { defval: null }) : null;
        var v = validate(rolesRaw, periodsRaw);

        var html = '<div style="font-weight:500;color:var(--aberdeen-blue);margin-bottom:4px">' + esc(file.name) + ' — validation</div>';
        html += v.passes.map(function (p) { return '<div class="ok">✓ ' + esc(p) + '</div>'; }).join('');
        if (v.warnings.length) {
          html += v.warnings.map(function (w) { return '<div class="warn2">⚠ ' + (w.row !== '-' ? 'Row ' + w.row + ': ' : '') + esc(w.msg) + '</div>'; }).join('');
        }
        if (v.errors.length) {
          html += '<div class="err" style="font-weight:500;margin-top:6px">✕ ' + v.errors.length + ' blocking error(s) — fix and re-upload:</div>' +
            '<table><tr><th>Row</th><th>Problem</th></tr>' +
            v.errors.map(function (er) { return '<tr><td>' + esc(String(er.row)) + '</td><td class="err">' + esc(er.msg) + '</td></tr>'; }).join('') + '</table>';
          out.innerHTML = html;
          return;
        }

        // preview deltas vs. current
        parsed = buildDataset(rolesRaw, periodsRaw, metaRaw);
        var oldK = METRICS.kpis(DATA, null);
        var newK = METRICS.kpis(parsed, null);
        function d(label, from, to, fmt) {
          var delta = to - from;
          return '<tr><td>' + label + '</td><td class="num">' + fmt(from) + '</td><td class="num">' + fmt(to) +
            '</td><td class="num" style="color:' + (delta === 0 ? 'var(--muted)' : 'var(--aberdeen-blue)') + '">' +
            (delta > 0 ? '+' : '') + fmt(delta).replace('$-', '-$') + '</td></tr>';
        }
        var n = function (x) { return String(Math.round(x)); };
        html += '<div style="font-weight:500;color:var(--aberdeen-blue);margin:10px 0 4px">Preview — top metric changes vs. current</div>' +
          '<table><tr><th>Metric</th><th>Current</th><th>Uploaded</th><th>Δ</th></tr>' +
          d('Roles in scope', oldK.inScope, newK.inScope, n) +
          d('Exited', oldK.exited, newK.exited, n) +
          d('Stabilized', oldK.stabilized, newK.stabilized, n) +
          d('Overdue', oldK.overdue, newK.overdue, n) +
          d('Savings realized', oldK.realizedUSD, newK.realizedUSD, APP.fmt.$) +
          d('Projected year-end', oldK.projectedYearEndUSD, newK.projectedYearEndUSD, APP.fmt.$) +
          '</table>';
        if (v.warnings.length) {
          html += '<label style="display:flex;gap:8px;align-items:center;margin-top:10px;font-size:12px">' +
            '<input type="checkbox" id="ack-warn"> I acknowledge the warnings above</label>';
        }
        out.innerHTML = html;
        var actions = $('#upload-actions');
        actions.innerHTML = '<button class="btn-ghost" id="up-cancel2">Cancel</button>' +
          '<button class="btn-primary" style="width:auto;padding:10px 26px" id="up-confirm">Confirm &amp; refresh dashboard</button>';
        $('#up-cancel2').onclick = ADMIN.closeModal;
        $('#up-confirm').onclick = function () {
          if (v.warnings.length && !(document.getElementById('ack-warn') || {}).checked) {
            APP.toast('Acknowledge the warnings to continue'); return;
          }
          commit(file.name);
        };
      } catch (err) {
        out.innerHTML = '<div class="err">✕ Could not parse the file: ' + esc(err.message) + '</div>';
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function commit(fileName) {
    DATA.prior = parsed.prior;
    DATA.meta = parsed.meta; DATA.roles = parsed.roles;
    DATA.periods = parsed.periods; DATA.functions = parsed.functions; DATA.leakage = parsed.leakage;
    try {
      localStorage.setItem('bpoTrackerData', JSON.stringify({
        meta: DATA.meta, roles: DATA.roles, periods: DATA.periods,
        functions: DATA.functions, leakage: DATA.leakage, prior: DATA.prior
      }));
    } catch (e) { /* storage full — session-only refresh */ }
    ADMIN.log('Uploaded dataset', fileName + ' · ' + DATA.roles.length + ' roles · as of ' + DATA.meta.asOfDate);
    ADMIN.closeModal();
    APP.refreshData();
  }

  function resetToDemo() {
    localStorage.removeItem('bpoTrackerData');
    location.reload();
  }

  return { openModal: openModal, downloadTemplate: downloadTemplate, resetToDemo: resetToDemo };
})();
