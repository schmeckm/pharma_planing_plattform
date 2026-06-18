const SUPPORTED = ['en', 'de', 'fr'];

const MESSAGES = {
  en: {
    advisorNote: {
      default: 'All recommendations require human planner approval before execution.',
      planning: 'AI recommendations only — planner retains final approval.',
      copilot: 'Explanation only — planner retains final approval.',
      executive: 'AI-assisted insights — human planner approves all actions.',
    },
    agentNames: {
      'planning-agent': 'Planning Agent',
      'qa-agent': 'QA Agent',
      'supply-chain-agent': 'Supply Chain Agent',
      'compliance-agent': 'Compliance Agent',
    },
    agentLabels: {
      planning: 'Planning',
      qa: 'Quality',
      supplyChain: 'Supply Chain',
      compliance: 'Compliance',
    },
    dailySummaryLabel: 'Daily Planning Summary',
    dataSources: {
      packagingOrders: 'Packaging Orders',
      inventory: 'Inventory / Batches',
      qualityStock: 'Quality Stock',
      inspectionLots: 'Inspection Lots ({count})',
      lineCalendars: 'Line Calendars',
      linePerformance: 'Historical Performance ({count} records)',
      digitalTwin: 'Digital Twin T+7',
      scheduling: 'Schedule ({engine}, {status})',
    },
    lineScoreReason: 'Highest weighted line performance score',
    planning: {
      constraintBlocked: 'Review order {orderId}: blocked by scheduling constraints',
      constraintBlockedRationale: 'Constraint gate failed: {reasons}',
      constraintBlockedImpact: 'Unblocks line assignment after QA/compliance resolution',
      reviewOrder:
        'Review order {orderId}: projected shelf-life risk for {country}. Consider +2 days or alternate batch.',
      twinFailure:
        'T+{horizon} twin shows allocation failure. Projected shelf-life: {rmsl} months.',
      impactDelivery: 'May improve on-time delivery for {country}',
      whatIfDelay: 'Run What-If with +2 day delay or request batch with higher shelf-life',
      impactRmsl: 'Reduces shelf-life compliance risk at delivery',
    },
    qa: {
      expectedRelease: 'Expected release: {date}',
      expectedReleasePending: 'Expected release: pending QA assessment',
      prioritizeRelease: 'Prioritize QA release for inspection lot {lotId} (batch {batchId})',
      allocationsWaiting: '{count} allocation(s) waiting.',
      releaseUnblocks: 'Release may unblock packaging orders.',
      impactUnblockOrder: 'Will unblock order {orderId}',
      impactInventory: 'Improves allocatable inventory',
      reviewQuality: 'Review quality status and inspection lot for release decision',
      impactPath: 'Unblocks allocation path for {orderId}',
    },
    supplyChain: {
      evaluateTransfer:
        'Evaluate inventory transfer to support {country} ({count} at-risk orders)',
      marketRisk:
        'Market {country} at {riskLevel} risk in T+{horizon} twin projection',
      impactAtp: 'Improves ATP coverage for {orderCount} packaging order(s)',
      transferUnits: 'Transfer {qty} units from Switzerland to Japan market',
      jpShortage:
        'Japan inventory shortage expected within 14 days. Forecast {forecast} EA vs available {available} EA.',
      impactJp: 'Reduces Japan market stock-out risk and supports sequence compliance',
      prioritizeBatch:
        'Prioritize allocation of batch {batchId} before expiry ({months} mo shelf-life)',
      expiryRisk: 'Inventory expiry risk — allocate or transfer before write-off',
      impactOrder: 'Supports order {orderId}',
      impactExposure: 'Reduces inventory exposure',
    },
    compliance: {
      rmslAlert:
        'RMSL compliance violation predicted in 7 days for {country}. Threshold: {threshold} months.',
      predictiveForecast: 'Predictive Risk Engine forecast',
    },
  },
  de: {
    advisorNote: {
      default: 'Alle Empfehlungen erfordern die Freigabe durch einen Planer — kein Auto-Execute.',
      planning: 'KI-Empfehlungen — der Planer trifft die finale Entscheidung.',
      copilot: 'Nur Erklärung — der Planer trifft die finale Entscheidung.',
      executive: 'KI-gestützte Einblicke — alle Aktionen werden vom Planer freigegeben.',
    },
    agentNames: {
      'planning-agent': 'Planungs-Agent',
      'qa-agent': 'Qualitäts-Agent',
      'supply-chain-agent': 'Supply-Chain-Agent',
      'compliance-agent': 'Compliance-Agent',
    },
    agentLabels: {
      planning: 'Planung',
      qa: 'Qualität',
      supplyChain: 'Supply Chain',
      compliance: 'Compliance',
    },
    dailySummaryLabel: 'Tägliche Planungsübersicht',
    dataSources: {
      packagingOrders: 'Verpackungsaufträge',
      inventory: 'Inventar / Chargen',
      qualityStock: 'Qualitätsbestand',
      inspectionLots: 'Inspektionslose ({count})',
      lineCalendars: 'Linienkalender',
      linePerformance: 'Historische Leistung ({count} Datensätze)',
      digitalTwin: 'Digital Twin T+7',
      scheduling: 'Planung ({engine}, {status})',
    },
    lineScoreReason: 'Höchster gewichteter Linien-Leistungsscore',
    planning: {
      constraintBlocked: 'Auftrag {orderId} prüfen: durch Planungs-Constraints blockiert',
      constraintBlockedRationale: 'Constraint-Gate fehlgeschlagen: {reasons}',
      constraintBlockedImpact: 'Linienzuordnung nach QA/Compliance-Lösung möglich',
      reviewOrder:
        'Auftrag {orderId} prüfen: prognostiziertes Haltbarkeitsrisiko für {country}. +2 Tage oder alternative Charge erwägen.',
      twinFailure:
        'T+{horizon} Twin zeigt Allokationsfehler. Prognostizierte Resthaltbarkeit: {rmsl} Monate.',
      impactDelivery: 'Kann pünktliche Lieferung für {country} verbessern',
      whatIfDelay: 'What-If mit +2 Tagen Verzögerung oder Charge mit höherer Haltbarkeit anfordern',
      impactRmsl: 'Reduziert Haltbarkeits-Compliance-Risiko bei Lieferung',
    },
    qa: {
      expectedRelease: 'Erwartete Freigabe: {date}',
      expectedReleasePending: 'Erwartete Freigabe: QA-Bewertung ausstehend',
      prioritizeRelease: 'QA-Freigabe für Inspektionslos {lotId} (Charge {batchId}) priorisieren',
      allocationsWaiting: '{count} Allokation(en) warten.',
      releaseUnblocks: 'Freigabe kann Verpackungsaufträge freischalten.',
      impactUnblockOrder: 'Schaltet Auftrag {orderId} frei',
      impactInventory: 'Verbessert verfügbares Inventar',
      reviewQuality: 'Qualitätsstatus und Inspektionslos für Freigabeentscheidung prüfen',
      impactPath: 'Schaltet Allokationspfad für {orderId} frei',
    },
    supplyChain: {
      evaluateTransfer:
        'Inventartransfer prüfen zur Unterstützung von {country} ({count} Aufträge mit Risiko)',
      marketRisk:
        'Markt {country} mit {riskLevel}-Risiko in T+{horizon} Twin-Projektion',
      impactAtp: 'Verbessert ATP-Abdeckung für {orderCount} Verpackungsauftrag/Aufträge',
      transferUnits: '{qty} Einheiten von der Schweiz nach Japan transferieren',
      jpShortage:
        'Japan-Inventar-Engpass innerhalb von 14 Tagen erwartet. Prognose {forecast} EA vs. verfügbar {available} EA.',
      impactJp: 'Reduziert Japan-Lagerbestandsrisiko und unterstützt Sequenz-Compliance',
      prioritizeBatch:
        'Allokation der Charge {batchId} vor Ablauf priorisieren ({months} Mon. Haltbarkeit)',
      expiryRisk: 'Ablaufrisiko — vor Abschreibung allokieren oder transferieren',
      impactOrder: 'Unterstützt Auftrag {orderId}',
      impactExposure: 'Reduziert Inventar-Exposure',
    },
    compliance: {
      rmslAlert:
        'RMSL-Compliance-Verletzung in 7 Tagen für {country} prognostiziert. Schwellwert: {threshold} Monate.',
      predictiveForecast: 'Prognose der Predictive-Risk-Engine',
    },
  },
  fr: {
    advisorNote: {
      default: 'Toutes les recommandations nécessitent l\'approbation d\'un planificateur — pas d\'exécution automatique.',
      planning: 'Recommandations IA — le planificateur conserve la décision finale.',
      copilot: 'Explication uniquement — le planificateur conserve la décision finale.',
      executive: 'Analyses assistées par IA — le planificateur approuve toutes les actions.',
    },
    agentNames: {
      'planning-agent': 'Agent Planification',
      'qa-agent': 'Agent Qualité',
      'supply-chain-agent': 'Agent Supply Chain',
      'compliance-agent': 'Agent Conformité',
    },
    agentLabels: {
      planning: 'Planification',
      qa: 'Qualité',
      supplyChain: 'Supply Chain',
      compliance: 'Conformité',
    },
    dailySummaryLabel: 'Synthèse de planification quotidienne',
    dataSources: {
      packagingOrders: 'Ordres de conditionnement',
      inventory: 'Inventaire / Lots',
      qualityStock: 'Stock qualité',
      inspectionLots: 'Lots d\'inspection ({count})',
      lineCalendars: 'Calendriers de ligne',
      linePerformance: 'Performance historique ({count} enregistrements)',
      digitalTwin: 'Digital Twin T+7',
      scheduling: 'Planification ({engine}, {status})',
    },
    lineScoreReason: 'Score de performance de ligne pondéré le plus élevé',
    planning: {
      constraintBlocked: 'Examiner l\'ordre {orderId} : bloqué par les contraintes de planification',
      constraintBlockedRationale: 'Échec du contrôle de contraintes : {reasons}',
      constraintBlockedImpact: 'Débloque l\'affectation ligne après résolution QA/conformité',
      reviewOrder:
        'Examiner l\'ordre {orderId} : risque de durabilité projeté pour {country}. Envisager +2 jours ou lot alternatif.',
      twinFailure:
        'Le jumeau T+{horizon} indique un échec d\'allocation. Durabilité projetée : {rmsl} mois.',
      impactDelivery: 'Peut améliorer la livraison à temps pour {country}',
      whatIfDelay: 'Lancer What-If avec +2 jours de délai ou demander un lot à durabilité supérieure',
      impactRmsl: 'Réduit le risque de conformité durabilité à la livraison',
    },
    qa: {
      expectedRelease: 'Libération prévue : {date}',
      expectedReleasePending: 'Libération prévue : évaluation QA en attente',
      prioritizeRelease: 'Prioriser la libération QA pour le lot d\'inspection {lotId} (lot {batchId})',
      allocationsWaiting: '{count} allocation(s) en attente.',
      releaseUnblocks: 'La libération peut débloquer les ordres de conditionnement.',
      impactUnblockOrder: 'Débloquera l\'ordre {orderId}',
      impactInventory: 'Améliore l\'inventaire allouable',
      reviewQuality: 'Examiner le statut qualité et le lot d\'inspection pour décision de libération',
      impactPath: 'Débloque le chemin d\'allocation pour {orderId}',
    },
    supplyChain: {
      evaluateTransfer:
        'Évaluer le transfert d\'inventaire pour soutenir {country} ({count} ordres à risque)',
      marketRisk:
        'Marché {country} à risque {riskLevel} dans la projection jumeau T+{horizon}',
      impactAtp: 'Améliore la couverture ATP pour {orderCount} ordre(s) de conditionnement',
      transferUnits: 'Transférer {qty} unités de la Suisse vers le marché japonais',
      jpShortage:
        'Pénurie d\'inventaire Japon attendue sous 14 jours. Prévision {forecast} EA vs disponible {available} EA.',
      impactJp: 'Réduit le risque de rupture Japon et soutient la conformité séquence',
      prioritizeBatch:
        'Prioriser l\'allocation du lot {batchId} avant expiration ({months} mois de durabilité)',
      expiryRisk: 'Risque d\'expiration — allouer ou transférer avant mise au rebut',
      impactOrder: 'Soutient l\'ordre {orderId}',
      impactExposure: 'Réduit l\'exposition inventaire',
    },
    compliance: {
      rmslAlert:
        'Violation RMSL prévue sous 7 jours pour {country}. Seuil : {threshold} mois.',
      predictiveForecast: 'Prévision du moteur de risque prédictif',
    },
  },
};

function parseLocale(input) {
  if (!input) return 'en';
  const raw = String(input).trim().toLowerCase().split(/[,;-]/)[0].split('_')[0];
  if (SUPPORTED.includes(raw)) return raw;
  if (raw.startsWith('de')) return 'de';
  if (raw.startsWith('fr')) return 'fr';
  if (raw.startsWith('en')) return 'en';
  return 'en';
}

function resolveLocaleFromRequest(req) {
  const header = req.headers['x-locale'] || req.headers['accept-language'];
  const query = req.query?.locale || req.body?.locale;
  return parseLocale(query || header);
}

function format(template, params = {}) {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const val = params[key];
    return val != null ? String(val) : '';
  });
}

function createAgentTranslator(locale) {
  const lang = parseLocale(locale);
  const catalog = MESSAGES[lang] || MESSAGES.en;

  function t(path, params) {
    const parts = path.split('.');
    let node = catalog;
    for (const part of parts) {
      node = node?.[part];
      if (node == null) {
        let fallback = MESSAGES.en;
        for (const p of parts) fallback = fallback?.[p];
        return typeof fallback === 'string' ? format(fallback, params) : path;
      }
    }
    return typeof node === 'string' ? format(node, params) : path;
  }

  return { locale: lang, t, agentName: (id) => catalog.agentNames[id] || id, agentLabel: (id) => catalog.agentLabels[id] || id };
}

function localizeRecommendation(rec, t) {
  return {
    ...rec,
    agent: t.agentName(rec.agentId) || rec.agent,
  };
}

function localizeAgentRunResult(result, locale) {
  if (!result || result.status === 'DISABLED') return result;
  const { t, agentName } = createAgentTranslator(locale);
  return {
    ...result,
    locale,
    advisorNote: result.advisorNote ? t('advisorNote.default') : result.advisorNote,
    dailySummary: result.dailySummary
      ? localizeDailySummary(result.dailySummary, locale)
      : null,
    recommendations: (result.recommendations || []).map((r) => ({
      ...localizeRecommendation(r, { agentName }),
      action: r.action,
      rationale: r.rationale,
      impact: r.impact,
    })),
  };
}

function localizeDailySummary(summary, locale) {
  if (!summary) return summary;
  const { t } = createAgentTranslator(locale);
  return {
    ...summary,
    label: t('dailySummaryLabel'),
    advisorNote: t('advisorNote.planning'),
    dataSourcesRead: summary.dataSourcesRead?.map((src) => {
      if (src.startsWith('Inspection Lots')) {
        const count = src.match(/\((\d+)\)/)?.[1] || '0';
        return t('dataSources.inspectionLots', { count });
      }
      if (src.startsWith('Historical Performance')) {
        const count = src.match(/\((\d+)/)?.[1] || '0';
        return t('dataSources.linePerformance', { count });
      }
      const map = {
        'Packaging Orders': 'dataSources.packagingOrders',
        'Inventory / Batches': 'dataSources.inventory',
        'Quality Stock': 'dataSources.qualityStock',
        'Line Calendars': 'dataSources.lineCalendars',
        'Digital Twin T+7': 'dataSources.digitalTwin',
      };
      return map[src] ? t(map[src]) : src;
    }),
    topLineScores: summary.topLineScores?.map((row) => ({
      ...row,
      reason: row.reason?.includes('Highest weighted') ? t('lineScoreReason') : row.reason,
    })),
  };
}

module.exports = {
  SUPPORTED_LOCALES: SUPPORTED,
  parseLocale,
  resolveLocaleFromRequest,
  createAgentTranslator,
  localizeAgentRunResult,
  localizeDailySummary,
  localizeRecommendation,
};
