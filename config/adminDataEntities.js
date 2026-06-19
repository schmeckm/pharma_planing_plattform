/**
 * Admin Data Management — entity registry.
 * Maps REST slug → JSON collection + id field.
 */
const ADMIN_ENTITIES = {
  'planning-orders': {
    slug: 'planning-orders',
    label: 'Planning Orders',
    collection: 'planningOrders',
    arrayKey: 'items',
    idField: 'orderId',
    searchFields: ['orderId', 'plant', 'finishedGoodMaterial', 'salesOrder', 'destinationCountry'],
  },
  operations: {
    slug: 'operations',
    label: 'Operations',
    collection: 'operations',
    arrayKey: 'items',
    idField: 'operationId',
    searchFields: ['operationId', 'orderId', 'workCenterId', 'operationName'],
  },
  components: {
    slug: 'components',
    label: 'Components',
    collection: 'components',
    arrayKey: 'items',
    idField: 'componentId',
    searchFields: ['componentId', 'orderId', 'materialNumber', 'componentType'],
  },
  materials: {
    slug: 'materials',
    label: 'Materials',
    collection: 'materials',
    arrayKey: 'items',
    idField: 'materialNumber',
    searchFields: ['materialNumber', 'materialDescription', 'campaignGroup', 'colorFamily'],
  },
  batches: {
    slug: 'batches',
    label: 'Batches',
    collection: 'batches',
    arrayKey: 'items',
    idField: 'batchId',
    searchFields: ['batchId', 'materialNumber', 'batchNumber', 'plant'],
  },
  'tric-cases': {
    slug: 'tric-cases',
    label: 'TRIC Cases',
    collection: 'tricCases',
    arrayKey: 'items',
    idField: 'tricCaseId',
    searchFields: ['tricCaseId', 'batchNumber', 'country', 'materialNumber'],
  },
  'inspection-lots': {
    slug: 'inspection-lots',
    label: 'Inspection Lots',
    collection: 'inspectionLots',
    arrayKey: 'items',
    idField: 'lotId',
    searchFields: ['lotId', 'batchId', 'materialNumber', 'status'],
  },
  resources: {
    slug: 'resources',
    label: 'Resources',
    collection: 'resources',
    arrayKey: 'items',
    idField: 'resourceId',
    searchFields: ['resourceId', 'resourceName', 'resourceType', 'plant'],
  },
  'work-centers': {
    slug: 'work-centers',
    label: 'Work Centers',
    collection: 'workCenters',
    arrayKey: 'items',
    idField: 'workCenterId',
    searchFields: ['workCenterId', 'workCenterName', 'plantId', 'type'],
  },
  'packaging-lines': {
    slug: 'packaging-lines',
    label: 'Packaging Lines',
    collection: 'productionLines',
    arrayKey: 'items',
    idField: 'lineId',
    searchFields: ['lineId', 'lineName', 'plantId'],
  },
  'shift-calendars': {
    slug: 'shift-calendars',
    label: 'Shift Calendars',
    collection: 'lineCalendars',
    arrayKey: 'items',
    idField: '_compositeId',
    compositeIdFields: ['lineId', 'weekStarting'],
    searchFields: ['lineId', 'weekStarting'],
  },
  'setup-matrix': {
    slug: 'setup-matrix',
    label: 'Setup Matrix',
    collection: 'setupMatrix',
    arrayKey: 'items',
    idField: '_compositeId',
    compositeIdFields: ['fromColor', 'toColor'],
    searchFields: ['fromColor', 'toColor', 'description'],
  },
  'capacity-buckets': {
    slug: 'capacity-buckets',
    label: 'Capacity Buckets',
    collection: 'capacityBuckets',
    arrayKey: 'items',
    idField: 'bucketId',
    searchFields: ['bucketId', 'lineId', 'plantId', 'weekStarting'],
  },
  exceptions: {
    slug: 'exceptions',
    label: 'Exceptions',
    collection: 'exceptions',
    arrayKey: 'items',
    idField: 'exceptionId',
    searchFields: ['exceptionId', 'type', 'packagingOrderId', 'status', 'message'],
  },
  'planning-results': {
    slug: 'planning-results',
    label: 'Planning Results',
    collection: 'planningResults',
    arrayKey: 'items',
    idField: 'resultId',
    searchFields: ['resultId', 'scheduleType', 'label', 'status', 'horizonType'],
  },
  'planning-horizons': {
    slug: 'planning-horizons',
    label: 'Planning Horizons',
    collection: 'planningHorizons',
    arrayKey: 'items',
    idField: 'horizonId',
    searchFields: ['horizonId', 'horizonName', 'scopeType', 'scopeValue', 'horizonType', 'plant', 'planningArea'],
  },
};

function getEntity(slug) {
  const entity = ADMIN_ENTITIES[slug];
  if (!entity) return null;
  return entity;
}

function listEntities() {
  return Object.values(ADMIN_ENTITIES);
}

function buildCompositeId(row, fields) {
  return fields.map((f) => String(row[f] ?? '')).join('__');
}

function parseCompositeId(id, fields) {
  const parts = String(id).split('__');
  const result = {};
  fields.forEach((f, i) => { result[f] = parts[i] ?? ''; });
  return result;
}

module.exports = {
  ADMIN_ENTITIES,
  getEntity,
  listEntities,
  buildCompositeId,
  parseCompositeId,
};
