class CopilotEngine {
  /**
   * Internal reasoning engine — no external AI.
   * Generates explanations from allocation results and rule checks.
   */
  answer(question, context) {
    const q = question.toLowerCase().trim();
    const { order, result, batch, countryRule, risk, ruleChecks, exceptions } = context;

    if (this._matches(q, ['why was this batch selected', 'why batch', 'batch selected'])) {
      return this._explainBatchSelection(order, result, batch, ruleChecks);
    }

    if (this._matches(q, ['why is this order blocked', 'why blocked', 'order blocked', 'why failed'])) {
      return this._explainBlocked(order, result, ruleChecks, exceptions);
    }

    if (this._matches(q, ['what happens if i move', 'move this order', 'what if move'])) {
      return this._explainMoveOrder(order, context);
    }

    if (this._matches(q, ['which batch is recommended', 'recommended batch', 'what batch'])) {
      return this._explainRecommendedBatch(order, result, batch, ruleChecks, risk);
    }

    if (this._matches(q, ['why was this line recommended', 'why line', 'line recommended', 'production line'])) {
      return this._explainLineRecommendation(order, context);
    }

    if (this._matches(q, ['another batch', 'different batch', 'use another batch', 'change batch'])) {
      return this._explainAlternateBatch(order, result, batch, ruleChecks, risk);
    }

    if (this._matches(q, ['another line', 'different line', 'move to another line', 'change line', 'move the order to'])) {
      return this._explainAlternateLine(order, context);
    }

    if (this._matches(q, ['risk', 'risk score'])) {
      return this._explainRisk(risk);
    }

    if (this._matches(q, ['rmsl', 'shelf life'])) {
      return this._explainRmsl(batch, countryRule, ruleChecks);
    }

    if (this._matches(q, ['fifo', 'oldest batch'])) {
      return this._explainFifo(result, ruleChecks);
    }

    return this._generalSummary(order, result, risk);
  }

  _matches(q, patterns) {
    return patterns.some((p) => q.includes(p));
  }

  _explainBatchSelection(order, result, batch, ruleChecks) {
    if (!result?.recommendedBatchId) {
      return {
        intent: 'BATCH_SELECTION',
        answer: `No batch was selected for order ${order?.packagingOrderId}. The allocation engine could not find a compliant batch for destination ${order?.destinationCountry}.`,
        evidence: result?.failureReasons || [],
        suggestions: ['Review TRIC approvals for target country', 'Check RMSL thresholds', 'Verify batch quality status'],
      };
    }

    const passed = (ruleChecks || result?.ruleChecks || []).filter((c) => c.result === 'PASSED');
    const fifoCheck = passed.find((c) => c.ruleName?.includes('FIFO'));
    const enterpriseNote = result?.ruleSetVersion
      ? ` Rule set version ${result.ruleSetVersion} applied.`
      : '';

    return {
      intent: 'BATCH_SELECTION',
      answer: `Batch ${result.recommendedBatchId} was selected for order ${order?.packagingOrderId} because it passed all compliance checks for ${order?.destinationCountry}. ${fifoCheck ? fifoCheck.message : 'It is the oldest compliant batch (FIFO strategy).'}${enterpriseNote}`,
      evidence: passed.map((c) => c.message),
      batchDetails: batch ? {
        productionDate: batch.productionDate,
        availableQuantity: batch.availableQuantity,
        rmsl: batch.remainingShelfLifeMonths,
      } : null,
    };
  }

  _explainBlocked(order, result, ruleChecks, exceptions) {
    const failed = (ruleChecks || result?.ruleChecks || []).filter((c) => c.result === 'FAILED');
    const reasons = result?.failureReasons || failed.map((c) => c.message);

    return {
      intent: 'ORDER_BLOCKED',
      answer: `Order ${order?.packagingOrderId} is blocked due to ${failed.length} failed rule check(s) for market ${order?.destinationCountry}.`,
      evidence: reasons,
      failedRules: failed.map((c) => ({ rule: c.ruleName, message: c.message })),
      openExceptions: (exceptions || []).filter((e) => e.status === 'OPEN').length,
      suggestions: this._suggestResolutions(failed),
    };
  }

  _explainRecommendedBatch(order, result, batch, ruleChecks, risk) {
    if (!result?.recommendedBatchId) {
      return {
        intent: 'RECOMMENDED_BATCH',
        answer: `No batch is recommended for order ${order?.packagingOrderId}. Allocation failed compliance checks for ${order?.destinationCountry}.`,
        evidence: result?.failureReasons || [],
        suggestions: ['Review open exceptions', 'Check batch inventory for material', 'Verify country rules'],
      };
    }

    const passed = (ruleChecks || result?.ruleChecks || []).filter((c) => c.result === 'PASSED');
    return {
      intent: 'RECOMMENDED_BATCH',
      answer: `Batch ${result.recommendedBatchId} is recommended for order ${order?.packagingOrderId} (${order?.quantity} EA to ${order?.destinationCountry}). Risk level: ${risk?.level || 'N/A'}.`,
      evidence: passed.map((c) => c.message),
      batchDetails: batch ? {
        batchId: batch.batchId,
        productionDate: batch.productionDate,
        availableQuantity: batch.availableQuantity,
        qualityStatus: batch.qualityStatus,
      } : { batchId: result.recommendedBatchId },
      alternatives: result?.alternativeBatches || [],
      risk: risk ? { level: risk.level, score: risk.score, factors: risk.factors } : null,
    };
  }

  _explainMoveOrder(order, context) {
    const line = context.lineRecommendation;
    return {
      intent: 'ORDER_MOVE',
      answer: `Moving order ${order?.packagingOrderId} in the sequence may affect sequence-check rules and FIFO selection for ${order?.destinationCountry}. ${line ? `Current line ${order?.productionLine || 'unassigned'} — highest-scoring alternative is ${line.recommendedLineId} (score ${line.lineScore}).` : ''} Re-run What-If simulation to assess shelf-life, capacity, and delivery impact.`,
      suggestions: [
        'Use What-If Simulation with a new sequence',
        'Check sequence-check rules if destination is JP',
        'Review line utilization on target production line',
      ],
      impactAreas: ['Shelf-Life Risk', 'Delivery Date', 'Capacity', 'Compliance'],
    };
  }

  _explainLineRecommendation(order, context) {
    const line = context.lineRecommendation;
    if (!line?.recommendedLineId) {
      return {
        intent: 'LINE_RECOMMENDATION',
        answer: 'No line recommendation available. Run performance analysis for the order material.',
        suggestions: ['Open Production Sequencing and build recommended sequence'],
      };
    }
    const reasons = line.reasons || [
      'Highest OEE on this material',
      'Highest throughput',
      'Lowest setup time',
      'Highest line reliability',
    ];
    return {
      intent: 'LINE_RECOMMENDATION',
      answer: `Line ${line.recommendedLineId} is recommended for material ${order?.materialNumber || 'N/A'} based on historical performance (score ${line.lineScore}/100).`,
      evidence: reasons,
      lineDetails: line.candidates?.[0]?.components || null,
      suggestions: ['Confirm line capacity in Gantt before moving order'],
    };
  }

  _explainAlternateBatch(order, result, batch, ruleChecks, risk) {
    const alts = result?.alternativeBatches || [];
    return {
      intent: 'ALTERNATE_BATCH',
      answer: alts.length
        ? `Using another batch affects FIFO compliance and shelf-life margin. ${alts.length} alternative batch(es) evaluated. Current recommendation: ${result?.recommendedBatchId}.`
        : `No compliant alternate batch found for ${order?.destinationCountry}. Market release and shelf-life checks must pass.`,
      evidence: (ruleChecks || []).map((c) => c.message),
      alternatives: alts,
      risk: risk ? { level: risk.level, factors: risk.factors } : null,
      impactAreas: ['Shelf-Life Risk', 'Inventory', 'Compliance', 'Market Release'],
      suggestions: ['Run allocation What-If with forced batch override'],
    };
  }

  _explainAlternateLine(order, context) {
    const line = context.lineRecommendation;
    const alt = line?.candidates?.[1];
    return {
      intent: 'ALTERNATE_LINE',
      answer: alt
        ? `Moving to line ${alt.lineId} (${alt.lineName}) changes expected OEE to ${alt.components?.oee}% and throughput score to ${alt.components?.throughput}. Score: ${alt.lineScore} vs current recommendation ${line.recommendedLineId} (${line.lineScore}).`
        : `Line change requires capacity check and sequence validation for ${order?.destinationCountry}.`,
      evidence: line?.candidates?.map((c) => `${c.lineId}: score ${c.lineScore}`) || [],
      impactAreas: ['Capacity', 'OEE', 'Delivery Date', 'Setup Time'],
      suggestions: ['Drag order to target line in Production Sequencing Gantt', 'Re-simulate with What-If'],
    };
  }

  _explainRisk(risk) {
    if (!risk) return { intent: 'RISK', answer: 'No risk assessment available. Run a simulation first.' };
    return {
      intent: 'RISK',
      answer: `Allocation risk is ${risk.level} (score: ${risk.score}/100).`,
      factors: risk.factors,
    };
  }

  _explainRmsl(batch, countryRule, ruleChecks) {
    const rmslCheck = (ruleChecks || []).find((c) => c.ruleName?.includes('RMSL'));
    return {
      intent: 'RMSL',
      answer: rmslCheck?.message || `Minimum RMSL for ${countryRule?.countryCode} is ${countryRule?.rmslThresholdMonths} months.`,
      threshold: countryRule?.rmslThresholdMonths,
      batchRmsl: batch?.remainingShelfLifeMonths,
    };
  }

  _explainFifo(result, ruleChecks) {
    const fifo = (ruleChecks || []).find((c) => c.ruleName?.includes('FIFO'));
    return {
      intent: 'FIFO',
      answer: fifo?.message || `FIFO strategy selected batch ${result?.recommendedBatchId} as the oldest compliant batch.`,
    };
  }

  _generalSummary(order, result, risk) {
    return {
      intent: 'GENERAL',
      answer: `Order ${order?.packagingOrderId} for ${order?.destinationCountry}: status ${result?.status}, batch ${result?.recommendedBatchId || 'none'}, risk ${risk?.level || 'N/A'}.`,
      suggestions: [
        'Why was this batch selected?',
        'Why was this line recommended?',
        'What happens if I move this order?',
        'What happens if I use another batch?',
        'What happens if I move to another line?',
      ],
    };
  }

  _suggestResolutions(failedChecks) {
    const suggestions = [];
    for (const check of failedChecks) {
      if (check.ruleName?.includes('TRIC')) suggestions.push('Request TRIC approval for destination country');
      if (check.ruleName?.includes('RMSL')) suggestions.push('Source batch with higher remaining shelf life');
      if (check.ruleName?.includes('Split')) suggestions.push('Find batch with full order quantity');
      if (check.ruleName?.includes('Sequence')) suggestions.push('Allocate preceding Japan sequence batch first');
      if (check.ruleName?.includes('Quality')) suggestions.push('Wait for QA release of batch');
    }
    return [...new Set(suggestions)];
  }
}

module.exports = { CopilotEngine };
