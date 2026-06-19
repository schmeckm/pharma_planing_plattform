/** Tages-Wizard — sprechende, kurze Texte (Sie-Ansprache). */
import { PLANNING_ANCHOR, formatPlanningDate } from './planningAnchor';
import { getWizardAgents } from '@/i18n/agent';

export { PLANNING_ANCHOR, formatPlanningDate, getWizardAgents };

/** @deprecated Use getWizardAgents(locale) from @/i18n/agent */
export const WIZARD_AGENTS = getWizardAgents('de');
export const DAILY_WIZARD_STEPS = [
  {
    id: 'agents',
    speakingTitle: 'Lagebild & Empfehlungen',
    title: '1. Lagebild',
    subtitle: 'Assistenten-Analyse',
    description: 'Ich fasse Aufträge, Inventar und Regeln zusammen — Sie entscheiden.',
    path: null,
    primaryAction: 'Analyse starten',
    primaryActionDone: 'Weiter zum Tagesplan',
    autoRun: true,
  },
  {
    id: 'daily-plan',
    speakingTitle: 'Tagesplan prüfen',
    title: '2. Tagesplan',
    subtitle: 'Linien & Gantt',
    description: 'So sieht Ihr Planungstag auf den Verpackungslinien aus.',
    path: '/daily-planning',
    primaryAction: 'Tagesplan öffnen',
  },
  {
    id: 'sequencing',
    speakingTitle: 'Reihenfolge festlegen',
    title: '3. Reihenfolge',
    subtitle: 'Production Sequencing',
    description: 'Reihenfolge anpassen — ich schlage die schnellste Variante vor.',
    path: '/line-optimization',
    primaryAction: 'Sequencing öffnen',
  },
  {
    id: 'simulation',
    speakingTitle: 'Chargen zuordnen',
    title: '4. Chargen',
    subtitle: 'Batch Recommendations',
    description: 'Welche Charge passt? Ich zeige compliant Chargen pro Auftrag.',
    path: '/simulation',
    primaryAction: 'Chargen prüfen',
  },
  {
    id: 'mass',
    speakingTitle: 'Massen-Allokation',
    title: '5. Massenlauf',
    subtitle: 'Mass Allocation',
    description: 'Alle offenen Aufträge auf einmal — simulieren oder ausführen.',
    path: '/mass-jobs',
    primaryAction: 'Massenlauf starten',
    permission: 'jobs:read',
  },
  {
    id: 'confirm',
    speakingTitle: 'Plan freigeben',
    title: '6. Freigabe',
    subtitle: 'Confirmed Assignments',
    description: 'Das ist final geplant — bitte Zuordnungen bestätigen.',
    path: '/confirmed-assignments',
    primaryAction: 'Freigabe prüfen',
  },
  {
    id: 'impact',
    speakingTitle: 'Planungsbeitrag dokumentieren',
    title: '7. Beitrag',
    subtitle: 'MRP Impact Event',
    description: 'Before/After festhalten — was hat die Planungsorganisation heute verbessert?',
    path: null,
    primaryAction: 'Beitrag speichern',
  },
  {
    id: 'exceptions',
    speakingTitle: 'Ausnahmen klären',
    title: '8. Ausnahmen',
    subtitle: 'Planning Exceptions',
    description: 'Blockierte Fälle kommentieren, eskalieren oder lösen.',
    path: '/exceptions',
    primaryAction: 'Ausnahmen bearbeiten',
    permission: 'exceptions:read',
  },
  {
    id: 'audit',
    speakingTitle: 'Tagesabschluss',
    title: '9. Abschluss',
    subtitle: 'Audit Trail',
    description: 'Alle Entscheidungen sind protokolliert — Tag abschließen.',
    path: '/audit',
    primaryAction: 'Protokoll öffnen',
  },
];

/**
 * Kurzer, sprechender Hinweis — nutzt Live-Daten wenn vorhanden.
 */
export function dynamicHint(stepId, ctx = {}) {
  const planDate = formatPlanningDate(ctx.planningDate || PLANNING_ANCHOR);

  switch (stepId) {
    case 'agents': {
      const s = ctx.briefing?.summary;
      const sched = s?.scheduling;
      if (sched?.solverStatus) {
        const blocked = sched.blocked ?? 0;
        return blocked > 0
          ? `Solver ${sched.solverStatus} — ${blocked} Auftrag/Aufträge durch Constraints blockiert.`
          : `Solver ${sched.solverStatus} — Plan ${sched.eligible ?? '—'} Aufträge eligible.`;
      }
      if (s) {
        const risk = s.ordersAtRisk ?? 0;
        return risk > 0
          ? `${s.openOrders ?? '—'} Aufträge geprüft — ${risk} brauchen Ihre Aufmerksamkeit.`
          : `${s.openOrders ?? '—'} Aufträge geprüft — alles im grünen Bereich.`;
      }
      return 'Ich analysiere Aufträge, Inventar und Regeln für Sie.';
    }
    case 'daily-plan':
      if (ctx.dashboardKpis) {
        const k = ctx.dashboardKpis;
        return `Planung ab ${planDate}: ${k.openOrders ?? '—'} Aufträge, Auslastung ${k.peakUtilization ?? '—'} %.`;
      }
      return `Ihr Tagesplan ab ${planDate} — Linien, Gantt und KPIs.`;
    case 'sequencing':
      if (ctx.degradedLines?.length) {
        return `Reihenfolge optimieren — ${ctx.degradedLines.length} Linie(n) mit reduziertem Leistungsfaktor.`;
      }
      return 'Reihenfolge auf den Linien festlegen und speichern.';
    case 'simulation':
      return ctx.openOrders != null
        ? `${ctx.openOrders} offene Aufträge warten auf eine Chargen-Empfehlung.`
        : 'Pro Auftrag die passende Charge finden.';
    case 'mass':
      return 'Sammellauf für alle offenen Verpackungsaufträge.';
    case 'confirm':
      return ctx.confirmedCount != null
        ? `${ctx.confirmedCount} Zuordnungen im bestätigten Plan.`
        : 'Bestätigte Chargen und Zeitplan freigeben.';
    case 'impact':
      if (ctx.executability) {
        return `${ctx.executability.executableRate}% ausführbar — dokumentieren Sie Ihren Beitrag (Before/After).`;
      }
      return 'Planungsbeitrag für MRP und BPM festhalten.';
    case 'exceptions':
      return ctx.exceptionCount != null && ctx.exceptionCount > 0
        ? `${ctx.exceptionCount} Ausnahme(n) warten auf Sie.`
        : 'Keine offenen Ausnahmen — oder Sie prüfen dennoch.';
    case 'audit':
      return 'Tagesabschluss: jede Entscheidung ist nachvollziehbar dokumentiert.';
    default:
      return '';
  }
}

export function speakingProgress(stepIndex, total, step) {
  const title = step?.speakingTitle || step?.title || '';
  return `Schritt ${stepIndex + 1} von ${total} — ${title}`;
}

export function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function loadWizardProgress() {
  try {
    const raw = localStorage.getItem(`hap_wizard_${todayKey()}`);
    return raw ? JSON.parse(raw) : { step: 0, completed: [] };
  } catch {
    return { step: 0, completed: [] };
  }
}

export function saveWizardProgress(progress) {
  localStorage.setItem(`hap_wizard_${todayKey()}`, JSON.stringify(progress));
}

export function markWizardStepComplete(stepId) {
  const saved = loadWizardProgress();
  if (!saved.completed.includes(stepId)) saved.completed.push(stepId);
  saveWizardProgress(saved);
  return saved;
}
