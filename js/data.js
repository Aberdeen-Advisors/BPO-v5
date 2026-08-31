/* ============================================================================
   BPO Hub Transition — Cost & Savings Tracker · DATA MODEL
   ----------------------------------------------------------------------------
   This dataset is ILLUSTRATIVE AND ANONYMIZED. Functions, business units,
   locations, role IDs, and role-level costs are synthetic (role-level figures
   rounded to the nearest $1,000). Aggregate totals reconcile to the approved
   program wireframe: $2.8M YTD actual · $3.4M plan-to-date · $6.0M target ·
   $496K unrealized across the four zero-realization functions.
   Real program data enters this tool ONLY via the in-browser Excel upload
   (Admin → Upload data) — never by committing files to this repository.
   ============================================================================ */

var DATA = (function () {
  'use strict';

  // --- Program constants (change targets here) ------------------------------
  var META = {
    programName: 'BPO Hub Transition',
    asOfDate: '2026-08-15',
    lastRefresh: '2026-08-15T06:30:00',
    targetSavingsUSD: 6000000,      // leadership baseline commitment
    planToDateUSD: 3400000,         // time-phased plan through as-of date
    inScopeRoles: 200,
    baselineOnshoreCostUSD: 28400000, // fully-loaded, annualized
    ytdOnshoreEliminatedUSD: 4200000, // gross onshore spend stopped YTD (time-phased)
    ytdBpoCostAddedUSD: 1400000,      // BPO Hub run cost added YTD
    savingsAtRiskUSD: 1100000,        // tied to at-risk / unstarted exits
    leakageCumulativeUSD: 380000,     // cumulative cost of delayed exits
    functionAllocatedPlanUSD: 4707000, // full-year plan allocated to functions
    staleAfterDays: 8
  };

  // --- Function master (source of truth for allocations) --------------------
  // [name, businessUnit, domain, headcount, exited, planFullYearK, actualK, onshoreRateK]
  var FN = [
    ['Transaction Processing',    'Operations',          'Process Operations', 36, 15, 620, 260, 130],
    ['Unmapped / Unclassified',   'Corporate Services',  'Unclassified',       30, 22, 874, 638, 155],
    ['Client Support & Compliance','Operations',         'Service & Support',  30, 13, 540, 232, 128],
    ['Data & Analytics',          'Technology Services', 'Data',               21, 14, 410, 275, 160],
    ['Enterprise Systems',        'Technology Services', 'Applications',       16, 15, 310, 291, 150],
    ['Digital Operations (ALM)',  'Technology Services', 'Applications',       16, 10, 466, 289, 175],
    ['Tier 1 Support',            'Operations',          'Service & Support',   8,  8, 233, 233, 110],
    ['End User Computing',        'Technology Services', 'Service & Support',   7,  1, 205,  29, 120],
    ['Data Processing',           'Operations',          'Process Operations',  6,  6, 175, 175, 115],
    ['Storage & Backup',          'Technology Services', 'Infrastructure',      5,  0, 146,   0, 145],
    ['Compute Infrastructure',    'Technology Services', 'Infrastructure',      5,  0, 146,   0, 148],
    ['Cloud Support',             'Technology Services', 'Infrastructure',      5,  0, 146,   0, 150],
    ['Middleware',                'Technology Services', 'Infrastructure',      5,  5, 146, 146, 140],
    ['Client Systems',            'Technology Services', 'Service & Support',   5,  5, 146, 146, 138],
    ['Database Administration',   'Technology Services', 'Infrastructure',      2,  0,  58,   0, 165],
    ['Tier 2 Support',            'Operations',          'Service & Support',   2,  2,  58,  58, 118],
    ['Task Processing',           'Operations',          'Process Operations',  1,  1,  28,  28, 112]
  ];
  var ZERO_REALIZATION = ['Storage & Backup', 'Compute Infrastructure', 'Cloud Support', 'Database Administration'];

  // --- Quarterly savings periods ($K) — time-phased plan vs. actual ---------
  var PERIODS = [
    { period: 'Q1 (Feb–Mar)', plannedSavingsUSD: 600000,  actualSavingsUSD: 510000,  partial: false },
    { period: 'Q2 (Apr–Jun)', plannedSavingsUSD: 1500000, actualSavingsUSD: 1000000, partial: false },
    { period: 'Q3 (Jul–Sep)', plannedSavingsUSD: 1300000, actualSavingsUSD: 1290000, partial: true  },
    { period: 'Q4 (Oct–Dec)', plannedSavingsUSD: 2600000, actualSavingsUSD: null,    partial: false, future: true }
  ];
  var cp = 0, ca = 0;
  PERIODS.forEach(function (q) {
    cp += q.plannedSavingsUSD; q.cumPlanned = cp;
    if (q.actualSavingsUSD != null) { ca += q.actualSavingsUSD; q.cumActual = ca; } else { q.cumActual = null; }
    q.realizationRate = (q.actualSavingsUSD != null && !q.partial) ? q.actualSavingsUSD / q.plannedSavingsUSD : null;
  });

  // --- Rolloff cost leakage — cumulative by month ($) ------------------------
  var LEAKAGE = [
    { month: 'Mar', cumulativeUSD: 40000 },
    { month: 'Apr', cumulativeUSD: 85000 },
    { month: 'May', cumulativeUSD: 140000 },
    { month: 'Jun', cumulativeUSD: 210000 },
    { month: 'Jul', cumulativeUSD: 300000 },
    { month: 'Aug (MTD)', cumulativeUSD: 380000 }
  ];

  // --- Role generation -------------------------------------------------------
  // Deterministic build that satisfies every aggregate simultaneously:
  //   waves  — planned 51/72/45/32 · exited 51/53/13/0
  //   status — 70 stabilized · 47 exited-stabilizing · 19 overdue (Wave 2) · 64 in progress
  //   KT     — 89 not started · 3/14/19/5 in flight · 70 complete
  //   hires  — 199 of 200 hired · 174 on time (87%)
  var AS_OF = new Date('2026-08-15T00:00:00');
  var SITES = ['Onshore — Site 1', 'Onshore — Site 2', 'Onshore — Site 3'];

  function iso(d) { return d.toISOString().slice(0, 10); }
  function addDays(dstr, n) { var d = new Date(dstr + 'T00:00:00'); d.setDate(d.getDate() + n); return iso(d); }

  // Wave capacity ledgers
  var exitCap = { W1: 51, W2: 53, W3: 13 };            // exited roles per wave
  var openCap = { W2: 19, W3: 32, W4: 32 };            // not-yet-exited roles per wave

  // Exit-date variance buckets, assigned per wave so every actual exit ≤ as-of:
  //   W1: 14 × −20d · 10 × −8d · 11 × 0d · 3 × +14d · 13 × +38d
  //   W2: 40 × +14d · 13 × +38d       W3: 13 × −8d
  var varianceLedger = {
    W1: [].concat(rep(-20, 14), rep(-8, 10), rep(0, 11), rep(14, 3), rep(38, 13)),
    W2: [].concat(rep(14, 40), rep(38, 13)),
    W3: rep(-8, 13)
  };
  function rep(v, n) { var a = []; for (var i = 0; i < n; i++) a.push(v); return a; }

  // Planned-exit date generators per wave (deterministic spread)
  var waveDateSeq = { W1: 0, W2: 0, W3x: 0, W3o: 0, W4: 0, W2ov: 0 };
  function plannedDate(wave, exited, lateBig) {
    if (wave === 'W1') { return addDays('2026-02-10', (waveDateSeq.W1++ * 121) % 125); }          // Feb 10 – Jun 14
    if (wave === 'W2' && exited) {
      if (lateBig) return addDays('2026-07-01', (waveDateSeq.W2 % 8));                              // early Jul (so +38d ≤ as-of)
      return addDays('2026-07-03', (waveDateSeq.W2++ * 7) % 28);                                    // Jul 3–31
    }
    if (wave === 'W2') { return addDays('2026-08-15', -(1 + (waveDateSeq.W2ov++ % 19))); }          // overdue: 1–19 days past due (mean 10)
    if (wave === 'W3' && exited) { return addDays('2026-08-16', (waveDateSeq.W3x++ % 8)); }         // Aug 16–23 · exited 8d early → ≤ as-of
    if (wave === 'W3') { return addDays('2026-08-16', (waveDateSeq.W3o++ % 15)); }                  // Aug 16–30 (not yet due)
    return addDays('2026-09-05', (waveDateSeq.W4++ * 3) % 21);                                      // W4: Sep 5–25
  }

  // KT ledger for exited-but-not-stabilized roles (47): 5×P4, 19×P3, 14×P2, 3×P1, 6×Not started
  var ktLedger = [].concat(rep('Phase 4 — Primary support', 5), rep('Phase 3 — Secondary support', 19),
    rep('Phase 2 — KT / playback', 14), rep('Phase 1 — Access setup', 3), rep('Not started', 6));

  var roles = [], seq = 0, stabilizedLeft = 70, ktIdx = 0, lateHireLeft = 25, unhiredAssigned = false;

  FN.forEach(function (f, fi) {
    var name = f[0], bu = f[1], domain = f[2], hc = f[3], exited = f[4], planK = f[5], actualK = f[6], rateK = f[7];
    var perPlan = Math.round(planK / hc), perAct = exited ? Math.round(actualK / exited) : 0;
    var isZero = ZERO_REALIZATION.indexOf(name) >= 0;

    for (var i = 0; i < hc; i++) {
      var isExited = i < exited;
      var wave;
      if (isExited) { wave = exitCap.W1 > 0 ? 'W1' : (exitCap.W2 > 0 ? 'W2' : 'W3'); exitCap[wave]--; }
      else if (isZero && openCap.W4 > 0) { wave = 'W4'; openCap.W4--; }
      else if (openCap.W2 > 0 && !isZero && exited > 0) { wave = 'W2'; openCap.W2--; }   // overdue set: converting functions
      else if (openCap.W3 > 0) { wave = 'W3'; openCap.W3--; }
      else { wave = 'W4'; openCap.W4--; }

      var v = isExited ? varianceLedger[wave].shift() : null;
      var pDate = plannedDate(wave, isExited, v === 38 && wave === 'W2');
      var aDate = isExited ? addDays(pDate, v) : null;
      var overdue = !isExited && new Date(pDate) < AS_OF;

      // KT stage: stabilized (complete) assigned to exited first; in-flight stages to remaining exited
      var ktStage;
      if (isExited && stabilizedLeft > 0) { ktStage = 'Complete'; stabilizedLeft--; }
      else if (isExited) { ktStage = ktLedger[ktIdx++]; }
      else { ktStage = 'Not started'; }

      var status = isExited ? (ktStage === 'Complete' ? 'Stabilized' : 'Exited')
        : (wave === 'W4' ? 'Not Started' : 'In Progress');

      // Costs — role-level rounded to $1K; function totals reconciled below
      var onshoreK = rateK;
      var hired = !(name === 'Client Support & Compliance' && i === hc - 1); // the single unfilled backfill
      var bpoK = hired ? Math.round(onshoreK * 0.36) : 0;

      var planSavK = perPlan, actSavK = isExited ? perAct : 0;
      if (i === 0) planSavK = planK - perPlan * (hc - 1);                    // absorb rounding
      if (isExited && i === 0) actSavK = actualK - perAct * (exited - 1);

      var startOnTime = hired ? !(lateHireLeft > 0 && ((seq + fi) % 8 === 0) && (lateHireLeft--, true)) : null;

      var statusBucket = isExited
        ? (ktStage === 'Complete' ? 'Exited & stabilized' : 'Exited, stabilizing')
        : (overdue ? 'Overdue / at risk' : 'In progress, not exited');
      var varianceBucket = !isExited ? 'Not exited'
        : v < -15 ? '>15d early' : v < 0 ? '1–15d early' : v === 0 ? 'On time'
        : v <= 30 ? '1–30d late' : '>30d late';

      roles.push({
        id: 'R-' + String(++seq).padStart(3, '0'),
        functionName: name, businessUnit: bu,
        location: SITES[seq % 3], domain: domain, wave: wave,
        plannedExitDate: pDate, actualExitDate: aDate,
        exitVarianceDays: v,
        overdue: overdue,
        status: status, ktStatus: ktStage === 'Complete' ? 'Complete' : (ktStage === 'Not started' ? 'Not Started' : 'In Progress'),
        ktStage: ktStage, statusBucket: statusBucket, varianceBucket: varianceBucket,
        onshoreAnnualCost: onshoreK * 1000, bpoAnnualCost: bpoK * 1000,
        plannedSavingsUSD: planSavK * 1000, realizedSavingsUSD: actSavK * 1000,
        bpoHireDate: hired ? addDays('2026-01-12', (seq * 5) % 150) : null,
        bpoStartOnTime: startOnTime
      });
    }
  });

  // Force exact on-time hire count: 174 of 199 (87%)
  var hiredRoles = roles.filter(function (r) { return r.bpoHireDate; });
  var lateCount = hiredRoles.filter(function (r) { return r.bpoStartOnTime === false; }).length;
  for (var j = 0; j < hiredRoles.length && lateCount !== 25; j++) {
    var r = hiredRoles[j];
    if (lateCount < 25 && r.bpoStartOnTime === true) { r.bpoStartOnTime = false; lateCount++; }
    else if (lateCount > 25 && r.bpoStartOnTime === false) { r.bpoStartOnTime = true; lateCount--; }
  }

  // Reconcile baseline onshore cost to exactly $28.4M (adjust one role, keep $1K rounding)
  var costSum = roles.reduce(function (s, r) { return s + r.onshoreAnnualCost; }, 0);
  roles[1].onshoreAnnualCost += META.baselineOnshoreCostUSD - costSum;

  // --- Function reference table (allocations in $) ---------------------------
  var functions = FN.map(function (f) {
    return {
      name: f[0], businessUnit: f[1], domain: f[2],
      baselineHeadcount: f[3], exitedHeadcount: f[4],
      baselineCostUSD: roles.filter(function (r) { return r.functionName === f[0]; })
        .reduce(function (s, r) { return s + r.onshoreAnnualCost; }, 0),
      plannedSavingsUSD: f[5] * 1000, realizedSavingsUSD: f[6] * 1000,
      varianceUSD: (f[6] - f[5]) * 1000
    };
  });

  // --- Prior-week snapshot (for change detection / "what changed") -----------
  var PRIOR = {
    asOfDate: '2026-08-08',
    exited: 111, stabilized: 66, overdue: 22,
    realizedUSD: 2650000, planToDateUSD: 3310000,
    leakageCumulativeUSD: 342000, hiresOnTimePct: 0.864,
    realizationByFunction: {
      'Transaction Processing': 0.41, 'Unmapped / Unclassified': 0.71,
      'Client Support & Compliance': 0.41, 'Data & Analytics': 0.62,
      'Enterprise Systems': 0.90, 'Digital Operations (ALM)': 0.58,
      'Tier 1 Support': 1.0, 'End User Computing': 0.14, 'Data Processing': 1.0,
      'Storage & Backup': 0, 'Compute Infrastructure': 0, 'Cloud Support': 0,
      'Middleware': 1.0, 'Client Systems': 1.0, 'Database Administration': 0,
      'Tier 2 Support': 1.0, 'Task Processing': 1.0
    }
  };

  return { meta: META, roles: roles, periods: PERIODS, functions: functions, leakage: LEAKAGE, prior: PRIOR };
})();

/* --- Load persisted dataset (from a prior Excel upload) if present --------- */
(function () {
  try {
    var saved = localStorage.getItem('bpoTrackerData');
    if (saved) {
      var parsed = JSON.parse(saved);
      if (parsed && parsed.roles && parsed.meta) {
        DATA.prior = parsed.prior || DATA.prior;
        DATA.meta = parsed.meta; DATA.roles = parsed.roles;
        DATA.periods = parsed.periods || DATA.periods;
        DATA.functions = parsed.functions || DATA.functions;
        DATA.leakage = parsed.leakage || DATA.leakage;
      }
    }
  } catch (e) { /* corrupted storage — fall back to bundled demo dataset */ }
})();
