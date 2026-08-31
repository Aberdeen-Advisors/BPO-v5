/* ============================================================================
   APP (v3) — engine: state, filtering, chrome, chart infrastructure, scenario
   math, routing. ALL page markup and rendering lives in pages.js.
   Every figure comes from METRICS. Nothing is computed here.
   ============================================================================ */

/* No authentication in this build by design. Production sits behind corporate
   SSO, which supplies both identity and role. The in-app switcher is demo-only. */
var AUTH_CONFIG = {
  mode: 'none',
  roles: ['Viewer', 'Admin'],
  defaultRole: 'Admin',
  note: 'No sign-in. SSO supplies identity and role in production.'
};

var APP = (function () {
  'use strict';

  // ---------- brand palette (locked) ----------
  var C = {
    blue: '#09375F', verd: '#44B0B1', sky: '#5CC8FF', gold: '#F7D002',
    jade: '#00A676', jasper: '#DB504A', onyx: '#404040',
    muted: 'rgba(9,55,95,.62)', hairline: 'rgba(9,55,95,.10)'
  };
  var SERIES = [C.blue, C.verd, C.sky, C.gold, C.jade, C.jasper];
  function alpha(hex, a) {
    if (hex.indexOf('rgba') === 0) return hex;
    var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  // ---------- state ----------
  var SESSION = null;
  var FILTERS = {};
  var CHARTS = {};
  var CURRENT_PAGE = 1;
  var SCENARIO_NOTE = '';
  // Defaults reproduce the ratified scenario set: the programme's best quarter,
  // its current trailing pace, and its worst quarter.
  var SCEN_DEFAULTS = {
    up:   { name: 'Upside',    basis: 'Best quarter sustained',   rate: 85, pace: 100, delay: 10, ramp: 6, attr: 0 },
    base: { name: 'Base Case', basis: 'Current trailing pace',    rate: 72, pace: 100, delay: 10, ramp: 6, attr: 0 },
    down: { name: 'Downside',  basis: 'Worst quarter sustained',  rate: 67, pace: 100, delay: 10, ramp: 6, attr: 0 }
  };
  var SCEN = JSON.parse(JSON.stringify(SCEN_DEFAULTS));

  // ---------- helpers ----------
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function fmtM(v) { return '$' + (v / 1e6).toFixed(1) + 'M'; }
  function fmtK(v) { return '$' + Math.round(v / 1e3) + 'K'; }
  function fmt$(v) { var a = Math.abs(v); return (v < 0 ? '-' : '') + (a >= 950000 ? fmtM(a) : fmtK(a)); }
  function fmtPct(v) { return Math.round(v * 100) + '%'; }
  function fmtPct1(v) { return (Math.round(v * 1000) / 10).toFixed(1) + '%'; }
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

  // ---------- modal (drill-downs; available to every role) ----------
  function showModal(html) {
    $('#modal-box').innerHTML = html;
    $('#modal-backdrop').classList.add('open');
  }
  function closeModal() { $('#modal-backdrop').classList.remove('open'); }
  document.addEventListener('click', function (e) {
    if (e.target === $('#modal-backdrop')) closeModal();
    if (!e.target.closest('.info-btn') && !e.target.closest('#info-pop')) $('#info-pop').classList.remove('open');
    if (!e.target.closest('#admin-slot')) { var m = $('#actions-menu'); if (m) m.classList.remove('open'); }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

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
    var rail = $('#slicer-rail'); rail.innerHTML = '';
    var vals = METRICS.slicerValues(DATA);
    var wfVals = METRICS.workforceSlicerValues(DATA);
    Object.keys(wfVals).forEach(function (k) { vals[k] = wfVals[k]; });
    [['Transition & shared', METRICS.SLICER_DIMS], ['Workforce', METRICS.WORKFORCE_ONLY_DIMS]].forEach(function (grp) {
      var head = document.createElement('div');
      head.className = 'slicer-section'; head.textContent = grp[0];
      rail.appendChild(head);
      grp[1].forEach(function (dim) {
        var g = document.createElement('div');
        g.className = 'slicer-group' + (FILTERS[dim] && FILTERS[dim].length ? ' open' : '');
        var head2 = document.createElement('button');
        var n = (FILTERS[dim] || []).length;
        head2.innerHTML = '<span>' + esc(DIM_LABELS[dim]) + (n ? ' <span class="count-badge">' + n + '</span>' : '') +
          '</span><span class="slicer-caret">▶</span>';
        head2.onclick = function () { g.classList.toggle('open'); };
        g.appendChild(head2);
        var opts = document.createElement('div'); opts.className = 'slicer-opts';
        (vals[dim] || []).forEach(function (v) {
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
  // PAGES.INFO entries are [title, question answered, methodology].
  // The question is rendered in bold — it is the thing an executive actually needs.
  function bindInfoPops(root) {
    $$('.info-btn', root).forEach(function (btn) {
      btn.onclick = function (e) {
        e.stopPropagation();
        var pop = $('#info-pop'), item = (window.PAGES && PAGES.INFO[btn.dataset.info]);
        if (!item) return;
        pop.innerHTML = '<h5>' + esc(item[0]) + '</h5>' +
          '<p class="info-q"><b>' + esc(item[1]) + '</b></p>' +
          '<p class="info-body">' + item[2] + '</p>';
        pop.classList.add('open');
        var r = btn.getBoundingClientRect();
        pop.style.top = Math.min(window.innerHeight - 230, r.bottom + 8) + 'px';
        pop.style.left = Math.max(10, Math.min(window.innerWidth - 335, r.left - 150)) + 'px';
      };
    });
  }

  // ---------- Chart.js infrastructure ----------
  function chartDefaults() {
    Chart.defaults.font.family = "'Poppins', Arial, sans-serif";
    Chart.defaults.font.size = 11;
    Chart.defaults.color = C.onyx;
    Chart.defaults.animation.duration = 250;
    Chart.defaults.plugins.tooltip.backgroundColor = C.blue;
    Chart.defaults.plugins.tooltip.cornerRadius = 6;
    Chart.defaults.plugins.tooltip.titleFont = { weight: 500 };
  }
  function chartClick(dim, mapLabel) {
    return function (evt, elements, chart) {
      if (!elements.length) {
        if (FILTERS[dim] && FILTERS[dim].length) { delete FILTERS[dim]; updateAll(); }
        return;
      }
      var label = chart.data.labels[elements[0].index];
      var value = mapLabel ? mapLabel(label) : label;
      if (dim === 'wave') {
        var m = Object.keys(WAVE_LABELS).filter(function (k) { return WAVE_LABELS[k] === label; });
        value = m.length ? m[0] : label;
      }
      toggleFilter(dim, value, evt.native && (evt.native.ctrlKey || evt.native.metaKey));
    };
  }
  function dimColors(colorArr, key, values) {
    var sel = FILTERS[key] || [];
    if (!sel.length) return colorArr;
    return colorArr.map(function (c, i) { return sel.indexOf(values[i]) >= 0 ? c : alpha(c, .18); });
  }

  // ---------- scenario math ----------
  function scenarioResult(key) {
    var s = SCEN[key];
    return METRICS.scenario(DATA, FILTERS, {
      realizationRate: s.rate / 100, exitPacePct: s.pace / 100,
      delayDays: s.delay, rampWeeks: s.ramp, attritionAdderUSD: s.attr * 1000
    });
  }
  // Outcomes for the three historical reference scenarios, always computed from
  // the untouched defaults so editing the workbench never moves the reference.
  function referenceResult(key) {
    var d = SCEN_DEFAULTS[key];
    return METRICS.scenario(DATA, FILTERS, {
      realizationRate: d.rate / 100, exitPacePct: d.pace / 100,
      delayDays: d.delay, rampWeeks: d.ramp, attritionAdderUSD: d.attr * 1000
    });
  }
  function resetScenarios() {
    SCEN = JSON.parse(JSON.stringify(SCEN_DEFAULTS));
    SCENARIO_NOTE = '';
  }
  function setScenarioNote(t) { SCENARIO_NOTE = t; }

  // ---------- routing ----------
  function gotoPage(n) {
    CURRENT_PAGE = n;
    $$('.page').forEach(function (p) { p.classList.remove('active'); });
    var el = $('#page-' + n); if (el) el.classList.add('active');
    $$('.pagetab').forEach(function (t) { t.classList.toggle('active', +t.dataset.page === n); });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(function () { Object.keys(CHARTS).forEach(function (c) { if (CHARTS[c]) CHARTS[c].resize(); }); }, 30);
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

  // ---------- master refresh ----------
  function updateAll() {
    renderFilterChips();
    renderSlicers();
    if (window.PAGES) PAGES.update(FILTERS);
    renderDataStamp();
  }

  // ---------- role (no auth by design) ----------
  function init() {
    SESSION = { email: 'demo@client.example', role: sessionStorage.getItem('bpoRole') || 'Admin' };
    chartDefaults();
    if (window.PAGES) PAGES.build();
    bindInfoPops(document);
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
  // from the DOM entirely, not hidden or disabled.
  function applyRole() {
    var slot = $('#admin-slot');
    slot.innerHTML = '';
    if (SESSION.role === 'Admin' && window.ADMIN) ADMIN.mount(slot);
  }
  function setRole(role) {
    SESSION.role = role;
    sessionStorage.setItem('bpoRole', role);
    renderRoleSwitch(); applyRole(); updateAll();
    toast('Viewing as ' + role);
  }

  function refreshData() {
    FILTERS = {};
    renderSlicers();
    updateAll();
    toast('Dataset refreshed — storyline and forecasts regenerated');
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    get session() { return SESSION; },
    C: C, SERIES: SERIES, alpha: alpha, CHARTS: CHARTS,
    chartClick: chartClick, dimColors: dimColors, bindInfoPops: bindInfoPops,
    getFilters: function () { return JSON.parse(JSON.stringify(FILTERS)); },
    setFilters: setFilters, toggleFilter: toggleFilter, clearFilters: clearFilters,
    activeFilterCount: activeFilterCount,
    gotoPage: gotoPage, updateAll: updateAll, refreshData: refreshData, setRole: setRole,
    showModal: showModal, closeModal: closeModal,
    SCEN: function () { return SCEN; }, SCEN_DEFAULTS: SCEN_DEFAULTS,
    scenarioResult: scenarioResult, referenceResult: referenceResult, resetScenarios: resetScenarios,
    scenarioNote: function () { return SCENARIO_NOTE; }, setScenarioNote: setScenarioNote,
    generateStoryline: function (page, k) { return window.PAGES ? PAGES.storylineText(page) : ''; },
    fmt: { M: fmtM, K: fmtK, $: fmt$, pct: fmtPct, pct1: fmtPct1, date: fmtDate },
    esc: esc, toast: toast, WAVE_LABELS: WAVE_LABELS
  };
})();
