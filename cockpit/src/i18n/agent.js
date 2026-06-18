export const SUPPORTED_LOCALES = [
  { code: 'en', label: 'English', flag: 'EN' },
  { code: 'de', label: 'Deutsch', flag: 'DE' },
  { code: 'fr', label: 'Français', flag: 'FR' },
];

const MESSAGES = {
  en: {
    panelTitle: 'AI Agents (Agentic AI)',
    advisorDefault: 'All recommendations require human approval — no auto-execute.',
    status: {
      IDLE: 'Ready',
      RUNNING: 'Running',
      COMPLETED: 'Done',
      FAILED: 'Error',
      DISABLED: 'Off',
    },
    orchestrator: {
      RUNNING: 'Running…',
      COMPLETED: 'Completed',
      DISABLED: 'Disabled',
      READY: 'Ready',
    },
    recCount: '{count} recommendation(s)',
    kpis: {
      openOrders: 'Open orders',
      allocatable: 'Allocatable',
      atRisk: 'At risk',
      inventoryRisks: 'Inventory risks',
      japanSequence: 'JP sequence',
      qaPending: 'QA pending',
    },
    table: {
      agent: 'Agent',
      order: 'Order',
      recommendation: 'Recommendation',
      priority: 'Priority',
      action: 'Action',
    },
    agents: {
      planning: {
        name: 'Planning Assistant',
        label: 'Planning',
        desc: 'I check which orders can start today.',
      },
      qa: {
        name: 'Quality Assistant',
        label: 'Quality',
        desc: 'I report batches awaiting release.',
      },
      supplyChain: {
        name: 'Supply Chain Assistant',
        label: 'Supply Chain',
        desc: 'I warn about bottlenecks and low shelf-life.',
      },
      compliance: {
        name: 'Compliance Assistant',
        label: 'Compliance',
        desc: 'I ensure market release and sequence rules are met.',
      },
    },
    wizard: {
      runAgents: 'Start agents',
      stepDone: 'Step complete',
      back: 'Back',
      next: 'Next',
      agentsDone: 'Agents completed',
      agentsFailed: 'Agents failed',
      noPermission: 'No permission',
      approved: 'Recommendation approved',
      dismissed: 'Recommendation dismissed',
    },
    header: {
      language: 'Language',
    },
  },
  de: {
    panelTitle: 'KI-Agenten (Agentic AI)',
    advisorDefault: 'Alle Empfehlungen erfordern menschliche Freigabe — kein Auto-Execute.',
    status: {
      IDLE: 'Bereit',
      RUNNING: 'Läuft',
      COMPLETED: 'Fertig',
      FAILED: 'Fehler',
      DISABLED: 'Aus',
    },
    orchestrator: {
      RUNNING: 'Läuft…',
      COMPLETED: 'Abgeschlossen',
      DISABLED: 'Deaktiviert',
      READY: 'Bereit',
    },
    recCount: '{count} Empfehlung(en)',
    kpis: {
      openOrders: 'Offene Aufträge',
      allocatable: 'Allokierbar',
      atRisk: 'At Risk',
      inventoryRisks: 'Inventar-Risiken',
      japanSequence: 'Sequenz JP',
      qaPending: 'QA offen',
    },
    table: {
      agent: 'Agent',
      order: 'Auftrag',
      recommendation: 'Empfehlung',
      priority: 'Priorität',
      action: 'Aktion',
    },
    agents: {
      planning: {
        name: 'Planungs-Assistent',
        label: 'Planung',
        desc: 'Ich prüfe, welche Aufträge heute starten können.',
      },
      qa: {
        name: 'Qualitäts-Assistent',
        label: 'Qualität',
        desc: 'Ich melde Chargen, die noch auf Freigabe warten.',
      },
      supplyChain: {
        name: 'Supply-Chain-Assistent',
        label: 'Supply Chain',
        desc: 'Ich warne vor Engpässen und knapper Haltbarkeit.',
      },
      compliance: {
        name: 'Compliance-Assistent',
        label: 'Compliance',
        desc: 'Ich stelle sicher: Marktfreigabe und Sequenzregeln passen.',
      },
    },
    wizard: {
      runAgents: 'Agenten starten',
      stepDone: 'Schritt erledigt',
      back: 'Zurück',
      next: 'Weiter',
      agentsDone: 'Agenten abgeschlossen',
      agentsFailed: 'Agenten fehlgeschlagen',
      noPermission: 'Keine Berechtigung',
      approved: 'Empfehlung freigegeben',
      dismissed: 'Empfehlung abgelehnt',
    },
    header: {
      language: 'Sprache',
    },
  },
  fr: {
    panelTitle: 'Agents IA (Agentic AI)',
    advisorDefault: 'Toutes les recommandations nécessitent une approbation humaine — pas d\'exécution automatique.',
    status: {
      IDLE: 'Prêt',
      RUNNING: 'En cours',
      COMPLETED: 'Terminé',
      FAILED: 'Erreur',
      DISABLED: 'Désactivé',
    },
    orchestrator: {
      RUNNING: 'En cours…',
      COMPLETED: 'Terminé',
      DISABLED: 'Désactivé',
      READY: 'Prêt',
    },
    recCount: '{count} recommandation(s)',
    kpis: {
      openOrders: 'Ordres ouverts',
      allocatable: 'Allouables',
      atRisk: 'À risque',
      inventoryRisks: 'Risques inventaire',
      japanSequence: 'Séquence JP',
      qaPending: 'QA en attente',
    },
    table: {
      agent: 'Agent',
      order: 'Ordre',
      recommendation: 'Recommandation',
      priority: 'Priorité',
      action: 'Action',
    },
    agents: {
      planning: {
        name: 'Assistant Planification',
        label: 'Planification',
        desc: 'Je vérifie quels ordres peuvent démarrer aujourd\'hui.',
      },
      qa: {
        name: 'Assistant Qualité',
        label: 'Qualité',
        desc: 'Je signale les lots en attente de libération.',
      },
      supplyChain: {
        name: 'Assistant Supply Chain',
        label: 'Supply Chain',
        desc: 'J\'alerte sur les goulots et la durabilité limitée.',
      },
      compliance: {
        name: 'Assistant Conformité',
        label: 'Conformité',
        desc: 'Je garantis la conformité marché et séquence.',
      },
    },
    wizard: {
      runAgents: 'Démarrer les agents',
      stepDone: 'Étape terminée',
      back: 'Retour',
      next: 'Suivant',
      agentsDone: 'Agents terminés',
      agentsFailed: 'Échec des agents',
      noPermission: 'Permission refusée',
      approved: 'Recommandation approuvée',
      dismissed: 'Recommandation rejetée',
    },
    header: {
      language: 'Langue',
    },
  },
};

export function getAgentMessages(locale) {
  return MESSAGES[locale] || MESSAGES.en;
}

export function tAgent(locale, path, params = {}) {
  const parts = path.split('.');
  let node = getAgentMessages(locale);
  for (const part of parts) {
    node = node?.[part];
    if (node == null) {
      let fallback = MESSAGES.en;
      for (const p of parts) fallback = fallback?.[p];
      if (typeof fallback !== 'string') return path;
      node = fallback;
      break;
    }
  }
  if (typeof node !== 'string') return path;
  return node.replace(/\{(\w+)\}/g, (_, key) => (params[key] != null ? String(params[key]) : ''));
}

export function getWizardAgents(locale) {
  const ids = ['planning', 'qa', 'supplyChain', 'compliance'];
  const icons = {
    planning: 'Calendar',
    qa: 'CircleCheck',
    supplyChain: 'Box',
    compliance: 'Document',
  };
  return ids.map((id) => ({
    id,
    icon: icons[id],
    name: tAgent(locale, `agents.${id}.name`),
    label: tAgent(locale, `agents.${id}.label`),
    desc: tAgent(locale, `agents.${id}.desc`),
  }));
}

export function localeDateFormat(locale) {
  return { en: 'en-GB', de: 'de-DE', fr: 'fr-FR' }[locale] || 'en-GB';
}
