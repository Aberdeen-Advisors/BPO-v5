/* ============================================================================
   WORKFORCE, PLANNING & EXECUTION DATA  (v2)
   ----------------------------------------------------------------------------
   ILLUSTRATIVE AND ANONYMIZED. Extends the DATA object created in data.js with:
     DATA.workforce   — one row per position (FTE, Contractor, Vendor, BPO Hub)
     DATA.wft         — monthly workforce totals: 12 historical + 10 forecast
     DATA.initiatives — initiative / work management records with dependencies
     DATA.actions     — action items, including free-text notes for AI analysis
     DATA.funding     — requirement vs. funded vs. assigned, by domain
     DATA.policy      — targets and metric-derivation switches
   No real names, vendors, or client identifiers. Real data enters via upload
   or (later) the Fabric semantic model — never by commit.
   ============================================================================ */

(function () {
  'use strict';

  var AS_OF = '2026-08-15';

  // --- Policy / targets -----------------------------------------------------
  // These are the switches PMs have been uncertain about. Every one is surfaced
  // in the Metric Dictionary page so a definition is never implicit.
  DATA.policy = {
    fteTargetRatio: 0.70,            // 70 / 30 FTE to non-FTE
    // Does the BPO Hub count as non-FTE in the ratio? Flipping this reverses
    // the conclusion, which is exactly why it must be an explicit decision.
    bpoHubCountsAsNonFte: true,
    coverageCriticalThreshold: 2,    // <= this many people in a capability = critical
    duplicationThreshold: 8,         // same capability in >= this many teams = review
    contractCliffDays: 90,           // non-FTE ending within this window
    vendorConcentrationThreshold: 3, // >= this many vendors in one team = fragmented
    planningCycle: '2027 CT'
  };

  // --- Reference lists ------------------------------------------------------
  var VENDORS = ['Vendor Alpha', 'Vendor Beta', 'Vendor Gamma', 'Vendor Delta',
                 'Vendor Epsilon', 'Vendor Zeta', 'Vendor Eta'];
  var LEVELS = ['Junior', 'Mid', 'Senior', 'Lead'];
  var CAPS = {
    'Process Operations':  ['Process Operations', 'Quality Assurance', 'Vendor Management'],
    'Service & Support':   ['Service Desk', 'Application Support', 'Quality Assurance'],
    'Data':                ['Data Engineering', 'Data Analysis', 'Release Management'],
    'Applications':        ['Application Support', 'Release Management', 'Quality Assurance'],
    'Infrastructure':      ['Infrastructure Ops', 'Cloud Engineering', 'Security Operations'],
    'Program Management':  ['Program Management', 'Vendor Management', 'Data Analysis']
  };

  // team, domain, location, [fte, contractor, vendor, bpoHub], vendors used
  var TEAMS = [
    ['Team 01', 'Process Operations', 'Onshore — Site 1', [14, 3, 4, 3], ['Vendor Alpha', 'Vendor Beta', 'Vendor Gamma', 'Vendor Delta']],
    ['Team 02', 'Process Operations', 'Onshore — Site 2', [16, 2, 3, 4], ['Vendor Alpha', 'Vendor Beta']],
    ['Team 03', 'Process Operations', 'Indonesia — Hub',  [ 4, 1, 2, 6], ['Vendor Alpha']],
    ['Team 04', 'Process Operations', 'Onshore — Site 3', [11, 4, 2, 0], ['Vendor Beta', 'Vendor Gamma']],
    ['Team 05', 'Service & Support',  'Onshore — Site 1', [13, 3, 3, 2], ['Vendor Delta', 'Vendor Epsilon']],
    ['Team 06', 'Service & Support',  'Onshore — Site 2', [12, 2, 4, 3], ['Vendor Delta', 'Vendor Epsilon', 'Vendor Zeta']],
    ['Team 07', 'Service & Support',  'Indonesia — Hub',  [ 3, 1, 2, 5], ['Vendor Delta']],
    ['Team 08', 'Service & Support',  'Nearshore — Site A',[8, 3, 3, 0], ['Vendor Epsilon', 'Vendor Zeta']],
    ['Team 09', 'Data',               'Onshore — Site 1', [15, 5, 3, 1], ['Vendor Gamma', 'Vendor Eta']],
    ['Team 10', 'Data',               'Onshore — Site 3', [10, 4, 2, 0], ['Vendor Gamma']],
    ['Team 11', 'Data',               'Nearshore — Site A',[6, 2, 3, 2], ['Vendor Eta', 'Vendor Zeta']],
    ['Team 12', 'Applications',       'Onshore — Site 2', [18, 4, 4, 2], ['Vendor Alpha', 'Vendor Gamma', 'Vendor Eta']],
    ['Team 13', 'Applications',       'Onshore — Site 1', [14, 3, 3, 0], ['Vendor Alpha', 'Vendor Eta']],
    ['Team 14', 'Applications',       'Indonesia — Hub',  [ 3, 1, 2, 2], ['Vendor Alpha']],
    ['Team 15', 'Infrastructure',     'Onshore — Site 3', [16, 4, 5, 0], ['Vendor Beta', 'Vendor Delta']],
    ['Team 16', 'Infrastructure',     'Onshore — Site 1', [13, 3, 4, 0], ['Vendor Beta', 'Vendor Delta', 'Vendor Zeta']],
    ['Team 17', 'Infrastructure',     'Indonesia — Hub',  [ 2, 0, 2, 0], ['Vendor Beta']],
    ['Team 18', 'Program Management', 'Onshore — Site 1', [15, 2, 2, 0], ['Vendor Epsilon']],
    ['Team 19', 'Program Management', 'Onshore — Site 2', [14, 1, 2, 0], ['Vendor Epsilon']]
  ];

  var BU_BY_DOMAIN = {
    'Process Operations': 'Operations', 'Service & Support': 'Operations',
    'Data': 'Technology Services', 'Applications': 'Technology Services',
    'Infrastructure': 'Technology Services', 'Program Management': 'Corporate Services'
  };
  var FUNDING = ['Run', 'Change', 'Capital', 'Unfunded'];

  function iso(d) { return d.toISOString().slice(0, 10); }
  function addDays(base, n) { var d = new Date(base + 'T00:00:00'); d.setDate(d.getDate() + n); return iso(d); }

  // --- Build the roster -----------------------------------------------------
  var workforce = [], seq = 0, unfundedLeft = 18, cliffLeft = 23;

  TEAMS.forEach(function (t, ti) {
    var team = t[0], domain = t[1], location = t[2], mix = t[3], vendors = t[4];
    var caps = CAPS[domain];
    var kinds = [['FTE', mix[0]], ['Contractor', mix[1]], ['Vendor', mix[2]], ['BPO Hub', mix[3]]];
    var idxInTeam = 0;

    kinds.forEach(function (pair) {
      var kind = pair[0], n = pair[1];
      for (var i = 0; i < n; i++) {
        seq++; idxInTeam++;
        var cap = caps[idxInTeam % caps.length];
        var isFte = kind === 'FTE';
        var vendorName = kind === 'Vendor' ? vendors[i % vendors.length]
                       : kind === 'Contractor' ? vendors[(i + ti) % vendors.length] : null;

        // Contract end dates for non-FTE; some land inside the cliff window
        var endDate = null;
        if (!isFte) {
          var cliff = cliffLeft > 0 && (seq % 13 === 0);
          if (cliff) { cliffLeft--; endDate = addDays(AS_OF, 12 + (seq % 70)); }
          else { endDate = addDays(AS_OF, 140 + (seq % 400)); }
        }

        // Funding — FTE mostly Run, change work and unfunded demand concentrated in non-FTE
        var funding;
        if (unfundedLeft > 0 && !isFte && seq % 11 === 0) { funding = 'Unfunded'; unfundedLeft--; }
        else if (isFte) { funding = (seq % 7 === 0) ? 'Change' : 'Run'; }
        else { funding = FUNDING[seq % 3]; }

        workforce.push({
          id: 'W-' + String(seq).padStart(3, '0'),
          workerType: kind,
          isFte: isFte,
          vendorName: vendorName,
          team: team,
          domain: domain,
          businessUnit: BU_BY_DOMAIN[domain],
          location: kind === 'BPO Hub' ? 'Indonesia — Hub' : location,
          capability: cap,
          level: LEVELS[seq % LEVELS.length],
          startDate: addDays('2024-01-08', (seq * 11) % 900),
          endDate: endDate,
          fundingSource: funding,
          assignment: null,           // filled below from initiatives
          annualCost: (isFte ? 118 : kind === 'BPO Hub' ? 52 : 165) * 1000 + (seq % 9) * 1000,
          status: 'Active'
        });
      }
    });
  });

  // --- Initiatives ----------------------------------------------------------
  // owner is a role, never a person. dependsOn creates a real dependency chain.
  var initiatives = [
    ['INI-01', 'BPO Hub Wave 3 execution', 'Transition Lead', 'Process Operations', 'In Progress', 'Amber', '2026-09-30', 'Change', ['Process Operations', 'Quality Assurance'], 18, 14, [], null],
    ['INI-02', 'BPO Hub Wave 4 execution', 'Transition Lead', 'Infrastructure', 'Not Started', 'Red', '2026-11-28', 'Change', ['Infrastructure Ops', 'Cloud Engineering'], 16, 6, ['INI-01', 'INI-05'],
      { metric: 'Stabilization rate', threshold: '< 60% at 2026-09-30', action: 'Hold Wave 4 kickoff and re-plan' }],
    ['INI-03', 'Knowledge transfer acceleration', 'Delivery Lead — BPO Hub', 'Service & Support', 'In Progress', 'Red', '2026-10-15', 'Run', ['Application Support', 'Service Desk'], 22, 15, [],
      { metric: 'KT not started', threshold: '> 60 roles within 30 days of exit', action: 'Escalate to steering and pause new exits' }],
    ['INI-04', 'Contractor-to-FTE conversion programme', 'Workforce Lead', 'Applications', 'In Progress', 'Amber', '2027-03-31', 'Change', ['Application Support', 'Release Management'], 12, 9, [], null],
    ['INI-05', 'Infrastructure runbook hardening', 'Domain Lead — Infrastructure', 'Infrastructure', 'In Progress', 'Amber', '2026-10-31', 'Run', ['Infrastructure Ops', 'Security Operations'], 9, 7, [], null],
    ['INI-06', 'Vendor consolidation — Tier 1', 'Vendor Management Lead', 'Process Operations', 'Not Started', 'Amber', '2027-01-30', 'Change', ['Vendor Management'], 6, 3, ['INI-01'], null],
    ['INI-07', 'Data platform migration', 'Domain Lead — Data', 'Data', 'In Progress', 'Green', '2027-02-26', 'Capital', ['Data Engineering', 'Cloud Engineering'], 14, 14, [], null],
    ['INI-08', 'Semantic model & certified metrics', 'Analytics Lead', 'Data', 'In Progress', 'Green', '2026-12-18', 'Capital', ['Data Engineering', 'Data Analysis'], 8, 8, ['INI-07'], null],
    ['INI-09', 'Single sign-on rollout', 'Platform Lead', 'Applications', 'Not Started', 'Red', '2026-12-31', 'Run', ['Security Operations', 'Application Support'], 5, 1, [],
      { metric: 'Identity team engagement', threshold: 'Not scheduled by 2026-09-15', action: 'Escalate — gates all real-data deployment' }],
    ['INI-10', '2027 CT planning submission', 'Program Management Lead', 'Program Management', 'In Progress', 'Amber', '2026-11-14', 'Run', ['Program Management', 'Data Analysis'], 7, 6, ['INI-08'], null],
    ['INI-11', 'Location strategy alignment', 'Workforce Lead', 'Service & Support', 'Not Started', 'Amber', '2027-04-30', 'Change', ['Program Management'], 4, 2, ['INI-06'], null],
    ['INI-12', 'Role coverage remediation', 'Domain Lead — Applications', 'Applications', 'In Progress', 'Red', '2026-10-30', 'Run', ['Application Support', 'Quality Assurance'], 10, 5, [],
      { metric: 'Single-point-of-failure capabilities', threshold: '> 6 capabilities with one person', action: 'Fund cross-training or backfill' }],
    ['INI-13', 'Contract cliff mitigation', 'Vendor Management Lead', 'Infrastructure', 'In Progress', 'Red', '2026-09-30', 'Run', ['Vendor Management', 'Infrastructure Ops'], 5, 2, [],
      { metric: 'Non-FTE contracts ending', threshold: '> 20 inside 90 days', action: 'Trigger renewal or replacement plan' }],
    ['INI-14', 'Integration layer — Jira / SharePoint / EBC', 'Platform Lead', 'Program Management', 'Not Started', 'Amber', '2027-05-29', 'Capital', ['Release Management', 'Data Engineering'], 6, 2, ['INI-08', 'INI-09'], null]
  ].map(function (a) {
    return {
      id: a[0], name: a[1], owner: a[2], domain: a[3], status: a[4], rag: a[5],
      dueDate: a[6], fundingSource: a[7], requiredCapabilities: a[8],
      requiredHeadcount: a[9], assignedHeadcount: a[10], dependsOn: a[11], triggerPoint: a[12]
    };
  });

  // Assign roster members to initiatives within their own domain; leave a
  // deliberate unassigned pool so "work not mapped to people" is visible.
  var byDomain = {};
  initiatives.forEach(function (ini) { (byDomain[ini.domain] = byDomain[ini.domain] || []).push(ini); });
  var assignCursor = {};
  workforce.forEach(function (p, i) {
    var pool = byDomain[p.domain];
    if (!pool || i % 5 === 0) { p.assignment = null; return; }   // ~20% unassigned
    assignCursor[p.domain] = (assignCursor[p.domain] || 0) + 1;
    p.assignment = pool[assignCursor[p.domain] % pool.length].id;
  });

  // --- Action items ---------------------------------------------------------
  // note[] is free text on purpose — the AI-assisted analysis reads these.
  var ACT = [
    ['Confirm savings basis with data owner', 'Program Management Lead', 'INI-10', '2026-08-07', 'Blocked', 'High', 'INI-08', 'Waiting on finance to confirm whether savings recognise at exit or at stabilisation. This is blocking the baseline sign-off and has slipped twice.'],
    ['Schedule identity team session for SSO', 'Platform Lead', 'INI-09', '2026-07-31', 'Open', 'High', null, 'No response from the identity team for three weeks. Risk that this slips past the December date and blocks any real data load.'],
    ['Reconcile unallocated savings variance', 'Analytics Lead', 'INI-08', '2026-08-25', 'In Progress', 'High', null, 'Function-level allocations do not sum to the leadership commitment. Need finance to confirm which figure is authoritative before the baseline is locked.'],
    ['Draft Wave 4 readiness assessment', 'Transition Lead', 'INI-02', '2026-09-05', 'Open', 'High', 'INI-01', 'Cannot start until Wave 3 stabilisation numbers are final. Currently at risk.'],
    ['Renew four expiring infrastructure contracts', 'Vendor Management Lead', 'INI-13', '2026-08-13', 'In Progress', 'High', null, 'Four contracts expire within six weeks. Procurement lead time is typically eight weeks so this is already late.'],
    ['Cross-train backup for release management', 'Domain Lead — Applications', 'INI-12', '2026-09-12', 'Open', 'High', null, 'Single point of failure. One person holds the entire release process for two domains.'],
    ['Publish certified metric definitions', 'Analytics Lead', 'INI-08', '2026-09-19', 'In Progress', 'Medium', null, 'Project managers report they cannot explain how several headline metrics are derived. Publishing the dictionary should resolve most of it.'],
    ['Map unfunded demand to 2027 CT request', 'Program Management Lead', 'INI-10', '2026-09-26', 'Open', 'High', null, 'Eighteen positions are currently unfunded. These need to appear in the planning submission or they disappear.'],
    ['Consolidate Tier 1 vendor panel', 'Vendor Management Lead', 'INI-06', '2026-10-09', 'Not Started', 'Medium', 'INI-01', 'Four separate vendors inside one team. Consolidation should reduce coordination overhead but needs contract review first.'],
    ['Validate forecast levers with program leadership', 'Workforce Lead', 'INI-10', '2026-09-02', 'Open', 'High', null, 'The scenario levers were assumed rather than derived. Need an hour with the program lead to confirm they are the right ones.'],
    ['Complete KT for roles exiting in September', 'Delivery Lead — BPO Hub', 'INI-03', '2026-08-28', 'In Progress', 'High', null, 'A large number of roles are inside thirty days of exit with no knowledge transfer logged. This is the biggest delivery risk on the programme.'],
    ['Agree data contract with BPO Hub team', 'Analytics Lead', 'INI-08', '2026-09-11', 'Open', 'Medium', null, 'Weekly file arrives in an inconsistent shape. A schema agreement would remove most of the manual cleanup.'],
    ['Assess location alignment by domain', 'Workforce Lead', 'INI-11', '2026-10-16', 'Not Started', 'Medium', 'INI-06', 'Several domains are spread across four locations which increases coordination cost.'],
    ['Prepare EBC extract for planning cycle', 'Program Management Lead', 'INI-10', '2026-10-31', 'Not Started', 'High', 'INI-10', 'Needs to match the 2027 CT template exactly or it gets rejected.'],
    ['Review duplicate quality assurance coverage', 'Domain Lead — Applications', 'INI-12', '2026-09-25', 'Open', 'Low', null, 'The same capability appears in many teams. May be appropriate, may be duplication. Worth a look.'],
    ['Stand up Jira integration proof of concept', 'Platform Lead', 'INI-14', '2026-11-20', 'Not Started', 'Medium', 'INI-09', 'Blocked behind single sign-on. Cannot authenticate the connection until identity is sorted.'],
    ['Close out Wave 2 overdue rolloffs', 'Transition Lead', 'INI-01', '2026-08-11', 'In Progress', 'High', null, 'Overdue exits are accumulating cost every day they remain open. Leakage is accelerating.'],
    ['Confirm attrition assumptions for forecast', 'Workforce Lead', 'INI-04', '2026-09-30', 'Open', 'Medium', null, 'Current model assumes no attrition on the receiving side which is almost certainly optimistic.'],
    ['Document infrastructure runbooks', 'Domain Lead — Infrastructure', 'INI-05', '2026-10-24', 'In Progress', 'Medium', null, 'Progressing steadily. About two thirds complete.'],
    ['Baseline data platform migration scope', 'Domain Lead — Data', 'INI-07', '2026-09-18', 'Done', 'Medium', null, 'Completed and signed off. No issues.'],
    ['Set up quarantine review routine', 'Analytics Lead', 'INI-08', '2026-09-04', 'Open', 'Medium', null, 'Rejected rows need a weekly owner or they will simply pile up unread.'],
    ['Confirm 70/30 ratio definition', 'Workforce Lead', 'INI-10', '2026-08-08', 'Blocked', 'High', null, 'Unclear whether the BPO Hub counts as non-FTE. The answer reverses whether we are on target or not, so it needs a decision.'],
    ['Refresh vendor performance scorecards', 'Vendor Management Lead', 'INI-06', '2026-11-06', 'Not Started', 'Low', null, 'Routine. No concerns.'],
    ['Align funding requests to assignment plan', 'Program Management Lead', 'INI-10', '2026-10-02', 'In Progress', 'High', null, 'Requirements, funding and assignments are tracked in three different places and do not reconcile.'],
    ['Plan cross-domain QA pooling', 'Domain Lead — Applications', 'INI-12', '2026-11-13', 'Not Started', 'Low', null, 'Idea stage only.'],
    ['Verify BPO Hub hire start dates', 'Delivery Lead — BPO Hub', 'INI-03', '2026-09-08', 'Open', 'Medium', null, 'A number of hires started later than planned. Want to understand whether this is a pattern or noise.'],
    ['Escalate Wave 4 resourcing shortfall', 'Transition Lead', 'INI-02', '2026-09-15', 'Open', 'High', 'INI-02', 'Wave 4 needs sixteen people and has six. Without a decision this will not start on time.'],
    ['Publish integration architecture one-pager', 'Platform Lead', 'INI-14', '2026-12-04', 'Not Started', 'Low', null, 'For leadership circulation once the approach is agreed.']
  ];
  var actions = ACT.map(function (a, i) {
    return {
      id: 'ACT-' + String(i + 1).padStart(3, '0'),
      title: a[0], owner: a[1], initiativeId: a[2], dueDate: a[3],
      status: a[4], priority: a[5], blockedBy: a[6], note: a[7],
      overdue: new Date(a[3] + 'T00:00:00') < new Date(AS_OF + 'T00:00:00') && a[4] !== 'Done'
    };
  });

  // --- Workforce forecast (WFT): 12 historical months + 10 forecast ---------
  var MONTHS = ['2025-09','2025-10','2025-11','2025-12','2026-01','2026-02','2026-03','2026-04',
                '2026-05','2026-06','2026-07','2026-08','2026-09','2026-10','2026-11','2026-12',
                '2027-01','2027-02','2027-03','2027-04','2027-05','2027-06'];
  var SERIES = {
    fte:        [212,211,210,210,209,209,208,208,207,207,207,207, 207,207,208,208,209,209,210,210,211,212],
    contractor: [ 62, 61, 60, 58, 57, 55, 54, 52, 51, 50, 49, 48,  46, 44, 43, 41, 40, 39, 38, 37, 36, 36],
    vendor:     [ 60, 60, 59, 59, 58, 58, 57, 57, 56, 56, 55, 55,  54, 53, 52, 51, 50, 50, 49, 49, 48, 48],
    bpoHub:     [  0,  2,  4,  7, 10, 13, 16, 19, 22, 25, 28, 30,  36, 42, 48, 54, 60, 66, 70, 74, 76, 78]
  };
  var wft = MONTHS.map(function (m, i) {
    var fte = SERIES.fte[i], cw = SERIES.contractor[i], ven = SERIES.vendor[i], bpo = SERIES.bpoHub[i];
    return {
      month: m, forecast: i > 11,
      fte: fte, contractor: cw, vendor: ven, bpoHub: bpo,
      total: fte + cw + ven + bpo,
      nonFteInclHub: cw + ven + bpo,
      nonFteExclHub: cw + ven
    };
  });

  // --- Funding: requirement vs. funded vs. assigned, by domain --------------
  var funding = [
    ['Process Operations',  84, 79, 72],
    ['Service & Support',   71, 67, 61],
    ['Data',                58, 53, 50],
    ['Applications',        61, 56, 52],
    ['Infrastructure',      54, 49, 44],
    ['Program Management',  38, 36, 34]
  ].map(function (f) {
    return { domain: f[0], requiredFte: f[1], fundedFte: f[2], assignedFte: f[3],
             fundingGap: f[1] - f[2], assignmentGap: f[2] - f[3] };
  });

  // --- Specialist capabilities -------------------------------------------
  // A handful of niche skills sit with one or two people. This is what role
  // coverage is actually for: finding them before someone resigns.
  var SPECIALISTS = [
    ['Mainframe Support',     1], ['Payments Processing',   2],
    ['Identity Engineering',  1], ['Regulatory Reporting',  2],
    ['Treasury Operations',   1], ['Network Engineering',   2]
  ];
  var specCursor = 0;
  SPECIALISTS.forEach(function (sp) {
    var name = sp[0], n = sp[1];
    for (var i = 0; i < n; i++) {
      // spread them deterministically through the roster
      var idx = (17 + specCursor * 41) % workforce.length;
      while (workforce[idx].__spec) { idx = (idx + 1) % workforce.length; }
      workforce[idx].capability = name;
      workforce[idx].__spec = true;
      specCursor++;
    }
  });
  workforce.forEach(function (p) { delete p.__spec; });

  // --- Contract cliff: exactly 23 non-FTE contracts inside the window -------
  var nonFte = workforce.filter(function (p) { return !p.isFte; });
  var CLIFF = 23;
  nonFte.forEach(function (p, i) {
    if (i % Math.floor(nonFte.length / CLIFF) === 0 && i / Math.floor(nonFte.length / CLIFF) < CLIFF) {
      p.endDate = addDays(AS_OF, 9 + (i * 7) % 80);   // 9-88 days out
    } else if (p.endDate && new Date(p.endDate) < new Date(addDays(AS_OF, 100))) {
      p.endDate = addDays(AS_OF, 150 + (i * 11) % 380);
    }
  });

  DATA.workforce = workforce;
  DATA.wft = wft;
  DATA.initiatives = initiatives;
  DATA.actions = actions;
  DATA.funding = funding;
  DATA.vendors = VENDORS;
})();
