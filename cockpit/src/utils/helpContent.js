/** In-app help — German, planner-oriented. */

/** Kurzbeschreibung pro Feature-ID — synchron mit config/featureCatalog.json */
export const FEATURE_PURPOSES = {
  'daily-wizard': 'Geführter Planer-Alltag — KI-Agenten, Morning Briefing, Empfehlungen.',
  help: 'Dokumentation der verfügbaren Module und Begriffe.',
  dashboard: 'KPIs und Schnellzugriff auf Empfehlungen und Massen-Simulation.',
  'line-optimization': 'Reihenfolge auf Verpackungslinien optimieren und speichern.',
  simulation: 'Einzelauftrag simulieren: welche Charge passt, welche Regeln greifen.',
  allocations: 'Ausgeführte und simulierte Allokationsergebnisse einsehen.',
  'confirmed-assignments': 'Bestätigte Chargen-Zuordnungen und Zeitplan freigeben.',
  'control-tower': 'Globale Supply-Chain-Übersicht und Lagebild.',
  exceptions: 'Blockierte Fälle kommentieren, eskalieren oder lösen.',
  inventory: 'Verfügbare Chargen, Qualitätsstatus und Haltbarkeit.',
  'rule-management': 'Versionierte Regeln pflegen (Land, Kunde, Markt, Sequenz, RMSL).',
  audit: 'Historie aller Simulations- und Zuordnungsentscheidungen.',
  'admin-system': 'Datenquelle, Integrationen und Benutzer-Funktionszugriff.',
  'daily-planning': 'Tagesübersicht mit Gantt, Linienauslastung und KPIs.',
  orders: 'Liste aller Verpackungsaufträge mit Status und Zielland.',
  analytics: 'Leistungsgrad, OEE und historische Linien-Performance.',
  'ml-prognosis': 'Statistische Prognose: Nachfrage, OEE, Risiko-Wahrscheinlichkeiten.',
  reports: 'Allokations-Performance und Compliance-Reporting.',
  'mass-jobs': 'Massen-Simulation oder -Ausführung im Hintergrund.',
  'what-if': 'Szenarien durchspielen: andere Reihenfolge oder Charge.',
  'time-planning': 'Zeitbasierte Planung, Kapazität, Gantt (Preview).',
  'rules-legacy': 'Gate-Regeln und Länder-Parameter (Legacy).',
  'agent-console': 'Agenten manuell starten, Briefing, Empfehlungs-Queue.',
  'allocation-copilot': 'Erklärt Allokationsentscheidungen (Regel-basiert).',
  'planning-copilot': 'Graph-aware Q&A zu Aufträgen, Chargen und Märkten.',
  'executive-cockpit': 'Management-KPIs, Risiko-Heatmap, Agenten-Empfehlungen.',
  autopilot: 'Alpha: automatisierter Planungsentwurf (Dry-Run).',
};

export const SYSTEM_SUMMARY = {
  title: 'Hard Allocation Platform',
  subtitle: 'Pharma-Planungsplattform für Chargen-Zuordnung',
  paragraphs: [
    'Die Plattform unterstützt Supply-Chain-Planer dabei, **Fertigware-Chargen** (Batches) auf **Verpackungsaufträge** zuzuordnen — unter Einhaltung von Markt-, Haltbarkeits- und Sequenzregeln.',
    'Ein Verpackungsauftrag ist über das Packing-System mit einem Sales Order verknüpft. Daraus ergeben sich Zielland, Menge und die anzuwendenden Regeln.',
    'Das System **empfiehlt** Chargen, **simuliert** Auswirkungen und **protokolliert** Entscheidungen. Die finale Freigabe liegt beim Planer (MVP — keine Live-SAP-Anbindung).',
  ],
};

export const PLANNER_PROCESS = {
  title: 'Prozessbeschreibung — Planer-Alltag',
  intro:
    'Der Werksplaner wandelt grobe Verpackungsaufträge aus dem Global Planning in einen **bestätigten Tagesplan** mit Sequenz, Chargen-Zuordnung und protokollierten Entscheidungen um. Der geführte Einstieg ist der **Tages-Wizard** — alle Schritte bauen aufeinander auf.',
  context: {
    title: 'Ausgangslage',
    items: [
      '**Global Planning** liefert grob geplante Verpackungsaufträge (Rough Planned Orders) mit Material, Menge, Zielland und Wunschtermin.',
      'Jeder Verpackungsauftrag ist über das **Packing-System** mit einem Sales Order verknüpft — daraus ergeben sich Markt, Kunde und anzuwendende Regeln.',
      'Der Planer erstellt den **detaillierten Werksplan**: Linien, Reihenfolge, Chargen und Hard Allocation — unter Compliance (Marktfreigabe, Haltbarkeit, Japan-Sequenz).',
    ],
  },
  principle:
    '**Human-in-the-loop:** KI-Agenten und Copilot **empfehlen** nur — simulieren und erklären. Jede Hard Allocation und jede Freigabe erfordert einen Planer (oder QA/Admin je nach Schritt). Kein Auto-Execute im MVP.',
  steps: [
    {
      step: 1,
      title: 'Lagebild & KI-Agenten',
      path: '/wizard',
      role: 'Planer, QA, Supply Chain, Admin',
      input: 'Offene Aufträge, Inventar, Digital Twin T+7, Predictions, Inspektionslose, Ausnahmen',
      activity:
        'Planning-, QA-, Supply-Chain- und Compliance-Agent analysieren den Tag. Morning Briefing mit KPIs. Empfehlungen prüfen und **freigeben oder ablehnen**.',
      output: 'Freigegebene Agenten-Empfehlungen, Lagebild (offene Aufträge, At Risk, Inventar-Risiken)',
      cockpit: 'Tages-Wizard → Schritt 1',
    },
    {
      step: 2,
      title: 'Tagesplan prüfen',
      path: '/daily-planning',
      role: 'Planer',
      input: 'Rough Planned Orders, Linienkalender, Kapazität',
      activity:
        'Daily Planning Dashboard öffnen: Gantt, Linienauslastung, KPIs und empfohlene Slots für den Planungstag prüfen. Abweichungen zum Global Plan erkennen.',
      output: 'Validierter Tagesplan als Basis für Sequencing',
      cockpit: 'Daily Planning Dashboard',
    },
    {
      step: 3,
      title: 'Reihenfolge festlegen',
      path: '/line-optimization',
      role: 'Planer',
      input: 'Tagesplan, Linienkapazität, Line Score (historische Performance Material×Linie)',
      activity:
        'Production Sequencing: Aufträge pro Verpackungslinie sortieren (Gantt, Drag & Drop). System schlägt optimierte Reihenfolge vor — What-if bei Änderungen. Sequenz speichern oder bestätigen.',
      output: 'Bestätigte oder gespeicherte Linien-Sequenz',
      cockpit: 'Production Sequencing / Line Optimization',
    },
    {
      step: 4,
      title: 'Chargen zuordnen',
      path: '/simulation',
      role: 'Planer',
      input: 'Sequenzierte Aufträge, Batch-Inventar, Länderregeln',
      activity:
        'Batch Recommendations: pro Auftrag prüfen, welche Charge **compliant** ist (Marktfreigabe/TRIC, RMSL/Haltbarkeit, FIFO, Japan-Sequenz). Simulation ausführen, Ergebnis und Regel-Trace lesen.',
      output: 'Simulierte Chargen-Empfehlungen pro Auftrag',
      cockpit: 'Batch Recommendations / Simulation',
    },
    {
      step: 5,
      title: 'Massen-Allokation',
      path: '/mass-jobs',
      role: 'Planer, Supply Chain, Admin',
      input: 'Alle offenen Verpackungsaufträge',
      activity:
        'Mass Allocation Job starten (täglich/wöchentlich): alle offenen Aufträge gesammelt simulieren oder ausführen. Fortschritt und Ergebnis pro Auftrag verfolgen.',
      output: 'Massen-Simulations- oder Allokationsergebnis mit Job-Historie',
      cockpit: 'Mass Allocation Jobs',
    },
    {
      step: 6,
      title: 'Plan freigeben',
      path: '/confirmed-assignments',
      role: 'Planer',
      input: 'Simulierte und bestätigte Zuordnungen',
      activity:
        'Confirmed Batch Assignments: finale Chargen-Zuordnungen und Zeitplan prüfen und **bestätigen**. Dies ist der verbindliche Werksplan.',
      output: 'Bestätigte Hard Allocations und Zeitplan',
      cockpit: 'Confirmed Batch Assignments',
    },
    {
      step: 7,
      title: 'Ausnahmen klären',
      path: '/exceptions',
      role: 'Planer, QA, Supply Chain',
      input: 'Offene Planning Exceptions (Marktfreigabe, Haltbarkeit, Inventar, Sequenz, …)',
      activity:
        'Blockierte Fälle in der Exception Queue bearbeiten: kommentieren, eskalieren, What-if anstoßen oder lösen. QA-Fälle ggf. an Qualität übergeben.',
      output: 'Gelöste oder eskalierte Ausnahmen',
      cockpit: 'Planning Exceptions 2.0',
    },
    {
      step: 8,
      title: 'Tagesabschluss & Audit',
      path: '/audit',
      role: 'Planer, QA, Viewer',
      input: 'Alle Tagesentscheidungen',
      activity:
        'Audit Trail: jede Simulation, Zuordnung und Regelentscheidung nachvollziehen. GMP-konforme Dokumentation für den Planungstag.',
      output: 'Protokollierter Tagesabschluss',
      cockpit: 'Audit Trail',
    },
  ],
};

export const AI_OVERVIEW = {
  title: 'KI & Intelligence — Wo ist die AI?',
  intro:
    'Mit konfiguriertem **OpenAI/Azure OpenAI API-Key** arbeiten die Agenten als **echte LLM-Agenten** mit **RAG-Lernen** aus Audit-Trail und Freigabe/Ablehnung. Ohne API-Key: regelbasierte Assistenten (Fallback).',
  dualMode:
    '**Zwei getrennte Wege:** Im Header wählen Sie **Regel-Agenten** (deterministisch, Standard) oder **LLM + RAG** (Hybrid-Anreicherung). **Copilot** ist jederzeit über den blauen Button erreichbar — unabhängig vom Agenten-Modus. Allocation Copilot (2.0) = Regeln; Planning Copilot (3.0) = LLM + Graph.',
  architecture:
    'Backend: `services/llm/` (llmClient, learningStore, llmAgentService), `agents/toolRegistry.js`, API `/api/v3/llm/status`, `/api/v3/llm/reindex`. Lernindex: `data/agentLearningIndex.json`.',
  modules: [
    {
      name: 'Tages-Wizard — Schritt 1 (Einstieg)',
      path: '/wizard',
      edition: '3.0',
      when: 'Jeden Morgen — Start des Planer-Alltags',
      what:
        'Vier KI-Agenten (Planung, Qualität, Supply Chain, Compliance) erzeugen Morning Briefing und Empfehlungen. Sie starten automatisch beim Öffnen des Wizards (wenn Rolle erlaubt).',
      agents: ['Planungs-Agent', 'Qualitäts-Agent', 'Supply-Chain-Agent', 'Compliance-Agent'],
    },
    {
      name: 'Agent Console',
      path: '/agents',
      edition: '3.0',
      when: 'Manueller Agenten-Lauf, Briefing, Empfehlungs-Queue',
      what:
        'Agenten manuell triggern (Daily, Manual, Order Blocked …), Morning Briefing abrufen, offene Empfehlungen freigeben oder ablehnen.',
      agents: null,
    },
    {
      name: 'Allocation Copilot',
      path: '/copilot',
      edition: '2.0',
      when: 'Fragen zu einer konkreten Allokation / blockiertem Auftrag',
      what:
        'Erklärt in Klartext: warum diese Charge, warum blockiert, Was passiert bei Verschiebung? — **nur interne Regel-Ergebnisse**, keine LLM-Cloud.',
      agents: null,
    },
    {
      name: 'Planning Copilot v3',
      path: '/copilot-v3',
      edition: '3.0',
      when: 'Erweiterte Fragen mit Graph- und Agent-Kontext',
      what:
        'Graph-aware Copilot: verknüpft Auftrag, Charge, Markt und Knowledge Graph. API: POST /api/v3/copilot/ask.',
      agents: null,
    },
    {
      name: 'Executive Cockpit',
      path: '/executive',
      edition: '3.0',
      when: 'Management-Übersicht, Risiko-Heatmap',
      what:
        'KPIs, Markt-Risiko-Heatmap, Agenten-Empfehlungen der letzten Läufe — zur Freigabe oder Übersicht.',
      agents: null,
    },
    {
      name: 'Planning Autopilot',
      path: '/autopilot',
      edition: '4.0 Alpha',
      when: 'Automatisierter Planungslauf (Dry-Run)',
      what:
        'Alpha: speichert Entwürfe für Sequenz und Chargen — **keine** Hard Allocation ohne Planer-Bestätigung.',
      agents: null,
    },
    {
      name: 'Predictive Risk & Digital Twin',
      path: '/executive',
      edition: '3.0',
      when: 'Hintergrund — speist Agenten und Dashboards',
      what:
        'Kein Chat-UI: T+7/30/90 Prognosen (RMSL, Expiry, Engpässe) und Allokations-Twin. API: GET /api/v3/predictions, /api/v3/twin/simulate.',
      agents: null,
    },
  ],
  agentsDetail: [
    {
      id: 'planning',
      role: 'Planung',
      task: 'Twin T+7, offene Aufträge, RMSL-Risiken — schlägt Umplanung oder alternative Charge vor.',
    },
    {
      id: 'qa',
      role: 'Qualität',
      task: 'Inspektionslose, QA-Freigaben — priorisiert Chargen die Aufträge blockieren.',
    },
    {
      id: 'supplyChain',
      role: 'Supply Chain',
      task: 'Inventar-Engpässe, Ablauf-Risiken, Markt-Transfers (z. B. CH→JP).',
    },
    {
      id: 'compliance',
      role: 'Compliance',
      task: 'Prognostizierte RMSL-Verletzungen, Sequenz- und Marktregeln.',
    },
  ],
  notAi: [
    'Batch Recommendations / Simulation — **Regel-Engine** (Compliance, FIFO, Optimization), kein LLM.',
    'What-If, Mass Allocation, Rule Management — klassische Engines, auditierbar.',
    'Line Score / historische Performance — statistische Kennzahlen aus JSON-Daten.',
  ],
  roadmap:
    'Konfiguration: `.env` mit OPENAI_API_KEY oder AZURE_OPENAI_*. Erst `POST /api/v3/llm/reindex`, dann Agenten starten. Status: `GET /api/v3/llm/status`. Siehe docs/llm-agents/README.md.',
};

export const ANALYTICS_OVERVIEW = {
  title: 'Analysen & Prognosen (Stand MVP)',
  intro:
    'Neben der operativen Planung stehen **regelbasierte Prognosen** und **historische Linien-Performance** zur Verfügung. Erweiterte ML-Analysen und Power-BI-Dashboards sind in Phase 4 der Roadmap vorgesehen.',
  available: [
    {
      name: 'Predictive RMSL & Expiry',
      status: 'Verfügbar (MVP 3)',
      detail:
        'Predictive Risk Engine prognostiziert für T+7 / T+30 / T+90: RMSL-Verletzungen, ablaufende Chargen, Markt-Engpässe und Kapazitäts-Engpässe. API: GET /api/v3/predictions. Genutzt von Agenten und Executive Cockpit.',
    },
    {
      name: 'Digital Supply Chain Twin',
      status: 'Verfügbar (MVP 3)',
      detail:
        'T+7-Allokationssimulation, At-Risk-Märkte und projizierte Erfolgsquote. API: GET /api/v3/twin/simulate.',
    },
    {
      name: 'ML-Prognose (statistisch)',
      status: 'Verfügbar (MVP 3.1)',
      detail:
        'Lineare Regression + Exponential Smoothing auf abgeschlossenen Aufträgen: Nachfrage, OEE pro Linie/Schicht, Risiko-Wahrscheinlichkeiten. API: GET /api/v3/ml/prognosis. Integriert in GET /api/v3/predictions.',
    },
    {
      name: 'Schicht-Historie',
      status: 'Verfügbar',
      detail:
        'Plan vs. Ist-Schicht (Früh/Spät), monatliche Zeitreihe pro Linie, OEE und Pünktlichkeit. API: GET /api/v1/performance/shift-history. UI: Leistungsgrad-Analyse.',
    },
    {
      name: 'Historische Linien-Performance',
      status: 'Verfügbar',
      detail:
        'Pro **Material × Linie**: OEE, Throughput, Reliability, Yield, Setup-Zeit → **Line Score** (0–100). Empfehlung der besten Linie für ein Material. API: GET /api/v1/performance/line-scores.',
    },
    {
      name: 'Leistungsfaktor (Linie)',
      status: 'Verfügbar',
      detail:
        'Manueller oder aus Historie abgeleiteter Faktor pro Linie. Schicht-spezifische Faktoren in Analytics (Material × Linie × Schicht). API: GET /api/v1/performance/line-factors.',
    },
  ],
  planned: [
    'Deep-Learning RMSL (Phase 4)',
    'Power BI / SAP Analytics Cloud Dashboards (Phase 4)',
    'Schicht-Faktor direkt in Sequenzierung (wenn geplanter Auftrag eine Schicht trägt)',
  ],
};

export const DAILY_WORKFLOW = [
  {
    step: 1,
    title: 'Lagebild & KI-Agenten',
    path: '/wizard',
    text: 'Agenten analysieren Aufträge, Inventar und Regeln — Empfehlungen freigeben oder ablehnen.',
  },
  {
    step: 2,
    title: 'Tagesplan prüfen',
    path: '/daily-planning',
    text: 'Daily Planning Dashboard: Gantt, Linien, KPIs und Auslastung für den Planungstag.',
  },
  {
    step: 3,
    title: 'Reihenfolge festlegen',
    path: '/line-optimization',
    text: 'Production Sequencing: Aufträge pro Linie sortieren, optimieren, What-if bei Änderungen.',
  },
  {
    step: 4,
    title: 'Chargen zuordnen',
    path: '/simulation',
    text: 'Batch Recommendations: compliant Charge pro Auftrag simulieren (Marktfreigabe, Haltbarkeit, FIFO).',
  },
  {
    step: 5,
    title: 'Massen-Allokation',
    path: '/mass-jobs',
    text: 'Alle offenen Aufträge gesammelt simulieren oder ausführen (Hintergrund-Job).',
  },
  {
    step: 6,
    title: 'Plan freigeben',
    path: '/confirmed-assignments',
    text: 'Confirmed Batch Assignments: finale Chargen-Zuordnungen und Zeitplan bestätigen.',
  },
  {
    step: 7,
    title: 'Ausnahmen klären',
    path: '/exceptions',
    text: 'Planning Exceptions: blockierte Fälle kommentieren, eskalieren oder lösen.',
  },
  {
    step: 8,
    title: 'Tagesabschluss & Audit',
    path: '/audit',
    text: 'Audit Trail: alle Entscheidungen des Tages nachvollziehen und dokumentieren.',
  },
];

export const NAV_SECTIONS = [
  {
    id: 'start',
    label: 'Start',
    defaultOpen: true,
    items: [
      { path: '/wizard', label: 'Daily Wizard', icon: 'Guide' },
      { path: '/help', label: 'Help & Overview', icon: 'QuestionFilled' },
    ],
  },
  {
    id: 'planning',
    label: 'Planning',
    defaultOpen: true,
    items: [
      { path: '/line-optimization', label: 'Production Sequencing', icon: 'Sort' },
      { path: '/simulation', label: 'Batch Recommendations', icon: 'CircleCheck' },
      { path: '/allocations', label: 'Allocations', icon: 'Connection' },
      { path: '/confirmed-assignments', label: 'Confirmed Assignments', icon: 'Finished' },
    ],
  },
  {
    id: 'monitoring',
    label: 'Monitoring',
    defaultOpen: true,
    items: [
      { path: '/control-tower', label: 'Control Tower', icon: 'Monitor' },
      { path: '/exceptions', label: 'Planning Exceptions', icon: 'Warning', permission: 'exceptions:read' },
      { path: '/inventory', label: 'Batch Inventory', icon: 'Box' },
    ],
  },
  {
    id: 'governance',
    label: 'Governance',
    defaultOpen: false,
    items: [
      { path: '/rule-management', label: 'Rule Management', icon: 'Setting', permission: 'rules:read' },
      { path: '/audit', label: 'Audit Trail', icon: 'Document' },
      { path: '/admin', label: 'Administration', icon: 'Tools' },
    ],
  },
];

export const PAGE_GUIDE = [
  {
    group: 'Start',
    pages: [
      { path: '/wizard', name: 'Tages-Wizard', purpose: 'Geführter Planer-Alltag von oben nach unten — inkl. KI-Agenten.' },
      { path: '/dashboard', name: 'Dashboard', purpose: 'KPIs und Schnellzugriff auf Empfehlungen und Massen-Simulation.' },
      { path: '/help', name: 'Hilfe & Überblick', purpose: 'Dokumentation aller Module und Begriffe.' },
    ],
  },
  {
    group: 'Tägliche Planung',
    pages: [
      { path: '/dashboard', name: 'Dashboard', purpose: 'KPIs und Schnellzugriff auf Empfehlungen und Massen-Simulation.' },
      { path: '/daily-planning', name: 'Daily Planning Dashboard', purpose: 'Tagesübersicht mit Gantt, Linienauslastung und Planungs-KPIs.' },
      { path: '/orders', name: "Today's Orders", purpose: 'Liste aller Verpackungsaufträge mit Status und Zielland.' },
      { path: '/line-optimization', name: 'Production Sequencing', purpose: 'Reihenfolge auf Verpackungslinien optimieren und speichern.' },
      { path: '/simulation', name: 'Batch Recommendations', purpose: 'Einzelauftrag simulieren: welche Charge passt, welche Regeln greifen.' },
      { path: '/confirmed-assignments', name: 'Confirmed Batch Assignments', purpose: 'Bestätigte Chargen-Zuordnungen und Zeitplan.' },
      { path: '/inventory', name: 'Batch Inventory', purpose: 'Verfügbare Chargen, Qualitätsstatus und Haltbarkeit.' },
    ],
  },
  {
    group: 'KI & Intelligence',
    pages: [
      { path: '/wizard', name: 'Tages-Wizard (Schritt 1)', purpose: 'KI-Agenten: Morning Briefing, Empfehlungen, Freigabe — Einstieg jeden Morgen.' },
      { path: '/agents', name: 'Agent Console', purpose: 'Agenten manuell starten, Briefing, Empfehlungs-Queue verwalten.' },
      { path: '/copilot', name: 'Allocation Copilot 2.0', purpose: 'Erklärt Allokationsentscheidungen (interne Regeln, kein LLM-Cloud).' },
      { path: '/copilot-v3', name: 'Planning Copilot v3', purpose: 'Graph-aware Q&A zu Aufträgen, Chargen und Märkten.' },
      { path: '/executive', name: 'Executive Cockpit', purpose: 'Management-KPIs, Risiko-Heatmap, Agenten-Empfehlungen.' },
      { path: '/autopilot', name: 'Planning Autopilot', purpose: 'Alpha: automatisierter Planungsentwurf (Dry-Run).' },
    ],
  },
  {
    group: 'Enterprise 2.0',
    pages: [
      { path: '/exceptions', name: 'Planning Exceptions', purpose: 'Warteschlange für blockierte Fälle (Marktfreigabe, Haltbarkeit, Inventar, Sequenz …).' },
      { path: '/mass-jobs', name: 'Mass Allocation', purpose: 'Tägliche/wöchentliche Massen-Simulation oder -Ausführung im Hintergrund.' },
      { path: '/rule-management', name: 'Rule Management', purpose: 'Versionierte Regeln pflegen (Land, Kunde, Produkt, Markt, Sequenz, RMSL, Split).' },
      { path: '/what-if', name: 'What-If Simulation', purpose: 'Szenarien durchspielen: andere Reihenfolge oder Charge — Auswirkung vergleichen.' },
    ],
  },
  {
    group: 'System',
    pages: [
      { path: '/audit', name: 'Audit Trail', purpose: 'Nachvollziehbare Historie aller Simulations- und Zuordnungsentscheidungen.' },
      { path: '/rules', name: 'Country Rules (Legacy)', purpose: 'Gate-Regeln (Checks, Priorität, Gültigkeit, API) und Länder-Parameter — Hilfe-Panel auf der Seite erklärt das Zusammenspiel.' },
      { path: '/admin', name: 'Administration', purpose: 'Datenquelle (Mock vs. API) und Integrations-Status.' },
    ],
  },
  {
    group: 'Erweitert (Preview)',
    pages: [
      { path: '/control-tower', name: 'Control Tower', purpose: 'Globale Supply-Chain-Übersicht (MVP 4.0).' },
      { path: '/planning', name: 'Time Planning', purpose: 'Zeitbasierte Planung, Kapazität, Gantt (MVP 5.0).' },
    ],
  },
];

export const ROLES_GUIDE = [
  { role: 'PLANNER', desc: 'Simulieren, ausführen, Massen-Jobs, Copilot, Ausnahmen kommentieren.' },
  { role: 'QA', desc: 'Ausnahmen prüfen und lösen, Audit einsehen.' },
  { role: 'SUPPLY_CHAIN', desc: 'Eskalieren, What-If, Massen-Jobs.' },
  { role: 'ADMIN', desc: 'Regeln schreiben, Benutzer verwalten, voller Zugriff.' },
  { role: 'VIEWER', desc: 'Nur Lesen — keine Simulation oder Änderungen.' },
];

export const GLOSSARY = [
  { term: 'Hard Allocation', def: 'Verbindliche Zuordnung einer Charge zu einem Verpackungsauftrag nach Regelprüfung.' },
  { term: 'Batch / Charge', def: 'Produzierte Fertigware-Partie mit Haltbarkeit, Qualitätsstatus und freigegebenen Märkten.' },
  { term: 'Packaging Order', def: 'Verpackungsauftrag — Make-to-Stock, verknüpft mit Sales Order über Packing.' },
  { term: 'Market Release (TRIC)', def: 'Marktfreigabe: Charge muss für das Zielland freigegeben sein.' },
  { term: 'Shelf-Life / RMSL', def: 'Resthaltbarkeit beim Verbrauch — muss Länderschwelle erfüllen.' },
  { term: 'FIFO', def: 'Älteste compliant Charge zuerst — nach allen Compliance-Prüfungen.' },
  { term: 'Japan Sequence', def: 'Fortlaufende Chargen-Sequenz für den Japan-Markt.' },
  { term: 'Risk Level', def: 'LOW / MEDIUM / HIGH — aus Chargen-Auswahl, Haltbarkeit, Inventar und Dringlichkeit.' },
  { term: 'Country Rules', def: 'Länder-Parameter pro Zielland (Split, Haltbarkeit, Marktfreigabe, Sequenz) — steuern, wie Gate-Regeln für dieses Land ausgewertet werden.' },
  { term: 'Rule Definitions', def: 'Gate-Checks (RULE-001 …) mit Reihenfolge, Active-Flag und Gültigkeitszeitraum — laufen in COMPLIANCE → AVAILABILITY → MARKET_RULES → PRODUCTION.' },
];

/** Inline help for /rules — Country Rules vs Planning Rule Definitions */
export const RULES_CONFIGURATION_HELP = {
  title: 'Hilfe: Regeln & Country Rules',
  intro:
    'Auf dieser Seite pflegen Sie zwei Ebenen: **Planning Rule Definitions** (welche Checks laufen, in welcher Reihenfolge, ab wann bis wann) und **Country Rules** (was für ein Zielland gilt). Beide zusammen steuern Simulate und Allocate im Dashboard.',
  flowchartTitle: 'So läuft Simulate / Allocate (Überblick)',
  flowchartCaption:
    'Beim Klick auf Simulate oder Allocate im Dashboard durchläuft jeder Auftrag diese Schritte. Country Rules liefern die Länder-Parameter; Rule Definitions bestimmen, welche Prüfungen in welcher Reihenfolge laufen.',
  flowchart: [
    { id: 'order', type: 'start', label: 'Verpackungsauftrag', detail: 'Zielland z. B. DE, Menge, Material' },
    { id: 'country', type: 'process', label: 'Country Rule laden', detail: 'Einstellungen für das Zielland (Split, Haltbarkeit, Marktfreigabe, Sequenz)' },
    {
      id: 'check-country',
      type: 'decision',
      label: 'Land konfiguriert & aktiv?',
      branches: [
        { outcome: 'no', label: 'Nein → Abbruch', targetLabel: 'Fehlgeschlagen (kein Land)', tone: 'danger' },
        { outcome: 'yes', label: 'Ja → weiter', targetLabel: 'Gate-Regeln', tone: 'success' },
      ],
    },
    { id: 'gates', type: 'process', label: 'Gate-Regeln prüfen', detail: 'Nur aktive Rule Definitions im Gültigkeitszeitraum' },
    { id: 'pipeline', type: 'pipeline', phases: ['Compliance', 'Verfügbarkeit (ATP)', 'Marktregeln'] },
    {
      id: 'gate-result',
      type: 'decision',
      label: 'Alle Gates bestanden?',
      branches: [
        { outcome: 'no', label: 'Nein → Abbruch', targetLabel: 'Fehlgeschlagen (Regel)', tone: 'danger' },
        { outcome: 'yes', label: 'Ja → weiter', targetLabel: 'Chargenwahl', tone: 'success' },
      ],
    },
    { id: 'selection', type: 'pipeline', phases: ['FIFO — älteste Charge', 'Optimization — Auswahl begründen'] },
    { id: 'success', type: 'end', label: 'Simuliert / Erfolg', detail: 'Charge empfohlen oder zugeordnet', tone: 'success' },
  ],
  layersDiagramTitle: 'Zwei Ebenen — wer steuert was?',
  layersDiagram: {
    countryRules: {
      title: 'Country Rules',
      subtitle: 'Untere Tabelle',
      items: ['Batch Split', 'Shelf-Life (Monate)', 'Market Release', 'Sequence'],
      feeds: ['RULE-002', 'RULE-003', 'RULE-004', 'RULE-005'],
    },
    ruleDefinitions: {
      title: 'Rule Definitions',
      subtitle: 'Obere Tabelle',
      items: ['Priorität & Active', 'Gültig von / bis', 'Gate-Typ (Compliance …)', 'Optionale API (SAP/REST)'],
    },
  },
  validityTimeline: {
    title: 'Zeitstrahl: Reihenfolge beim Simulate / Allocate',
    caption:
      'Die Engine arbeitet die Phasen nacheinander ab. Scheitert eine Gate-Regel, stoppt der Ablauf — FIFO und Chargenzuordnung werden nicht ausgeführt.',
    axisLabel: 'Zeitlicher Ablauf →',
    assignmentMarker: 'Chargenzuordnung ab hier',
    phases: [
      {
        key: 'COUNTRY',
        label: 'Country Rule',
        shortLabel: 'Land',
        tone: 'setup',
        hint: 'Länder-Parameter laden',
        rules: [],
      },
      {
        key: 'COMPLIANCE',
        label: 'Compliance Gate',
        shortLabel: 'Compliance',
        tone: 'gate',
        hint: 'Qualität, TRIC, RMSL, Split …',
        rules: ['RULE-007', 'RULE-008', 'RULE-009', 'RULE-001', 'RULE-002', 'RULE-003', 'RULE-004'],
      },
      {
        key: 'AVAILABILITY',
        label: 'Verfügbarkeit',
        shortLabel: 'ATP',
        tone: 'gate',
        hint: 'ATP & Reservierungen',
        rules: ['RULE-010', 'RULE-011'],
      },
      {
        key: 'MARKET_RULES',
        label: 'Marktregeln',
        shortLabel: 'Markt',
        tone: 'gate',
        hint: 'Sequenz (z. B. Japan)',
        rules: ['RULE-005'],
      },
      {
        key: 'PRODUCTION',
        label: 'Produktion / Gantt',
        shortLabel: 'Gantt',
        tone: 'gate',
        hint: 'Bestätigter Linien-Slot aus Linienplanung',
        rules: ['RULE-014'],
      },
      {
        key: 'FIFO',
        label: 'FIFO',
        shortLabel: 'FIFO',
        tone: 'assign',
        hint: 'Älteste compliant Charge',
        rules: ['RULE-006'],
      },
      {
        key: 'OPTIMIZATION',
        label: 'Optimization',
        shortLabel: 'Opt.',
        tone: 'assign',
        hint: 'Auswahl begründen',
        rules: ['RULE-012'],
      },
      {
        key: 'RESULT',
        label: 'Ergebnis',
        shortLabel: 'Done',
        tone: 'result',
        hint: 'Simuliert oder Erfolg',
        rules: [],
      },
    ],
  },
  validityTimeline: {
    title: 'Zeitstrahl: Gültigkeit von Rule Definitions',
    caption:
      'Beim Simulate / Allocate gilt das Referenzdatum **heute**. Regeln außerhalb von Valid from / Valid to werden übersprungen. Leere Felder = unbegrenzt gültig.',
    todayLabel: 'Heute (Referenzdatum)',
    legend: [
      { tone: 'active', label: 'Heute gültig' },
      { tone: 'future', label: 'Startet in der Zukunft' },
      { tone: 'expired', label: 'Abgelaufen' },
      { tone: 'open', label: 'Unbegrenzt (kein Von/Bis)' },
    ],
  },
  layers: [
    {
      name: 'Planning Rule Definitions',
      where: 'Obere Tabelle auf dieser Seite',
      role: 'Gate-Checks (RULE-001 …), Priorität, Active, Gültigkeit von/bis, optionale SAP/REST-Integration',
    },
    {
      name: 'Country Rules',
      where: 'Untere Tabelle auf dieser Seite',
      role: 'Länder-Parameter pro destinationCountry — keine eigenen Checks, sondern Eingaben für mehrere Gate-Regeln',
    },
  ],
  flow: [
    'Auftrag mit Zielland (z. B. DE) → Engine sucht passende Country Rule.',
    'Fehlt das Land oder ist inactive → Allokation bricht ab.',
    'Sonst: Gate-Pipeline COMPLIANCE → AVAILABILITY → MARKET_RULES → PRODUCTION → FIFO → OPTIMIZATION.',
    'Referenzdatum für Gültigkeit der Rule Definitions: **heute** (Serverzeit beim Simulate/Allocate).',
  ],
  countryMapping: [
    { field: 'Market Release (requiresTric)', rule: 'RULE-002', effect: 'false → Check übersprungen; true → Charge muss für Zielland freigegeben sein' },
    { field: 'Shelf-Life / RMSL (Monate)', rule: 'RULE-003', effect: 'Mindest-Resthaltbarkeit für dieses Land' },
    { field: 'Batch Split', rule: 'RULE-004', effect: 'false → nur Ein-Charge-Zuordnung (Menge prüft ATP)' },
    { field: 'Sequence', rule: 'RULE-005', effect: 'true → fortlaufende Chargen-Sequenz (typisch Japan)' },
  ],
  globalRules: [
    'RULE-007 … 009, 001 — Qualität, Packing-Mapping, Inspektionslos (unabhängig vom Land)',
    'RULE-010, 011 — ATP und Reservierungen',
    'RULE-014 — Bestätigter Gantt-Slot (Linie, Start/Ende) aus optimizedSchedule — Brücke Linienplanung ↔ Allokation',
    'RULE-006, 012 — FIFO und Optimization (nach allen Gates)',
  ],
  validity: [
    '**Rule Definitions:** Valid from / Valid to wird bei Allokation berücksichtigt (leer = unbegrenzt).',
    '**Country Rules (diese Seite):** kein Von/Bis — gelten solange Active = Yes.',
    '**Rule Management 2.0** (/rule-management): versionierte Enterprise-Regeln können Country Rules überlagern (effectiveFrom/effectiveTo).',
  ],
  editHints: [
    'Neue Gate-Regel: Button **New Rule** — Integration optional über **API** → data/rule-integrations/&lt;ruleId&gt;.json',
    'Enterprise-Governance mit Versionierung: **Rule Management** unter Enterprise (2.0) in der Sidebar',
  ],
  solverStrategy: {
    title: 'Langfristig: OR-Tools Solver (500+ Aufträge/Tag)',
    intro:
      'Ab ~80 Aufträgen/Tag ist der **OR-Tools CP-SAT Sidecar** (lokal, Port 8010) der Produktions-Solver — keine Google-Cloud-API.',
    pipeline: [
      '① Constraint pipeline — executable checks (ATP/TRIC/RMSL) filter blocked orders',
      '② Payload-Enrichment — Dauer aus Durchsatz × OEE × Yield × Leistungsfaktor; Line Score pro Material×Linie',
      '③ OR-Tools — Linienzuordnung, No-Overlap (Kapazität), Minimize Verspätung + niedrige Line Scores',
      '④ Gantt bestätigen → RULE-014 (Production Gate) → Mass Simulate/Allocate (übrige Regeln + Charge final)',
    ],
    envKeys: [
      'SCHEDULING_OPTIMIZER=ortools',
      'ORTOOLS_MAX_TIME_SECONDS=180',
      'SCHEDULING_HORIZON_DAYS=14',
      'ORTOOLS_REQUIRED=true (Produktion)',
    ],
  },
};

export const TECH_HINTS = [
  'UI: http://localhost:3001 (Cockpit) — API: http://localhost:8000/api/v1',
  'Swagger-Dokumentation: http://localhost:8000/docs',
  'Demo-Benutzer im Header umschalten (planner, qa, supplychain, admin, viewer).',
  'Mock-Daten: standardmäßig aktiv — in Administration oder per VITE_USE_MOCK=false auf Live-API umstellen.',
];
