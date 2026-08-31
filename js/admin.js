/* ============================================================================
   ADMIN — actions menu, email drafts, reports, review flags, action log.
   Mounted ONLY when the session role is Admin; as Viewer none of this DOM
   exists. Drafts never send automatically.
   ============================================================================ */
var ADMIN = (function () {
  'use strict';

  var AUDIENCES = {
    'Leadership & Board': 'leadership@client.example',
    'Function Owners': 'function-owners@client.example',
    'BPO Hub Delivery Team': 'bpohub-delivery@client.example',
    'Wave Leads': 'wave-leads@client.example'
  };

  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) { return APP.esc(s); }
  function fmt$(v) { return APP.fmt.$(v); }
  function fmtM(v) { return APP.fmt.M(v); }
  function fmtPct(v) { return APP.fmt.pct(v); }

  // ---------- action log ----------
  function log(action, detail, audience) {
    var entries = JSON.parse(localStorage.getItem('bpoActionLog') || '[]');
    entries.unshift({
      ts: new Date().toISOString(),
      actor: APP.session ? APP.session.email : 'unknown',
      action: action, detail: detail || '', audience: audience || ''
    });
    localStorage.setItem('bpoActionLog', JSON.stringify(entries.slice(0, 500)));
  }

  // ---------- modal helpers ----------
  function openModal(html) {
    $('#modal-box').innerHTML = html;
    $('#modal-backdrop').classList.add('open');
  }
  function closeModal() { $('#modal-backdrop').classList.remove('open'); }
  document.addEventListener('click', function (e) {
    if (e.target === $('#modal-backdrop')) closeModal();
  });

  // ---------- draft builders (plain text, grounded in METRICS) ----------
  function plainStoryline(page) {
    var k = METRICS.kpis(DATA, APP.getFilters());
    return APP.generateStoryline(page || 1, k).replace(/<[^>]+>/g, '');
  }
  function kpiSnapshotText() {
    var k = METRICS.kpis(DATA, APP.getFilters());
    return [
      'KPI SNAPSHOT — as of ' + APP.fmt.date(DATA.meta.asOfDate),
      '-------------------------------------------',
      'Conversions exited:        ' + k.exited + ' / ' + k.inScope + ' (' + fmtPct(k.exitedPct) + ')',
      'Rolloff attainment:        ' + fmtPct(k.rolloffAttainment) + ' (' + k.exited + ' vs. ' + k.plannedToDate + ' planned to date)',
      'Overdue rolloffs:          ' + k.overdue + ' (avg ' + k.avgDelayDays + ' days late)',
      'YTD savings realized:      ' + fmtM(k.realizedUSD) + ' vs. ' + fmtM(k.planToDateUSD) + ' plan (' + fmt$(k.varianceUSD) + ')',
      'Realization ratio:         ' + fmtPct(k.realizationRate) + ' (trailing 2 completed quarters)',
      'Projected year-end:        ' + fmtM(k.projectedYearEndUSD) + ' vs. ' + fmtM(k.targetUSD) + ' target (' + fmt$(k.gapToTargetUSD) + ')',
      'Cost leakage (cumulative): ' + fmt$(k.leakageUSD),
      'Savings at risk:           ' + fmt$(k.savingsAtRiskUSD)
    ].join('\n');
  }
  function leadershipUpdateText() {
    var k = METRICS.kpis(DATA, APP.getFilters());
    var drivers = METRICS.driversOfGap(DATA, APP.getFilters(), 3);
    var zero = METRICS.zeroRealization(DATA, APP.getFilters());
    var od = METRICS.overdueDetail(DATA, APP.getFilters());
    return [
      'BPO HUB TRANSITION — LEADERSHIP UPDATE',
      'As of ' + APP.fmt.date(DATA.meta.asOfDate),
      '',
      'STATUS: ' + (k.behindPct > 0.1 ? 'BEHIND PLAN' : k.behindPct > 0 ? 'SLIGHTLY BEHIND PLAN' : 'ON PLAN'),
      '',
      plainStoryline(1),
      '',
      kpiSnapshotText(),
      '',
      'TOP 3 RISKS',
      '1. ' + (zero.length ? zero.length + ' functions at zero realization (' + fmt$(zero.reduce(function (a, z) { return a + z.plannedUSD; }, 0)) + ' planned): ' + zero.map(function (z) { return z.name; }).join(', ') : 'None flagged'),
      '2. ' + od.count + ' overdue Wave 2 rolloffs carrying ' + fmt$(od.cumulativeLeakageUSD) + ' of cumulative cost leakage',
      '3. Coverage gap of ' + k.coverageGap + ' roles exited before BPO Hub stabilization (delivery risk)',
      '',
      'ASKS',
      '- Confirm the savings basis (exit vs. stabilization) with the data owner',
      '- Resolve the unallocated reconciliation gap before locking the baseline',
      '- Sponsor decision on pulling forward the zero-realization infrastructure functions',
      '',
      'DRIVERS OF THE GAP',
      drivers.map(function (d, i) { return (i + 1) + '. ' + d.name + ' — ' + fmt$(d.gapUSD) + ' unrealized'; }).join('\n')
    ].join('\n');
  }
  function functionOwnerText(fnName) {
    var filters = { functionName: [fnName] };
    var k = METRICS.kpis(DATA, filters);
    var od = METRICS.overdueDetail(DATA, filters);
    var lines = [
      'BPO HUB TRANSITION — FUNCTION REPORT: ' + fnName.toUpperCase(),
      'As of ' + APP.fmt.date(DATA.meta.asOfDate),
      '',
      'Scope: ' + k.inScope + ' roles · ' + k.exited + ' exited (' + fmtPct(k.exitedPct) + ')',
      'Savings: ' + fmt$(k.realizedUSD) + ' realized vs. ' + fmt$(k.plannedFYUSD) + ' full-year plan',
      ''
    ];
    if (od.count) {
      lines.push('OVERDUE ROLLOFFS (' + od.count + ')');
      od.roles.slice(0, 12).forEach(function (r) {
        lines.push('- ' + r.id + ' · target ' + r.plannedExitDate + ' · KT: ' + r.ktStage);
      });
      lines.push('');
    }
    lines.push('ASK: confirm exit dates for the roles above and a recovery plan for unrealized savings of ' +
      fmt$(Math.max(0, k.plannedFYUSD - k.realizedUSD)) + '.');
    lines.push('DUE: end of week, to the program lead.');
    return lines.join('\n');
  }

  // ---------- composer ----------
  function composer(title, defaultAudience, body) {
    var opts = Object.keys(AUDIENCES).map(function (a) {
      return '<option' + (a === defaultAudience ? ' selected' : '') + '>' + esc(a) + '</option>';
    }).join('');
    openModal(
      '<h3>' + esc(title) + '</h3>' +
      '<div class="modal-sub">Pre-drafted from the current filtered data and storyline — edit freely.</div>' +
      '<label class="fld">Audience</label><select id="em-aud">' + opts + '</select>' +
      '<label class="fld">Subject</label><input type="text" id="em-subj" value="' +
        esc('BPO Hub Transition — status as of ' + APP.fmt.date(DATA.meta.asOfDate)) + '">' +
      '<label class="fld">Body</label><textarea id="em-body">' + esc(body) + '</textarea>' +
      '<div class="note-strip">Draft only — nothing sends automatically.</div>' +
      '<div class="modal-actions">' +
      '<button class="btn-ghost" id="em-copy">Copy to clipboard</button>' +
      '<button class="btn-ghost" id="em-eml">Download .eml</button>' +
      '<button class="btn-ghost" id="em-mailto">Open in mail client</button>' +
      '<button class="btn-primary" style="width:auto;padding:10px 22px" id="em-close">Done</button></div>'
    );
    $('#em-copy').onclick = function () {
      navigator.clipboard.writeText($('#em-body').value).then(function () { APP.toast('Draft copied to clipboard'); });
      log('Copied email draft', $('#em-subj').value, $('#em-aud').value);
    };
    $('#em-mailto').onclick = function () {
      var to = AUDIENCES[$('#em-aud').value];
      location.href = 'mailto:' + to + '?subject=' + encodeURIComponent($('#em-subj').value) +
        '&body=' + encodeURIComponent($('#em-body').value.slice(0, 1800));
      log('Opened email draft in mail client', $('#em-subj').value, $('#em-aud').value);
    };
    $('#em-eml').onclick = function () {
      var to = AUDIENCES[$('#em-aud').value];
      var eml = 'To: ' + to + '\r\nSubject: ' + $('#em-subj').value +
        '\r\nX-Unsent: 1\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n' + $('#em-body').value;
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([eml], { type: 'message/rfc822' }));
      a.download = 'bpo-hub-update.eml'; a.click(); URL.revokeObjectURL(a.href);
      log('Downloaded .eml draft', $('#em-subj').value, $('#em-aud').value);
    };
    $('#em-close').onclick = closeModal;
  }

  function flagForReview(fnName, isAnomaly) {
    var row = METRICS.byDimension(DATA, null, 'functionName').filter(function (x) { return x.key === fnName; })[0];
    if (!row) return;
    var prior = DATA.prior && DATA.prior.realizationByFunction ? DATA.prior.realizationByFunction[fnName] : null;
    var body = [
      'DATA REVIEW REQUEST — ' + fnName,
      '',
      'Metric:         Savings realization',
      'Current value:  ' + fmtPct(row.savingsAttainment) + ' (' + fmt$(row.realizedUSD) + ' of ' + fmt$(row.plannedUSD) + ')',
      'Prior value:    ' + (prior != null ? fmtPct(prior) : 'n/a'),
      'Expected range: within the program trailing rate of ' + fmtPct(METRICS.kpis(DATA, null).realizationRate) + ' ± 15 pts',
      '',
      'Why it looks wrong: ' + (isAnomaly ?
        'week-over-week movement exceeds two standard deviations of the population — please confirm the underlying exit records and savings postings.' :
        'realization is materially behind the allocated plan — please confirm exit dates, postings, and whether the plan allocation is still valid.'),
      '',
      'Requested: data owner review before the next leadership distribution.'
    ].join('\n');
    composer('Flag for review — ' + fnName, 'BPO Hub Delivery Team', body);
    log('Flagged for review', fnName + (isAnomaly ? ' (anomaly)' : ' (Red status)'));
  }

  function showActionLog() {
    var entries = JSON.parse(localStorage.getItem('bpoActionLog') || '[]');
    var rows = entries.map(function (e) {
      return '<tr><td>' + new Date(e.ts).toLocaleString() + '</td><td>' + esc(e.actor) + '</td><td>' +
        esc(e.action) + '</td><td>' + esc(e.detail) + '</td><td>' + esc(e.audience) + '</td></tr>';
    }).join('');
    openModal('<h3>Action log</h3><div class="modal-sub">Every admin action taken in this browser, newest first.</div>' +
      '<div style="max-height:340px;overflow:auto"><table class="matrix"><thead><tr><th>Timestamp</th><th>Actor</th><th>Action</th><th>Detail</th><th>Audience</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="5" style="color:var(--muted)">No actions logged yet.</td></tr>') + '</tbody></table></div>' +
      '<div class="modal-actions"><button class="btn-ghost" id="log-csv">Export CSV</button>' +
      '<button class="btn-primary" style="width:auto;padding:10px 22px" id="log-close">Close</button></div>');
    $('#log-csv').onclick = function () {
      var csv = 'timestamp,actor,action,detail,audience\n' + entries.map(function (e) {
        return [e.ts, e.actor, e.action, e.detail, e.audience].map(function (v) {
          return '"' + String(v).replace(/"/g, '""') + '"';
        }).join(',');
      }).join('\n');
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      a.download = 'bpo-hub-action-log.csv'; a.click(); URL.revokeObjectURL(a.href);
      log('Exported action log CSV');
    };
    $('#log-close').onclick = closeModal;
  }

  function ownerReportPicker() {
    var fns = METRICS.byDimension(DATA, null, 'functionName');
    openModal('<h3>Function owner report</h3><div class="modal-sub">Pre-filtered to the owner’s scope — overdue rolloffs and unrealized savings, with a specific ask.</div>' +
      '<label class="fld">Function</label><select id="fo-fn">' + fns.map(function (f) {
        return '<option>' + esc(f.key) + '</option>';
      }).join('') + '</select>' +
      '<div class="modal-actions"><button class="btn-primary" style="width:auto;padding:10px 22px" id="fo-go">Draft report</button></div>');
    $('#fo-go').onclick = function () {
      var fn = $('#fo-fn').value;
      composer('Function owner report — ' + fn, 'Function Owners', functionOwnerText(fn));
      log('Drafted function owner report', fn, 'Function Owners');
    };
  }

  // ---------- mount ----------
  function mount(slot) {
    slot.innerHTML = '<button class="chip-btn accent" id="actions-btn">Actions ▾</button>' +
      '<div class="menu-pop" id="actions-menu">' +
      '<div class="menu-head">Communicate</div>' +
      '<button id="act-email">Compose email to an audience…</button>' +
      '<button id="act-lead">Leadership &amp; board update…</button>' +
      '<button id="act-owner">Function owner report…</button>' +
      '<div class="menu-head">Data</div>' +
      '<button id="act-upload">Upload data (Excel)…</button>' +
      '<button id="act-template">Download blank template</button>' +
      '<div class="menu-head">Governance</div>' +
      '<button id="act-log">Action log…</button>' +
      '<button id="act-print">Print / export current view</button>' +
      '</div>';
    $('#actions-btn').onclick = function (e) {
      e.stopPropagation(); $('#actions-menu').classList.toggle('open');
    };
    $('#act-email').onclick = function () {
      composer('Compose email', 'Leadership & Board', plainStoryline(1) + '\n\n' + kpiSnapshotText());
      log('Opened email composer', '', 'Leadership & Board');
    };
    $('#act-lead').onclick = function () {
      composer('Leadership & board update', 'Leadership & Board', leadershipUpdateText());
      log('Generated leadership update', '', 'Leadership & Board');
    };
    $('#act-owner').onclick = ownerReportPicker;
    $('#act-upload').onclick = function () { if (window.UPLOAD) UPLOAD.openModal(); };
    $('#act-template').onclick = function () { if (window.UPLOAD) UPLOAD.downloadTemplate(); log('Downloaded blank template'); };
    $('#act-log').onclick = showActionLog;
    $('#act-print').onclick = function () { window.print(); log('Printed current view'); };
  }

  return { mount: mount, flagForReview: flagForReview, log: log, openModal: openModal, closeModal: closeModal };
})();
