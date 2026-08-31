/* ============================================================================
   METRICS — the ONLY place aggregations are computed.
   Every consumer (KPI cards, charts, storyline, forecasts, chatbot, emails)
   calls these pure functions of (DATA, activeFilters), which is what
   guarantees the chatbot can never contradict a chart.
   ============================================================================ */

var METRICS = (function () {
  'use strict';

  var RAG = { green: 0.8, amber: 0.4 }; // ≥80% green · 40–79% amber · <40% red
  var FILTER_DIMS = ['wave', 'functionName', 'businessUnit', 'location', 'domain', 'status', 'ktStatus',
                     'ktStage', 'statusBucket', 'varianceBucket'];
  var SLICER_DIMS = ['wave', 'functionName', 'businessUnit', 'location', 'domain', 'status', 'ktStatus'];
  // v2 — workforce roster dimensions. domain / location / businessUnit are shared
  // with the transition roles above, so one selection filters both entities.
  var WORKFORCE_ONLY_DIMS = ['workerType', 'team', 'capability', 'fundingSource', 'vendorName'];
  var WORKFORCE_DIMS = ['domain', 'location', 'businessUnit'].concat(WORKFORCE_ONLY_DIMS);
  var ALL_DIMS = FILTER_DIMS.concat(WORKFORCE_ONLY_DIMS);

  function asOf(data) { return new Date(data.meta.asOfDate + 'T00:00:00'); }
  function sum(arr, f) { return arr.reduce(function (s, x) { return s + (f ? f(x) : x); }, 0); }
  function isExited(r) { return !!r.actualExitDate; }
  function rag(pct) { return pct >= RAG.green ? 'Green' : pct >= RAG.amber ? 'Amber' : 'Red'; }

  // --- Filtering -------------------------------------------------------------
  function filterRoles(data, filters) {
    filters = filters || {};
    return data.roles.filter(function (r) {
      return FILTER_DIMS.every(function (dim) {
        var sel = filters[dim];
        return !sel || !sel.length || sel.indexOf(r[dim]) >= 0;
      });
    });
  }
  function shares(data, roles) {
    var planTotal = sum(data.roles, function (r) { return r.plannedSavingsUSD; }) || 1;
    var actTotal = sum(data.roles, function (r) { return r.realizedSavingsUSD; }) || 1;
    return {
      plan: sum(roles, function (r) { return r.plannedSavingsUSD; }) / planTotal,
      actual: sum(roles, function (r) { return r.realizedSavingsUSD; }) / actTotal,
      overdue: (roles.filter(function (r) { return r.overdue; }).length) /
               (data.roles.filter(function (r) { return r.overdue; }).length || 1)
    };
  }

  // --- Realization rate (trailing 2 completed quarters) ----------------------
  function trailingRate(data) {
    var done = data.periods.filter(function (q) { return q.actualSavingsUSD != null && !q.partial; });
    var last2 = done.slice(-2);
    return sum(last2, function (q) { return q.actualSavingsUSD; }) /
           (sum(last2, function (q) { return q.plannedSavingsUSD; }) || 1);
  }

  // --- Headline KPIs ----------------------------------------------------------
  function kpis(data, filters) {
    var roles = filterRoles(data, filters);
    var sh = shares(data, roles);
    var A = asOf(data);
    var exited = roles.filter(isExited);
    var stabilized = roles.filter(function (r) { return r.status === 'Stabilized'; });
    var overdue = roles.filter(function (r) { return r.overdue; });
    var plannedToDate = roles.filter(function (r) { return new Date(r.plannedExitDate + 'T00:00:00') <= A; });
    var hired = roles.filter(function (r) { return r.bpoHireDate; });
    var onTime = hired.filter(function (r) { return r.bpoStartOnTime === true; });
    var ktNotStarted = roles.filter(function (r) { return r.ktStatus === 'Not Started'; });

    var realized = sum(roles, function (r) { return r.realizedSavingsUSD; });
    var plannedFY = sum(roles, function (r) { return r.plannedSavingsUSD; });
    var planToDate = data.meta.planToDateUSD * sh.plan;
    var target = data.meta.targetSavingsUSD * sh.plan;
    var rate = trailingRate(data);
    var remaining = Math.max(0, target - planToDate);
    var projected = realized + remaining * rate;

    return {
      inScope: roles.length, exited: exited.length, stabilized: stabilized.length,
      exitedPct: roles.length ? exited.length / roles.length : 0,
      stabilizedPct: roles.length ? stabilized.length / roles.length : 0,
      plannedToDate: plannedToDate.length,
      rolloffAttainment: plannedToDate.length ? exited.length / plannedToDate.length : 0,
      overdue: overdue.length,
      avgDelayDays: overdue.length ? Math.round(sum(overdue, function (r) {
        return Math.round((A - new Date(r.plannedExitDate + 'T00:00:00')) / 86400000);
      }) / overdue.length) : 0,
      coverageGap: exited.length - stabilized.length,
      ktNotStarted: ktNotStarted.length,
      hired: hired.length, hiredPlanned: roles.length,
      hireOnTimePct: hired.length ? onTime.length / hired.length : 0, hireOnTime: onTime.length,
      realizedUSD: realized, planToDateUSD: planToDate, plannedFYUSD: plannedFY,
      varianceUSD: realized - planToDate,
      behindPct: planToDate ? (planToDate - realized) / planToDate : 0,
      realizationRate: rate,
      targetUSD: target, remainingPipelineUSD: remaining,
      projectedYearEndUSD: projected, gapToTargetUSD: projected - target,
      leakageUSD: data.meta.leakageCumulativeUSD * sh.overdue,
      savingsAtRiskUSD: data.meta.savingsAtRiskUSD * (1 - (roles.length ? exited.length / roles.length : 0)) /
                        (1 - (data.roles.filter(isExited).length / data.roles.length)) *
                        ((roles.length - exited.length) > 0 ? 1 : 0),
      baselineOnshoreCostUSD: sum(roles, function (r) { return r.onshoreAnnualCost; }),
      remainingOnshoreCostUSD: sum(roles, function (r) { return r.onshoreAnnualCost; }) -
                               data.meta.ytdOnshoreEliminatedUSD * sh.actual,
      notExited: roles.length - exited.length,
      filtered: !!(filters && FILTER_DIMS.some(function (d) { return filters[d] && filters[d].length; }))
    };
  }

  // --- Chart datasets ----------------------------------------------------------
  function statusBuckets(data, filters) {
    var roles = filterRoles(data, filters);
    var b = { 'Exited & stabilized': 0, 'Exited, stabilizing': 0, 'In progress, not exited': 0, 'Overdue / at risk': 0 };
    roles.forEach(function (r) {
      if (isExited(r)) b[r.status === 'Stabilized' ? 'Exited & stabilized' : 'Exited, stabilizing']++;
      else if (r.overdue) b['Overdue / at risk']++;
      else b['In progress, not exited']++;
    });
    return b;
  }

  function byWave(data, filters) {
    var roles = filterRoles(data, filters);
    var labels = { W1: 'W1 · Feb–Jun', W2: 'W2 · Jul', W3: 'W3 · Aug', W4: 'W4 · Sep' };
    return ['W1', 'W2', 'W3', 'W4'].map(function (w) {
      var rr = roles.filter(function (r) { return r.wave === w; });
      return { wave: w, label: labels[w], planned: rr.length, actual: rr.filter(isExited).length,
               overdue: rr.filter(function (r) { return r.overdue; }).length };
    });
  }

  function exitVarianceHist(data, filters) {
    var ex = filterRoles(data, filters).filter(isExited);
    var b = [
      { label: '>15d early', n: 0 }, { label: '1–15d early', n: 0 }, { label: 'On time', n: 0 },
      { label: '1–30d late', n: 0 }, { label: '>30d late', n: 0 }
    ];
    ex.forEach(function (r) {
      var v = r.exitVarianceDays;
      if (v < -15) b[0].n++; else if (v < 0) b[1].n++; else if (v === 0) b[2].n++;
      else if (v <= 30) b[3].n++; else b[4].n++;
    });
    var onTimeOrEarly = b[0].n + b[1].n + b[2].n;
    return { buckets: b, exited: ex.length, onTimeOrEarly: onTimeOrEarly,
             onTimeOrEarlyPct: ex.length ? onTimeOrEarly / ex.length : 0 };
  }

  function byDimension(data, filters, dim, opts) {
    var roles = filterRoles(data, filters);
    var m = {};
    roles.forEach(function (r) {
      var k = r[dim];
      if (opts && opts.hiredOnly && !r.bpoHireDate) return;
      m[k] = m[k] || { key: k, headcount: 0, exited: 0, plannedUSD: 0, realizedUSD: 0, overdue: 0 };
      m[k].headcount++;
      if (isExited(r)) m[k].exited++;
      if (r.overdue) m[k].overdue++;
      m[k].plannedUSD += r.plannedSavingsUSD; m[k].realizedUSD += r.realizedSavingsUSD;
    });
    var rows = Object.keys(m).map(function (k) {
      var x = m[k];
      x.attainment = x.headcount ? x.exited / x.headcount : 0;
      x.savingsAttainment = x.plannedUSD ? x.realizedUSD / x.plannedUSD : 0;
      x.rag = rag(x.savingsAttainment);
      return x;
    });
    rows.sort(function (a, b) { return b.headcount - a.headcount; });
    return rows;
  }

  function ktFunnel(data, filters) {
    var roles = filterRoles(data, filters);
    var stages = ['Not started', 'Phase 1 — Access setup', 'Phase 2 — KT / playback',
      'Phase 3 — Secondary support', 'Phase 4 — Primary support', 'Complete'];
    return stages.map(function (s) {
      return { stage: s === 'Complete' ? 'Stabilized (complete)' : s,
               n: roles.filter(function (r) { return r.ktStage === s; }).length };
    });
  }

  // Function variance table (Page 4) — rows + program totals + reconciliation
  function functionVariance(data, filters) {
    var rows = byDimension(data, filters, 'functionName').map(function (x) {
      return {
        functionName: x.key, plan: x.headcount, exited: x.exited, attainment: x.attainment,
        plannedK: x.plannedUSD / 1000, actualK: x.realizedUSD / 1000,
        varianceK: (x.realizedUSD - x.plannedUSD) / 1000,
        savingsAttainment: x.savingsAttainment, rag: x.rag
      };
    });
    rows.sort(function (a, b) { return b.plan - a.plan || b.plannedK - a.plannedK; });
    var t = {
      plan: sum(rows, function (r) { return r.plan; }), exited: sum(rows, function (r) { return r.exited; }),
      plannedK: sum(rows, function (r) { return r.plannedK; }), actualK: sum(rows, function (r) { return r.actualK; })
    };
    t.attainment = t.plan ? t.exited / t.plan : 0;
    t.varianceK = t.actualK - t.plannedK;
    t.savingsAttainment = t.plannedK ? t.actualK / t.plannedK : 0;
    t.rag = rag(t.savingsAttainment);
    var k = kpis(data, filters);
    var reconcileK = (k.targetUSD - sum(rows, function (r) { return r.plannedK; }) * 1000) / 1000;
    return { rows: rows, totals: t, reconcileK: reconcileK, targetK: k.targetUSD / 1000,
             targetAttainment: k.targetUSD ? t.actualK * 1000 / k.targetUSD : 0 };
  }

  // Quarterly + cumulative series, scaled to the active filter's plan/actual share
  function quarterly(data, filters) {
    var sh = shares(data, filterRoles(data, filters));
    return data.periods.map(function (q) {
      return {
        period: q.period, partial: !!q.partial, future: !!q.future,
        plannedUSD: q.plannedSavingsUSD * sh.plan,
        actualUSD: q.actualSavingsUSD != null ? q.actualSavingsUSD * sh.actual : null,
        cumPlannedUSD: q.cumPlanned * sh.plan,
        cumActualUSD: q.cumActual != null ? q.cumActual * sh.actual : null,
        realizationRate: q.realizationRate
      };
    });
  }

  function leakageTrend(data, filters) {
    var sh = shares(data, filterRoles(data, filters));
    return data.leakage.map(function (p) {
      return { month: p.month, cumulativeUSD: p.cumulativeUSD * sh.overdue };
    });
  }

  // --- Narrative / chatbot helpers ---------------------------------------------
  function driversOfGap(data, filters, n) {
    var rows = byDimension(data, filters, 'functionName')
      .map(function (x) { return { name: x.key, gapUSD: x.plannedUSD - x.realizedUSD, attainment: x.savingsAttainment }; })
      .filter(function (x) { return x.gapUSD > 0; })
      .sort(function (a, b) { return b.gapUSD - a.gapUSD; });
    return rows.slice(0, n || 3);
  }

  function zeroRealization(data, filters) {
    return byDimension(data, filters, 'functionName')
      .filter(function (x) { return x.realizedUSD === 0 && x.plannedUSD > 0; })
      .map(function (x) { return { name: x.key, plannedUSD: x.plannedUSD, headcount: x.headcount }; });
  }

  function overdueDetail(data, filters) {
    var A = asOf(data);
    var od = filterRoles(data, filters).filter(function (r) { return r.overdue; });
    var daily = od.length ? sum(od, function (r) { return r.onshoreAnnualCost; }) / od.length / 260 : 0;
    var avgDelay = od.length ? Math.round(sum(od, function (r) {
      return Math.round((A - new Date(r.plannedExitDate + 'T00:00:00')) / 86400000);
    }) / od.length) : 0;
    return { roles: od, count: od.length, avgDelayDays: avgDelay,
             estMonthlyRunRateUSD: od.length * daily * 21,
             cumulativeLeakageUSD: data.meta.leakageCumulativeUSD * shares(data, filterRoles(data, filters)).overdue };
  }

  function ktRiskRoles(data, filters) {
    var A = asOf(data);
    var horizon = new Date(A); horizon.setDate(horizon.getDate() + 30);
    return filterRoles(data, filters).filter(function (r) {
      return !isExited(r) && r.ktStatus === 'Not Started' &&
             new Date(r.plannedExitDate + 'T00:00:00') <= horizon;
    });
  }

  // Ahead / behind by any dimension (for chatbot + storyline)
  function aheadBehind(data, filters, dim) {
    var overall = kpis(data, filters).realizationRate;
    return byDimension(data, filters, dim).map(function (x) {
      return { name: x.key, savingsAttainment: x.savingsAttainment, exitAttainment: x.attainment,
               plannedUSD: x.plannedUSD, realizedUSD: x.realizedUSD,
               ahead: x.savingsAttainment >= 0.8 };
    }).sort(function (a, b) { return b.savingsAttainment - a.savingsAttainment; });
  }

  // Scenario projection: YE = realized + remaining × rate, plus optional levers
  function scenario(data, filters, opts) {
    var k = kpis(data, filters);
    var rate = opts.realizationRate != null ? opts.realizationRate : k.realizationRate;
    var pace = opts.exitPacePct != null ? opts.exitPacePct : 1;       // exit pace vs. plan
    var delayDays = opts.delayDays != null ? opts.delayDays : k.avgDelayDays;
    var rampWeeks = opts.rampWeeks != null ? opts.rampWeeks : 6;
    var attritionAdder = opts.attritionAdderUSD || 0;

    var effRate = Math.min(1, rate * Math.min(1.15, Math.max(0.5, pace)));
    var projected = k.realizedUSD + k.remainingPipelineUSD * effRate - attritionAdder;
    // leakage: each overdue day of average delay costs ~ overdue × avg daily onshore cost
    var od = overdueDetail(data, filters);
    var daily = od.count ? sum(od.roles, function (r) { return r.onshoreAnnualCost; }) / od.count / 260 : 0;
    var rampDrag = Math.max(0, rampWeeks - 6) * 0.004 * k.remainingPipelineUSD;
    projected -= rampDrag;
    var leakageYE = k.leakageUSD + od.count * daily * Math.max(0, delayDays) * 2.5;
    return {
      projectedYearEndUSD: projected, gapToTargetUSD: projected - k.targetUSD,
      leakageYearEndUSD: leakageYE,
      rag: rag(k.targetUSD ? projected / k.targetUSD : 0),
      effRate: effRate
    };
  }

  // Deltas vs. the prior dataset snapshot (for "What changed" + storyline)
  function deltasVsPrior(data, filters) {
    var p = data.prior; if (!p) return null;
    var k = kpis(data, filters ? {} : null); // deltas always program-level
    var fnNow = {};
    byDimension(data, null, 'functionName').forEach(function (x) { fnNow[x.key] = x.savingsAttainment; });
    var movers = Object.keys(p.realizationByFunction || {}).map(function (name) {
      return { name: name, from: p.realizationByFunction[name], to: fnNow[name] != null ? fnNow[name] : 0 };
    }).map(function (m) { m.delta = m.to - m.from; return m; })
      .sort(function (a, b) { return Math.abs(b.delta) - Math.abs(a.delta); });
    return {
      priorAsOf: p.asOfDate,
      exited: { from: p.exited, to: k.exited },
      stabilized: { from: p.stabilized, to: k.stabilized },
      overdue: { from: p.overdue, to: k.overdue },
      realizedUSD: { from: p.realizedUSD, to: k.realizedUSD },
      leakageUSD: { from: p.leakageCumulativeUSD, to: data.meta.leakageCumulativeUSD },
      hiresOnTimePct: { from: p.hiresOnTimePct, to: k.hireOnTimePct },
      biggestMover: movers.length ? movers[0] : null,
      movers: movers.slice(0, 5)
    };
  }

  function slicerValues(data) {
    var out = {};
    SLICER_DIMS.forEach(function (dim) {
      var vals = {};
      data.roles.forEach(function (r) { vals[r[dim]] = true; });
      out[dim] = Object.keys(vals).sort(function (a, b) {
        if (dim === 'wave') return a < b ? -1 : 1;
        return a.localeCompare(b);
      });
    });
    return out;
  }

  /* ==========================================================================
     WORKFORCE, PLANNING & EXECUTION AGGREGATIONS (v2)
     Same rule as everything above: this is the only place these are computed.
     Shared dimensions (domain, location, businessUnit) filter BOTH the
     transition roles and the workforce roster, so one selection moves the
     whole application.
     ========================================================================== */

  function filterWorkforce(data, filters) {
    filters = filters || {};
    return (data.workforce || []).filter(function (p) {
      return WORKFORCE_DIMS.every(function (dim) {
        var sel = filters[dim];
        return !sel || !sel.length || sel.indexOf(p[dim]) >= 0;
      });
    });
  }

  function daysBetween(a, b) { return Math.round((new Date(b) - new Date(a)) / 86400000); }

  // --- FTE / non-FTE mix vs. the 70/30 target -------------------------------
  // Reported under BOTH definitions, because whether the BPO Hub counts as
  // non-FTE reverses the conclusion. policy.bpoHubCountsAsNonFte picks the
  // headline; the other is always shown alongside it.
  function workforceMix(data, filters) {
    var people = filterWorkforce(data, filters);
    var pol = data.policy;
    var fte = people.filter(function (p) { return p.isFte; }).length;
    var hub = people.filter(function (p) { return p.workerType === 'BPO Hub'; }).length;
    var contractor = people.filter(function (p) { return p.workerType === 'Contractor'; }).length;
    var vendor = people.filter(function (p) { return p.workerType === 'Vendor'; }).length;
    var total = people.length;

    function view(includeHub) {
      var denom = includeHub ? total : total - hub;
      var ratio = denom ? fte / denom : 0;
      var targetFte = Math.round(denom * pol.fteTargetRatio);
      return {
        includesHub: includeHub, total: denom, fte: fte, nonFte: denom - fte,
        ratio: ratio, targetRatio: pol.fteTargetRatio, targetFte: targetFte,
        gapHeads: targetFte - fte, onTarget: ratio >= pol.fteTargetRatio
      };
    }
    var incl = view(true), excl = view(false);
    return {
      headline: pol.bpoHubCountsAsNonFte ? incl : excl,
      alternate: pol.bpoHubCountsAsNonFte ? excl : incl,
      inclHub: incl, exclHub: excl,
      byType: { FTE: fte, Contractor: contractor, Vendor: vendor, 'BPO Hub': hub },
      total: total
    };
  }

  // --- Vendor footprint and per-team concentration ---------------------------
  function vendorFootprint(data, filters) {
    var people = filterWorkforce(data, filters).filter(function (p) { return p.vendorName; });
    var byVendor = {}, byTeam = {};
    people.forEach(function (p) {
      byVendor[p.vendorName] = (byVendor[p.vendorName] || 0) + 1;
      (byTeam[p.team] = byTeam[p.team] || {})[p.vendorName] = (byTeam[p.team][p.vendorName] || 0) + 1;
    });
    var teams = Object.keys(byTeam).map(function (t) {
      var names = Object.keys(byTeam[t]);
      return { team: t, vendorCount: names.length, vendors: names,
               headcount: names.reduce(function (s, n) { return s + byTeam[t][n]; }, 0),
               fragmented: names.length >= data.policy.vendorConcentrationThreshold };
    }).sort(function (a, b) { return b.vendorCount - a.vendorCount; });
    var vendors = Object.keys(byVendor).map(function (v) {
      return { vendor: v, headcount: byVendor[v],
               teams: Object.keys(byTeam).filter(function (t) { return byTeam[t][v]; }).length };
    }).sort(function (a, b) { return b.headcount - a.headcount; });
    return { vendors: vendors, teams: teams,
             distinctVendors: vendors.length,
             fragmentedTeams: teams.filter(function (t) { return t.fragmented; }) };
  }

  // --- Location alignment by domain ------------------------------------------
  // A domain concentrated in one location scores 1.0; one spread evenly across
  // four scores 0.25. Low scores mean coordination cost.
  function locationAlignment(data, filters) {
    var people = filterWorkforce(data, filters);
    var m = {};
    people.forEach(function (p) {
      var d = (m[p.domain] = m[p.domain] || { domain: p.domain, total: 0, locations: {} });
      d.total++; d.locations[p.location] = (d.locations[p.location] || 0) + 1;
    });
    var locations = {};
    people.forEach(function (p) { locations[p.location] = true; });
    var rows = Object.keys(m).map(function (k) {
      var d = m[k];
      var counts = Object.keys(d.locations).map(function (l) { return d.locations[l]; });
      var primary = Math.max.apply(null, counts);
      var primaryLocation = Object.keys(d.locations).filter(function (l) { return d.locations[l] === primary; })[0];
      return { domain: d.domain, total: d.total, locations: d.locations,
               locationCount: counts.length, primaryLocation: primaryLocation,
               alignment: d.total ? primary / d.total : 0,
               rag: rag(d.total ? primary / d.total : 0) };
    }).sort(function (a, b) { return a.alignment - b.alignment; });
    return { rows: rows, allLocations: Object.keys(locations).sort() };
  }

  // --- Role coverage and duplication -----------------------------------------
  function roleCoverage(data, filters) {
    var people = filterWorkforce(data, filters);
    var pol = data.policy;
    var m = {};
    people.forEach(function (p) {
      var c = (m[p.capability] = m[p.capability] || { capability: p.capability, headcount: 0, teams: {}, domains: {}, fte: 0 });
      c.headcount++; c.teams[p.team] = true; c.domains[p.domain] = true;
      if (p.isFte) c.fte++;
    });
    var rows = Object.keys(m).map(function (k) {
      var c = m[k];
      var teamCount = Object.keys(c.teams).length;
      return {
        capability: c.capability, headcount: c.headcount, fte: c.fte,
        teamCount: teamCount, domainCount: Object.keys(c.domains).length,
        singlePoint: c.headcount === 1,
        critical: c.headcount <= pol.coverageCriticalThreshold,
        duplicated: teamCount >= pol.duplicationThreshold,
        fteShare: c.headcount ? c.fte / c.headcount : 0
      };
    }).sort(function (a, b) { return a.headcount - b.headcount; });

    // capability x domain — where a domain relies on one person for a capability
    var pairs = {};
    people.forEach(function (p) {
      var key = p.domain + '||' + p.capability;
      pairs[key] = (pairs[key] || 0) + 1;
    });
    var spofPairs = Object.keys(pairs).filter(function (k) { return pairs[k] === 1; })
      .map(function (k) { return { domain: k.split('||')[0], capability: k.split('||')[1] }; });

    return {
      rows: rows,
      singlePoints: rows.filter(function (r) { return r.singlePoint; }),
      critical: rows.filter(function (r) { return r.critical; }),
      duplicated: rows.filter(function (r) { return r.duplicated; }),
      spofPairs: spofPairs
    };
  }

  // --- Contract cliff: non-FTE ending inside the policy window ---------------
  function contractCliff(data, filters) {
    var people = filterWorkforce(data, filters);
    var asOfD = data.meta.asOfDate;
    var win = data.policy.contractCliffDays;
    var ending = people.filter(function (p) {
      return p.endDate && daysBetween(asOfD, p.endDate) >= 0 && daysBetween(asOfD, p.endDate) <= win;
    }).map(function (p) {
      var x = Object.create(p); x.daysRemaining = daysBetween(asOfD, p.endDate); return x;
    }).sort(function (a, b) { return a.daysRemaining - b.daysRemaining; });
    var byDomain = {};
    ending.forEach(function (p) { byDomain[p.domain] = (byDomain[p.domain] || 0) + 1; });
    return {
      count: ending.length, windowDays: win, roles: ending,
      annualCostUSD: ending.reduce(function (s, p) { return s + p.annualCost; }, 0),
      byDomain: Object.keys(byDomain).map(function (d) { return { domain: d, count: byDomain[d] }; })
        .sort(function (a, b) { return b.count - a.count; })
    };
  }

  // --- Workforce forecast series (historical + forecast) ---------------------
  function wftSeries(data) {
    var pol = data.policy;
    return (data.wft || []).map(function (m) {
      var nonFte = pol.bpoHubCountsAsNonFte ? m.nonFteInclHub : m.nonFteExclHub;
      var denom = m.fte + nonFte;
      return {
        month: m.month, forecast: m.forecast,
        fte: m.fte, contractor: m.contractor, vendor: m.vendor, bpoHub: m.bpoHub,
        total: m.total, nonFte: nonFte,
        fteRatio: denom ? m.fte / denom : 0,
        fteRatioInclHub: m.total ? m.fte / m.total : 0,
        fteRatioExclHub: (m.fte + m.nonFteExclHub) ? m.fte / (m.fte + m.nonFteExclHub) : 0,
        onTarget: (denom ? m.fte / denom : 0) >= pol.fteTargetRatio
      };
    });
  }

  function wftSummary(data) {
    var s = wftSeries(data);
    var hist = s.filter(function (m) { return !m.forecast; });
    var fc = s.filter(function (m) { return m.forecast; });
    var now = hist[hist.length - 1], end = fc.length ? fc[fc.length - 1] : now;
    return {
      series: s, current: now, yearEnd: end,
      historicalMonths: hist.length, forecastMonths: fc.length,
      ratioNow: now.fteRatio, ratioEnd: end.fteRatio,
      direction: end.fteRatio - now.fteRatio,
      reachesTarget: end.fteRatio >= data.policy.fteTargetRatio,
      headcountDelta: end.total - now.total
    };
  }

  // --- Funding: requirement vs. funded vs. assigned --------------------------
  function fundingAlignment(data, filters) {
    var sel = (filters && filters.domain) || [];
    var rows = (data.funding || []).filter(function (f) { return !sel.length || sel.indexOf(f.domain) >= 0; });
    var t = rows.reduce(function (a, f) {
      a.requiredFte += f.requiredFte; a.fundedFte += f.fundedFte; a.assignedFte += f.assignedFte; return a;
    }, { requiredFte: 0, fundedFte: 0, assignedFte: 0 });
    t.fundingGap = t.requiredFte - t.fundedFte;
    t.assignmentGap = t.fundedFte - t.assignedFte;
    t.fundedPct = t.requiredFte ? t.fundedFte / t.requiredFte : 0;
    t.assignedPct = t.requiredFte ? t.assignedFte / t.requiredFte : 0;
    var unfunded = filterWorkforce(data, filters).filter(function (p) { return p.fundingSource === 'Unfunded'; });
    var unassigned = filterWorkforce(data, filters).filter(function (p) { return !p.assignment; });
    return { rows: rows, totals: t, unfundedPositions: unfunded.length,
             unfundedCostUSD: unfunded.reduce(function (s, p) { return s + p.annualCost; }, 0),
             unassignedPositions: unassigned.length };
  }

  // --- Initiatives, dependencies, trigger points -----------------------------
  function initiativeHealth(data, filters) {
    var sel = (filters && filters.domain) || [];
    var rows = (data.initiatives || []).filter(function (i) { return !sel.length || sel.indexOf(i.domain) >= 0; });
    var byId = {}; (data.initiatives || []).forEach(function (i) { byId[i.id] = i; });
    rows = rows.map(function (i) {
      var blockers = (i.dependsOn || []).filter(function (d) {
        var dep = byId[d];
        return dep && dep.status !== 'Complete' && dep.rag !== 'Green';
      });
      return {
        id: i.id, name: i.name, owner: i.owner, domain: i.domain, status: i.status, rag: i.rag,
        dueDate: i.dueDate, fundingSource: i.fundingSource,
        requiredCapabilities: i.requiredCapabilities,
        requiredHeadcount: i.requiredHeadcount, assignedHeadcount: i.assignedHeadcount,
        resourceGap: i.requiredHeadcount - i.assignedHeadcount,
        staffedPct: i.requiredHeadcount ? i.assignedHeadcount / i.requiredHeadcount : 1,
        dependsOn: i.dependsOn || [], blockers: blockers, atRiskFromDependency: blockers.length > 0,
        triggerPoint: i.triggerPoint
      };
    });
    var counts = { Green: 0, Amber: 0, Red: 0 };
    rows.forEach(function (r) { counts[r.rag] = (counts[r.rag] || 0) + 1; });
    return {
      rows: rows.sort(function (a, b) { return b.resourceGap - a.resourceGap; }),
      counts: counts,
      blocked: rows.filter(function (r) { return r.atRiskFromDependency; }),
      understaffed: rows.filter(function (r) { return r.resourceGap > 0; }),
      totalGap: rows.reduce(function (s, r) { return s + Math.max(0, r.resourceGap); }, 0),
      triggers: rows.filter(function (r) { return r.triggerPoint; })
    };
  }

  function actionStats(data, filters) {
    var sel = (filters && filters.domain) || [];
    var byIni = {}; (data.initiatives || []).forEach(function (i) { byIni[i.id] = i; });
    var rows = (data.actions || []).filter(function (a) {
      if (!sel.length) return true;
      var ini = byIni[a.initiativeId];
      return ini && sel.indexOf(ini.domain) >= 0;
    });
    var open = rows.filter(function (a) { return a.status !== 'Done'; });
    return {
      rows: rows, total: rows.length,
      open: open.length,
      overdue: rows.filter(function (a) { return a.overdue; }).length,
      blocked: rows.filter(function (a) { return a.status === 'Blocked'; }).length,
      high: open.filter(function (a) { return a.priority === 'High'; }).length,
      done: rows.filter(function (a) { return a.status === 'Done'; }).length,
      byStatus: ['Open', 'In Progress', 'Blocked', 'Not Started', 'Done'].map(function (s) {
        return { status: s, n: rows.filter(function (a) { return a.status === s; }).length };
      })
    };
  }

  // --- AI-assisted analysis of free-text notes -------------------------------
  // Rule-based signal extraction over the free text people actually type.
  // Same design principle as the storyline: deterministic, explainable, and
  // upgradeable to a language model behind the same interface.
  var SIGNALS = [
    { theme: 'Dependency',   weight: 2, words: ['blocked', 'blocking', 'waiting on', 'cannot start', 'behind', 'depends'] },
    { theme: 'Timeline',     weight: 2, words: ['slipped', 'late', 'overdue', 'delay', 'past', 'lead time', 'will not start'] },
    { theme: 'Resourcing',   weight: 2, words: ['shortfall', 'single point', 'unfunded', 'needs', 'no response', 'backfill', 'cross-train'] },
    { theme: 'Data quality', weight: 1, words: ['reconcile', 'inconsistent', 'unclear', 'cannot explain', 'authoritative', 'shape'] },
    { theme: 'Governance',   weight: 1, words: ['sign-off', 'decision', 'escalate', 'confirm', 'approval', 'owner'] },
    { theme: 'Optimism risk',weight: 1, words: ['optimistic', 'assumes', 'assumed', 'almost certainly'] }
  ];
  function analyzeNotes(data, filters) {
    var rows = actionStats(data, filters).rows;
    var themes = {}, flagged = [];
    rows.forEach(function (a) {
      var text = (a.note || '').toLowerCase();
      var hits = [], score = 0;
      SIGNALS.forEach(function (sig) {
        var found = sig.words.filter(function (w) { return text.indexOf(w) >= 0; });
        if (found.length) {
          hits.push({ theme: sig.theme, terms: found });
          score += sig.weight * found.length;
          themes[sig.theme] = (themes[sig.theme] || 0) + 1;
        }
      });
      if (a.overdue) score += 2;
      if (a.status === 'Blocked') score += 2;
      if (a.priority === 'High') score += 1;
      if (hits.length) {
        flagged.push({
          id: a.id, title: a.title, owner: a.owner, note: a.note, status: a.status,
          dueDate: a.dueDate, overdue: a.overdue, score: score, themes: hits,
          severity: score >= 8 ? 'High' : score >= 4 ? 'Medium' : 'Low'
        });
      }
    });
    flagged.sort(function (a, b) { return b.score - a.score; });
    var themeRows = Object.keys(themes).map(function (t) { return { theme: t, n: themes[t] }; })
      .sort(function (a, b) { return b.n - a.n; });
    return {
      analyzed: rows.length, flagged: flagged,
      high: flagged.filter(function (f) { return f.severity === 'High'; }),
      themes: themeRows,
      topTheme: themeRows.length ? themeRows[0] : null
    };
  }

  // --- Scenario resource drill-down ------------------------------------------
  // Which capabilities does a scenario actually require, and do we have them?
  function scenarioResources(data, filters, opts) {
    opts = opts || {};
    var pace = opts.exitPacePct != null ? opts.exitPacePct : 1;
    var health = initiativeHealth(data, filters);
    var people = filterWorkforce(data, filters);
    // Uncommitted capacity only — someone already assigned to an initiative
    // cannot also staff a scenario. This is what makes the gap real.
    var supply = {}, committed = {};
    people.forEach(function (p) {
      if (p.assignment) { committed[p.capability] = (committed[p.capability] || 0) + 1; }
      else { supply[p.capability] = (supply[p.capability] || 0) + 1; }
    });

    var demand = {};
    health.rows.forEach(function (ini) {
      var caps = ini.requiredCapabilities || [];
      if (!caps.length) return;
      var per = ini.requiredHeadcount / caps.length;
      caps.forEach(function (c) { demand[c] = (demand[c] || 0) + per; });
    });

    var rows = Object.keys(demand).map(function (c) {
      var required = Math.round(demand[c] * pace);
      var have = supply[c] || 0;
      return {
        capability: c, requiredHeadcount: required, availableHeadcount: have,
        committedHeadcount: committed[c] || 0,
        gap: required - have, covered: have >= required
      };
    }).sort(function (a, b) { return b.gap - a.gap; });

    return {
      rows: rows,
      shortfalls: rows.filter(function (r) { return r.gap > 0; }),
      totalGap: rows.reduce(function (s, r) { return s + Math.max(0, r.gap); }, 0),
      peopleInScope: people.length,
      uncommitted: people.filter(function (p) { return !p.assignment; }).length,
      namedPool: people.filter(function (p) {
        return !p.assignment && rows.some(function (r) { return r.gap > 0 && r.capability === p.capability; });
      }).slice(0, 40)
    };
  }

  function workforceSlicerValues(data) {
    var out = {};
    WORKFORCE_ONLY_DIMS.forEach(function (dim) {
      var vals = {};
      (data.workforce || []).forEach(function (p) { if (p[dim]) vals[p[dim]] = true; });
      out[dim] = Object.keys(vals).sort();
    });
    return out;
  }


  /* ==========================================================================
     v3 — EXECUTIVE ATTENTION RANKING AND FUNCTION DRILL-DOWN
     ========================================================================== */

  // Every exception in the programme, ranked, in one place. Severity is rule-based
  // rather than a fabricated common currency — a headcount risk and a dollar risk
  // are not the same unit and pretending otherwise would mislead.
  function attentionList(data, filters) {
    var k = kpis(data, filters);
    var items = [];

    // 1. Shortfall against the leadership commitment
    if (k.gapToTargetUSD < 0) {
      items.push({
        key: 'savings-gap',
        severity: Math.abs(k.gapToTargetUSD) > k.targetUSD * 0.15 ? 'Critical' : 'High',
        headline: fmtUSD(Math.abs(k.gapToTargetUSD)) + ' short of the savings commitment',
        detail: 'Projected ' + fmtUSD(k.projectedYearEndUSD) + ' against a ' + fmtUSD(k.targetUSD) +
                ' target at the current ' + Math.round(k.realizationRate * 100) + '% realization rate.',
        impactUSD: Math.abs(k.gapToTargetUSD), owner: 'Finance Lead',
        page: 2, filters: {}
      });
    }

    // 2. Functions that have realized nothing at all
    var zero = zeroRealization(data, filters);
    if (zero.length) {
      var zeroUSD = zero.reduce(function (a, z) { return a + z.plannedUSD; }, 0);
      items.push({
        key: 'zero-realization',
        severity: 'Critical',
        headline: zero.length + ' functions have realized nothing — ' + fmtUSD(zeroUSD) + ' untouched',
        detail: zero.map(function (z) { return z.name; }).join(', ') + '. No exits have occurred in any of them.',
        impactUSD: zeroUSD, owner: 'Transition Lead',
        page: 2, filters: { functionName: zero.map(function (z) { return z.name; }) }
      });
    }

    // 3. Overdue rolloffs, and what continuing to carry them costs
    var od = overdueDetail(data, filters);
    if (od.count) {
      items.push({
        key: 'overdue-rolloffs',
        severity: od.count >= 10 ? 'High' : 'Medium',
        headline: od.count + ' rolloffs overdue, averaging ' + od.avgDelayDays + ' days late',
        detail: fmtUSD(od.cumulativeLeakageUSD) + ' of leakage already, running at roughly ' +
                fmtUSD(od.estMonthlyRunRateUSD) + ' a month while they stay open.',
        impactUSD: od.cumulativeLeakageUSD, owner: 'Transition Lead',
        page: 2, filters: { statusBucket: ['Overdue / at risk'] }
      });
    }

    // 4. Roles about to exit with no knowledge transfer logged
    var ktRisk = ktRiskRoles(data, filters);
    if (ktRisk.length) {
      items.push({
        key: 'kt-risk',
        severity: ktRisk.length >= 50 ? 'High' : 'Medium',
        headline: ktRisk.length + ' roles exit within 30 days with no knowledge transfer started',
        detail: 'A delivery exposure rather than a cost one today — savings recognize at exit, ' +
                'so this does not reduce reported savings until service breaks.',
        impactUSD: 0, owner: 'Delivery Lead — BPO Hub',
        page: 2, filters: { ktStatus: ['Not Started'] }
      });
    }

    // 5. Contracts lapsing inside the window
    var cliff = contractCliff(data, filters);
    if (cliff.count) {
      items.push({
        key: 'contract-cliff',
        severity: cliff.count >= 15 ? 'High' : 'Medium',
        headline: cliff.count + ' non-FTE contracts end within ' + cliff.windowDays + ' days',
        detail: fmtUSD(cliff.annualCostUSD) + ' of annualised capacity requiring renewal or replacement. ' +
                'Procurement lead time is typically longer than this window.',
        impactUSD: 0, owner: 'Vendor Management Lead',
        page: 3, filters: {}
      });
    }

    // 6. Initiatives blocked by something upstream
    var ih = initiativeHealth(data, filters);
    if (ih.blocked.length) {
      items.push({
        key: 'blocked-initiatives',
        severity: 'High',
        headline: ih.blocked.length + ' initiatives blocked by an upstream dependency',
        detail: ih.blocked.slice(0, 3).map(function (b) { return b.name; }).join('; ') +
                (ih.blocked.length > 3 ? ' and others.' : '.'),
        impactUSD: 0, owner: 'Program Management Lead',
        page: 4, filters: {}
      });
    }

    // 7. Initiatives that are simply not staffed
    if (ih.totalGap > 0) {
      var worst = ih.understaffed[0];
      items.push({
        key: 'resource-gap',
        severity: ih.totalGap >= 30 ? 'High' : 'Medium',
        headline: ih.totalGap + ' people short across in-flight initiatives',
        detail: worst ? ('Largest single gap is ' + worst.name + ' — needs ' + worst.requiredHeadcount +
                ', has ' + worst.assignedHeadcount + '.') : '',
        impactUSD: 0, owner: 'Workforce Lead',
        page: 4, filters: {}
      });
    }

    // 8. Capabilities resting on one person
    var cov = roleCoverage(data, filters);
    if (cov.singlePoints.length) {
      items.push({
        key: 'spof',
        severity: 'Medium',
        headline: cov.singlePoints.length + ' capabilities rest on a single person',
        detail: cov.singlePoints.map(function (r) { return r.capability; }).join(', ') +
                '. One resignation removes the capability entirely.',
        impactUSD: 0, owner: 'Workforce Lead',
        page: 3, filters: {}
      });
    }

    // 9. Demand carrying no funding
    var fund = fundingAlignment(data, filters);
    if (fund.unfundedPositions) {
      items.push({
        key: 'unfunded',
        severity: 'Medium',
        headline: fund.unfundedPositions + ' positions on the roster carry no funding source',
        detail: fmtUSD(fund.unfundedCostUSD) + ' annualised. These need to appear in the ' +
                data.policy.planningCycle + ' submission or they disappear.',
        impactUSD: fund.unfundedCostUSD, owner: 'Program Management Lead',
        page: 3, filters: { fundingSource: ['Unfunded'] }
      });
    }

    // 10. Commitments already past their date
    var acts = actionStats(data, filters);
    if (acts.overdue) {
      items.push({
        key: 'overdue-actions',
        severity: 'Medium',
        headline: acts.overdue + ' action items overdue, ' + acts.blocked + ' blocked',
        detail: acts.high + ' high-priority items remain open across all initiatives.',
        impactUSD: 0, owner: 'Program Management Lead',
        page: 4, filters: {}
      });
    }

    var rank = { Critical: 0, High: 1, Medium: 2 };
    items.sort(function (a, b) {
      if (rank[a.severity] !== rank[b.severity]) return rank[a.severity] - rank[b.severity];
      return b.impactUSD - a.impactUSD;
    });
    return items;
  }

  function fmtUSD(v) {
    var a = Math.abs(v);
    return a >= 950000 ? '$' + (a / 1e6).toFixed(1) + 'M' : '$' + Math.round(a / 1e3) + 'K';
  }

  // Who and what is falling behind inside one function — the drill-down behind
  // a variance row. Returns named positions (anonymized ids) and the accountable
  // owner, so a gap becomes a conversation with someone rather than a number.
  function functionDrilldown(data, filters, functionName) {
    var A = asOf(data);
    var rows = filterRoles(data, filters).filter(function (r) { return r.functionName === functionName; });
    var owner = rows.length ? rows[0].owner : 'Transition Lead';
    var horizon = new Date(A); horizon.setDate(horizon.getDate() + 30);

    function daysLate(r) { return Math.round((A - new Date(r.plannedExitDate + 'T00:00:00')) / 86400000); }

    var laggards = rows.filter(function (r) {
      if (r.overdue) return true;                                   // past its exit date
      if (!isExited(r) && r.ktStatus === 'Not Started' &&
          new Date(r.plannedExitDate + 'T00:00:00') <= horizon) return true;  // exits soon, no KT
      return false;
    }).map(function (r) {
      var reasons = [];
      if (r.overdue) reasons.push('Exit ' + daysLate(r) + ' days overdue');
      if (r.ktStatus === 'Not Started' && !isExited(r)) reasons.push('No knowledge transfer started');
      if (r.status === 'Not Started') reasons.push('Transition not begun');
      return {
        id: r.id, wave: r.wave, location: r.location, plannedExitDate: r.plannedExitDate,
        daysLate: r.overdue ? daysLate(r) : null, ktStage: r.ktStage, status: r.status,
        unrealizedUSD: r.plannedSavingsUSD - r.realizedSavingsUSD,
        reasons: reasons
      };
    }).sort(function (a, b) { return (b.daysLate || 0) - (a.daysLate || 0) || b.unrealizedUSD - a.unrealizedUSD; });

    var exited = rows.filter(isExited).length;
    var plannedUSD = rows.reduce(function (s, r) { return s + r.plannedSavingsUSD; }, 0);
    var realizedUSD = rows.reduce(function (s, r) { return s + r.realizedSavingsUSD; }, 0);

    // Work attached to the same domain — so the drill-down shows not just what is
    // behind, but what is already being done about it and by whom.
    var domain = rows.length ? rows[0].domain : null;
    var inis = (data.initiatives || []).filter(function (i) { return i.domain === domain; });
    var iniIds = inis.map(function (i) { return i.id; });
    var acts = (data.actions || []).filter(function (a) { return iniIds.indexOf(a.initiativeId) >= 0; });

    return {
      functionName: functionName, owner: owner, domain: domain,
      initiatives: inis.map(function (i) {
        return { id: i.id, name: i.name, owner: i.owner, rag: i.rag, dueDate: i.dueDate,
                 gap: i.requiredHeadcount - i.assignedHeadcount, blocked: (i.dependsOn || []).length > 0 };
      }),
      actions: acts.map(function (a) {
        return { id: a.id, title: a.title, owner: a.owner, dueDate: a.dueDate,
                 status: a.status, priority: a.priority, overdue: a.overdue };
      }),
      openActions: acts.filter(function (a) { return a.status !== 'Done'; }).length,
      overdueActions: acts.filter(function (a) { return a.overdue; }).length,
      total: rows.length, exited: exited, notExited: rows.length - exited,
      overdue: rows.filter(function (r) { return r.overdue; }).length,
      ktNotStarted: rows.filter(function (r) { return r.ktStatus === 'Not Started' && !isExited(r); }).length,
      plannedUSD: plannedUSD, realizedUSD: realizedUSD, unrealizedUSD: plannedUSD - realizedUSD,
      attainment: plannedUSD ? realizedUSD / plannedUSD : 0,
      laggards: laggards
    };
  }

  // Function-level accountability — who is carrying what, ranked by exposure.
  // Feeds the Decisions tab so a gap is always attached to a named owner.
  function functionAccountability(data, filters) {
    var A = asOf(data);
    var rows = {};
    filterRoles(data, filters).forEach(function (r) {
      var f = rows[r.functionName] = rows[r.functionName] ||
        { functionName: r.functionName, owner: r.owner, domain: r.domain,
          total: 0, exited: 0, overdue: 0, ktNotStarted: 0, plannedUSD: 0, realizedUSD: 0 };
      f.total++;
      if (isExited(r)) f.exited++;
      if (r.overdue) f.overdue++;
      if (!isExited(r) && r.ktStatus === 'Not Started') f.ktNotStarted++;
      f.plannedUSD += r.plannedSavingsUSD; f.realizedUSD += r.realizedSavingsUSD;
    });
    var byDomainActions = {};
    var iniDomain = {}; (data.initiatives || []).forEach(function (i) { iniDomain[i.id] = i.domain; });
    (data.actions || []).forEach(function (a) {
      var d = iniDomain[a.initiativeId]; if (!d) return;
      byDomainActions[d] = byDomainActions[d] || { open: 0, overdue: 0 };
      if (a.status !== 'Done') byDomainActions[d].open++;
      if (a.overdue) byDomainActions[d].overdue++;
    });
    var list = Object.keys(rows).map(function (k) {
      var f = rows[k];
      f.unrealizedUSD = f.plannedUSD - f.realizedUSD;
      f.attainment = f.plannedUSD ? f.realizedUSD / f.plannedUSD : 0;
      f.behind = f.overdue + f.ktNotStarted;
      f.rag = rag(f.attainment);
      var da = byDomainActions[f.domain] || { open: 0, overdue: 0 };
      f.openActions = da.open; f.overdueActions = da.overdue;
      return f;
    });
    // rank by what actually needs a conversation: unrealized dollars, then people behind
    list.sort(function (a, b) { return b.unrealizedUSD - a.unrealizedUSD || b.behind - a.behind; });
    return {
      rows: list,
      needingAttention: list.filter(function (f) { return f.rag !== 'Green' || f.behind > 0; }),
      totalUnrealizedUSD: list.reduce(function (s, f) { return s + Math.max(0, f.unrealizedUSD); }, 0)
    };
  }

  // Cost concentration (Pareto) — where the money actually sits, not just headcount.
  function costConcentration(data, filters) {
    var rows = byDimension(data, filters, 'functionName').map(function (x) {
      var roles = filterRoles(data, filters).filter(function (r) { return r.functionName === x.key; });
      return {
        name: x.key, headcount: x.headcount,
        costUSD: roles.reduce(function (s, r) { return s + r.onshoreAnnualCost; }, 0),
        plannedUSD: x.plannedUSD, realizedUSD: x.realizedUSD
      };
    }).sort(function (a, b) { return b.costUSD - a.costUSD; });
    var total = rows.reduce(function (s, r) { return s + r.costUSD; }, 0) || 1;
    var run = 0;
    rows.forEach(function (r) {
      r.share = r.costUSD / total;
      run += r.costUSD; r.cumulativeShare = run / total;
      r.costPerRole = r.headcount ? r.costUSD / r.headcount : 0;
    });
    // how few functions carry the majority of cost
    var half = 0, eighty = 0;
    for (var i = 0; i < rows.length; i++) {
      if (!half && rows[i].cumulativeShare >= 0.5) half = i + 1;
      if (!eighty && rows[i].cumulativeShare >= 0.8) eighty = i + 1;
    }
    return { rows: rows, totalUSD: total, functionsForHalf: half, functionsForEighty: eighty };
  }

  // Knowledge-transfer readiness by wave — the leading indicator of delivery risk.
  function ktByWave(data, filters) {
    var roles = filterRoles(data, filters);
    var labels = { W1: 'W1 · Feb–Jun', W2: 'W2 · Jul', W3: 'W3 · Aug', W4: 'W4 · Sep' };
    return ['W1', 'W2', 'W3', 'W4'].map(function (w) {
      var rr = roles.filter(function (r) { return r.wave === w; });
      var notStarted = rr.filter(function (r) { return r.ktStatus === 'Not Started'; }).length;
      return {
        wave: w, label: labels[w], total: rr.length,
        complete: rr.filter(function (r) { return r.ktStatus === 'Complete'; }).length,
        inProgress: rr.filter(function (r) { return r.ktStatus === 'In Progress'; }).length,
        notStarted: notStarted,
        exited: rr.filter(isExited).length,
        readiness: rr.length ? rr.filter(function (r) { return r.ktStatus === 'Complete'; }).length / rr.length : 0,
        exposure: rr.length ? notStarted / rr.length : 0
      };
    });
  }

  return {
    FILTER_DIMS: FILTER_DIMS, SLICER_DIMS: SLICER_DIMS, rag: rag,
    attentionList: attentionList, functionDrilldown: functionDrilldown,
    functionAccountability: functionAccountability,
    costConcentration: costConcentration, ktByWave: ktByWave,
    WORKFORCE_DIMS: WORKFORCE_DIMS, WORKFORCE_ONLY_DIMS: WORKFORCE_ONLY_DIMS, ALL_DIMS: ALL_DIMS,
    filterWorkforce: filterWorkforce, workforceMix: workforceMix, vendorFootprint: vendorFootprint,
    locationAlignment: locationAlignment, roleCoverage: roleCoverage, contractCliff: contractCliff,
    wftSeries: wftSeries, wftSummary: wftSummary, fundingAlignment: fundingAlignment,
    initiativeHealth: initiativeHealth, actionStats: actionStats, analyzeNotes: analyzeNotes,
    scenarioResources: scenarioResources, workforceSlicerValues: workforceSlicerValues,
    filterRoles: filterRoles, kpis: kpis, statusBuckets: statusBuckets, byWave: byWave,
    exitVarianceHist: exitVarianceHist, byDimension: byDimension, ktFunnel: ktFunnel,
    functionVariance: functionVariance, quarterly: quarterly, leakageTrend: leakageTrend,
    driversOfGap: driversOfGap, zeroRealization: zeroRealization, overdueDetail: overdueDetail,
    ktRiskRoles: ktRiskRoles, aheadBehind: aheadBehind, scenario: scenario,
    deltasVsPrior: deltasVsPrior, slicerValues: slicerValues, trailingRate: trailingRate
  };
})();
