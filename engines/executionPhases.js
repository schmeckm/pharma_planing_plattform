/**

 * Pharmaceutical allocation decision hierarchy (GMP compliance-first).

 *

 * Priority 1 – Compliance (hard stop)

 * Priority 2 – Availability

 * Priority 3 – Market Rules

 * Priority 4 – Inventory Optimization (FEFO / FIFO)

 * Priority 5 – Production Performance (historical OEE, throughput, reliability)

 * Priority 6 – Production Optimization (campaign, changeover, utilization)

 * Priority 7 – Enterprise Optimization (service level, market coverage)

 */

const EXECUTION_PHASE = {

  COMPLIANCE: 'COMPLIANCE',

  AVAILABILITY: 'AVAILABILITY',

  MARKET_RULES: 'MARKET_RULES',

  INVENTORY_OPTIMIZATION: 'INVENTORY_OPTIMIZATION',

  PRODUCTION_PERFORMANCE: 'PRODUCTION_PERFORMANCE',

  PRODUCTION_OPTIMIZATION: 'PRODUCTION_OPTIMIZATION',

  ENTERPRISE_OPTIMIZATION: 'ENTERPRISE_OPTIMIZATION',

};



/** MVP runtime phases (mapped from hierarchy) */

const RUNTIME_PHASE = {

  COMPLIANCE: 'COMPLIANCE',

  AVAILABILITY: 'AVAILABILITY',

  MARKET_RULES: 'MARKET_RULES',

  PRODUCTION: 'PRODUCTION',

  FIFO: 'FIFO',

  OPTIMIZATION: 'OPTIMIZATION',

};



const PHASE_ORDER = [

  EXECUTION_PHASE.COMPLIANCE,

  EXECUTION_PHASE.AVAILABILITY,

  EXECUTION_PHASE.MARKET_RULES,

  EXECUTION_PHASE.INVENTORY_OPTIMIZATION,

  EXECUTION_PHASE.PRODUCTION_PERFORMANCE,

  EXECUTION_PHASE.PRODUCTION_OPTIMIZATION,

  EXECUTION_PHASE.ENTERPRISE_OPTIMIZATION,

];



const RUNTIME_PHASE_ORDER = [

  RUNTIME_PHASE.COMPLIANCE,

  RUNTIME_PHASE.AVAILABILITY,

  RUNTIME_PHASE.MARKET_RULES,

  RUNTIME_PHASE.PRODUCTION,

  RUNTIME_PHASE.FIFO,

  RUNTIME_PHASE.OPTIMIZATION,

];



const ALLOCATION_RULES = [

  { id: 1, priority: 1, name: 'Market Release Check (TRIC)', phase: EXECUTION_PHASE.COMPLIANCE },

  { id: 2, priority: 1, name: 'Quality Release Status', phase: EXECUTION_PHASE.COMPLIANCE },

  { id: 3, priority: 1, name: 'Remaining Shelf Life (RMSL)', phase: EXECUTION_PHASE.COMPLIANCE },

  { id: 4, priority: 1, name: 'Batch Split Restrictions', phase: EXECUTION_PHASE.COMPLIANCE },

  { id: 5, priority: 1, name: 'Country Regulatory Rules', phase: EXECUTION_PHASE.COMPLIANCE },

  { id: 6, priority: 1, name: 'Customer Compliance Rules', phase: EXECUTION_PHASE.COMPLIANCE },

  { id: 7, priority: 2, name: 'ATP Inventory Check', phase: EXECUTION_PHASE.AVAILABILITY },

  { id: 8, priority: 2, name: 'Reserved Inventory Check', phase: EXECUTION_PHASE.AVAILABILITY },

  { id: 9, priority: 2, name: 'Safety Stock Check', phase: EXECUTION_PHASE.AVAILABILITY },

  { id: 10, priority: 2, name: 'Quality Stock Check', phase: EXECUTION_PHASE.AVAILABILITY },

  { id: 11, priority: 2, name: 'Inspection Lot Check', phase: EXECUTION_PHASE.AVAILABILITY },

  { id: 12, priority: 3, name: 'Japan Continuous Output Batch Rule', phase: EXECUTION_PHASE.MARKET_RULES },

  { id: 13, priority: 3, name: 'Customer Priority', phase: EXECUTION_PHASE.MARKET_RULES },

  { id: 14, priority: 3, name: 'Market Priority', phase: EXECUTION_PHASE.MARKET_RULES },

  { id: 15, priority: 3, name: 'Product Launch Priority', phase: EXECUTION_PHASE.MARKET_RULES },

  { id: 16, priority: 4, name: 'FEFO', phase: EXECUTION_PHASE.INVENTORY_OPTIMIZATION },

  { id: 17, priority: 4, name: 'FIFO', phase: EXECUTION_PHASE.INVENTORY_OPTIMIZATION },

  { id: 18, priority: 5, name: 'Historical OEE', phase: EXECUTION_PHASE.PRODUCTION_PERFORMANCE },

  { id: 19, priority: 5, name: 'Historical Throughput', phase: EXECUTION_PHASE.PRODUCTION_PERFORMANCE },

  { id: 20, priority: 5, name: 'Historical Reliability', phase: EXECUTION_PHASE.PRODUCTION_PERFORMANCE },

  { id: 21, priority: 5, name: 'Historical Yield', phase: EXECUTION_PHASE.PRODUCTION_PERFORMANCE },

  { id: 22, priority: 5, name: 'Historical Setup Time', phase: EXECUTION_PHASE.PRODUCTION_PERFORMANCE },

  { id: 23, priority: 5, name: 'Historical Downtime', phase: EXECUTION_PHASE.PRODUCTION_PERFORMANCE },

  { id: 24, priority: 6, name: 'Campaign Planning', phase: EXECUTION_PHASE.PRODUCTION_OPTIMIZATION },

  { id: 25, priority: 6, name: 'Changeover Optimization', phase: EXECUTION_PHASE.PRODUCTION_OPTIMIZATION },

  { id: 26, priority: 6, name: 'Line Utilization', phase: EXECUTION_PHASE.PRODUCTION_OPTIMIZATION },

  { id: 27, priority: 6, name: 'Production Capacity', phase: EXECUTION_PHASE.PRODUCTION_OPTIMIZATION },

  { id: 28, priority: 6, name: 'Bottleneck Reduction', phase: EXECUTION_PHASE.PRODUCTION_OPTIMIZATION },

  { id: 29, priority: 7, name: 'Inventory Risk', phase: EXECUTION_PHASE.ENTERPRISE_OPTIMIZATION },

  { id: 30, priority: 7, name: 'Service Level', phase: EXECUTION_PHASE.ENTERPRISE_OPTIMIZATION },

  { id: 31, priority: 7, name: 'Market Coverage', phase: EXECUTION_PHASE.ENTERPRISE_OPTIMIZATION },

  { id: 32, priority: 7, name: 'Global Inventory Balancing', phase: EXECUTION_PHASE.ENTERPRISE_OPTIMIZATION },

];



const ENGINE_VERSION = '2.0.0-enterprise';

/** Backward-compatible runtime aliases for ruleEngine / optimizationEngine */
EXECUTION_PHASE.PRODUCTION = RUNTIME_PHASE.PRODUCTION;
EXECUTION_PHASE.FIFO = RUNTIME_PHASE.FIFO;
EXECUTION_PHASE.OPTIMIZATION = RUNTIME_PHASE.OPTIMIZATION;

module.exports = {
  EXECUTION_PHASE,
  RUNTIME_PHASE,
  PHASE_ORDER,
  RUNTIME_PHASE_ORDER,
  ALLOCATION_RULES,
  ENGINE_VERSION,
};

