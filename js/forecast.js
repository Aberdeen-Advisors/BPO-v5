/* ============================================================================
   FORECAST — plain-JS predictive analytics over METRICS outputs.
   Three transparent methods, a confidence band from historical realization
   error, cost-leakage projection, per-function forecasts, and anomaly flags.
   No projection is presented as certainty — every output carries a method
   note and a confidence indicator.
   ============================================================================ */

var FORECAST = (function () {
  'use strict';

  function completedQuarters(data) {
    return data.periods.filter(function (q) { return q.actualSavingsUSD != null && !q.partial; });
  }

  // --- Method 1: trailing-2Q realization rate (program default) --------------
  function trailing2Q(data, filters) {
    var k = METRICS.kpis(data, filters);
    return {
      key: 'trailing', label: 'Trailing-2Q realization rate',
      rate: k.realizationRate,
      projectedUSD: k.realizedUSD + k.remainingPipelineUSD * k.realizationRate,
      note: 'Remaining pipeline realized at the trailing two completed quarters’ rate (' +
            Math.round(k.realizationRate * 100) + '%). The current default.',
      confidence: 'medium'
    };
  }

  // --- Method 2: linear regression on the cumulative actual curve ------------
  function linearRegression(data, filters) {
    var q = METRICS.quarterly(data, filters).filter(function (p) { return p.cumActualUSD != null; });
    var n = q.length;
    var k = METRICS.kpis(data, filters);
    if (n < 2) return null;
    var sx = 0, sy = 0, sxy = 0, sxx = 0;
    q.forEach(function (p, i) { var x = i + 1; sx += x; sy += p.cumActualUSD; sxy += x * p.cumActualUSD; sxx += x * x; });
    var slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
    var intercept = (sy - slope * sx) / n;
    var projected = intercept + slope * (data.periods.length); // extend to final quarter
    return {
      key: 'linreg', label: 'Linear regression on cumulative curve',
      rate: null, projectedUSD: Math.max(k.realizedUSD, projected),
      note: 'Straight-line fit through the cumulative actual savings curve, extended to year end. Assumes the recent quarterly run-rate simply continues.',
      confidence: n >= 3 ? 'medium' : 'low'
    };
  }

  // --- Method 3: exponentially weighted realization rate ----------------------
  function ewma(data, filters) {
    var done = completedQuarters(data);
    var k = METRICS.kpis(data, filters);
    if (!done.length) return null;
    var alpha = 0.6, w = 1, sumW = 0, sumR = 0;
    done.forEach(function (q, i) {
      var weight = Math.pow(alpha, done.length - 1 - i); // most recent weighted highest
      sumW += weight; sumR += (q.actualSavingsUSD / q.plannedSavingsUSD) * weight;
    });
    // fold in the partial quarter at reduced weight — it is signal, not noise
    var partial = data.periods.filter(function (q) { return q.partial && q.actualSavingsUSD != null; })[0];
    if (partial) { var pw = 0.5; sumW += pw; sumR += (partial.actualSavingsUSD / partial.plannedSavingsUSD) * pw; }
    var rate = Math.min(1, sumR / sumW);
    return {
      key: 'ewma', label: 'Exponentially weighted average (recent quarters favored)',
      rate: rate, projectedUSD: k.realizedUSD + k.remainingPipelineUSD * rate,
      note: 'Realization rate weighted toward the most recent quarters (' + Math.round(rate * 100) +
            '%), giving partial-quarter momentum some credit. More optimistic when pace is improving.',
      confidence: 'medium'
    };
  }

  function methods(data, filters) {
    return [trailing2Q(data, filters), linearRegression(data, filters), ewma(data, filters)]
      .filter(function (m) { return m; });
  }

  // --- Confidence band: std error of historical quarterly realization --------
  function confidenceBand(data, filters) {
    var done = completedQuarters(data);
    var rates = done.map(function (q) { return q.actualSavingsUSD / q.plannedSavingsUSD; });
    var mean = rates.reduce(function (s, r) { return s + r; }, 0) / (rates.length || 1);
    var variance = rates.reduce(function (s, r) { return s + Math.pow(r - mean, 2); }, 0) / (rates.length || 1);
    var sd = Math.sqrt(variance);
    var k = METRICS.kpis(data, filters);
    var mid = k.realizedUSD + k.remainingPipelineUSD * mean;
    return {
      sd: sd,
      lowUSD: k.realizedUSD + k.remainingPipelineUSD * Math.max(0, mean - sd),
      highUSD: k.realizedUSD + k.remainingPipelineUSD * Math.min(1, mean + sd),
      midUSD: mid,
      crossesTarget: (k.realizedUSD + k.remainingPipelineUSD * Math.min(1, mean + sd)) >= k.targetUSD,
      note: 'Band = remaining pipeline realized at the historical quarterly rate ±1 standard deviation (' +
            Math.round((mean - sd) * 100) + '%–' + Math.round((mean + sd) * 100) + '%).'
    };
  }

  // --- Cost leakage forecast ---------------------------------------------------
  function leakageForecast(data, filters) {
    var trend = METRICS.leakageTrend(data, filters);
    var od = METRICS.overdueDetail(data, filters);
    if (trend.length < 2) return { series: trend, projected: [] };
    // average of the last two monthly increments, extended forward
    var incs = [];
    for (var i = 1; i < trend.length; i++) incs.push(trend[i].cumulativeUSD - trend[i - 1].cumulativeUSD);
    var recent = (incs[incs.length - 1] + incs[incs.length - 2]) / 2;
    var last = trend[trend.length - 1].cumulativeUSD;
    var horizon = ['Sep', 'Oct', 'Nov', 'Dec'];
    var damp = 1;
    var projected = horizon.map(function (m) {
      damp *= od.count ? 0.85 : 0.5; // overdue queue clears as Wave 2 exits land
      last += recent * damp;
      return { month: m + ' (proj.)', cumulativeUSD: last };
    });
    return {
      series: trend, projected: projected, yearEndUSD: last,
      note: 'Overdue roles × average daily onshore cost, extended at the recent monthly pace and damped as the overdue queue clears.',
      confidence: 'low'
    };
  }

  // --- Per-function year-end forecast -------------------------------------------
  function byFunction(data, filters) {
    var k = METRICS.kpis(data, filters);
    var rate = k.realizationRate;
    return METRICS.byDimension(data, filters, 'functionName').map(function (f) {
      var remaining = Math.max(0, f.plannedUSD - f.realizedUSD);
      // zero-realization functions get no credit until they produce a first exit
      var effRate = f.realizedUSD === 0 && f.exited === 0 ? rate * 0.5 : rate;
      var projected = f.realizedUSD + remaining * effRate;
      var gap = f.plannedUSD - projected;
      return {
        name: f.key, plannedUSD: f.plannedUSD, realizedUSD: f.realizedUSD,
        projectedUSD: projected, gapUSD: gap,
        attainment: f.plannedUSD ? projected / f.plannedUSD : 0,
        rag: METRICS.rag(f.plannedUSD ? projected / f.plannedUSD : 0)
      };
    }).sort(function (a, b) { return b.gapUSD - a.gapUSD; });
  }

  // --- Anomaly flags: function realization moved >2σ vs. the population -------
  function anomalies(data, filters) {
    var d = METRICS.deltasVsPrior(data, filters);
    if (!d || !d.movers) return [];
    var all = d.movers.concat(); // top movers carry the signal
    var deltas = Object.keys(data.prior.realizationByFunction || {}).map(function (name) {
      var now = METRICS.byDimension(data, null, 'functionName')
        .filter(function (x) { return x.key === name; })[0];
      return { name: name, delta: (now ? now.savingsAttainment : 0) - data.prior.realizationByFunction[name] };
    });
    var mean = deltas.reduce(function (s, x) { return s + x.delta; }, 0) / (deltas.length || 1);
    var sd = Math.sqrt(deltas.reduce(function (s, x) { return s + Math.pow(x.delta - mean, 2); }, 0) / (deltas.length || 1)) || 1;
    return deltas.filter(function (x) { return Math.abs(x.delta - mean) > 2 * sd; })
      .map(function (x) {
        return { name: x.name, delta: x.delta, sigma: (x.delta - mean) / sd,
                 expected: 'within ±' + Math.round(2 * sd * 100) + ' pts of ' + Math.round(mean * 100) + ' pts' };
      });
  }

  return { methods: methods, trailing2Q: trailing2Q, linearRegression: linearRegression, ewma: ewma,
           confidenceBand: confidenceBand, leakageForecast: leakageForecast,
           byFunction: byFunction, anomalies: anomalies };
})();
