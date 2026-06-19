const { z } = require('zod');

const nonEmpty = z.string().trim().min(1, 'Required');
const optionalStr = z.string().trim().optional().nullable();
const optionalNum = z.coerce.number().optional().nullable();
const optionalBool = z.boolean().optional().nullable();
const optionalDate = z.string().optional().nullable();

const planningOrderSchema = z.object({
  orderId: nonEmpty,
  plant: nonEmpty,
  finishedGoodMaterial: nonEmpty,
  orderQuantity: z.coerce.number().positive('orderQuantity must be > 0'),
  salesOrder: optionalStr,
  destinationCountry: optionalStr,
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional().nullable(),
  plannedStartDate: optionalDate,
  plannedEndDate: optionalDate,
  requestedDeliveryDate: optionalDate,
  productionLine: optionalStr,
  planningStatus: optionalStr,
  durationHours: optionalNum,
});

const operationSchema = z.object({
  operationId: nonEmpty,
  orderId: nonEmpty,
  operationNo: z.coerce.number().int().min(1),
  operationName: optionalStr,
  workCenterId: nonEmpty,
  setupTimeMinutes: z.coerce.number().min(0, 'setupTimeMinutes must be >= 0'),
  runTimeMinutes: z.coerce.number().min(0, 'runTimeMinutes must be >= 0'),
  teardownTimeMinutes: z.coerce.number().min(0, 'teardownTimeMinutes must be >= 0'),
  cleaningTimeMinutes: z.coerce.number().min(0, 'cleaningTimeMinutes must be >= 0'),
  isBottleneck: optionalBool,
  plannedStartDate: optionalDate,
  plannedEndDate: optionalDate,
});

const componentSchema = z.object({
  componentId: nonEmpty,
  orderId: nonEmpty,
  materialNumber: nonEmpty,
  componentType: z.enum(['BULK', 'PACKAGING', 'LABEL', 'INSERT']).optional().nullable(),
  requiredQuantity: z.coerce.number().min(0),
  unit: optionalStr,
  availableQuantity: z.coerce.number().min(0).optional().nullable(),
});

const materialSchema = z.object({
  materialNumber: nonEmpty,
  materialDescription: optionalStr,
  packageType: optionalStr,
  campaignGroup: optionalStr,
  colorFamily: optionalStr,
  revenuePerUnit: optionalNum,
  regulatoryCritical: optionalBool,
});

const batchSchema = z.object({
  batchId: nonEmpty,
  batchNumber: optionalStr,
  materialNumber: nonEmpty,
  materialDescription: optionalStr,
  quantity: z.coerce.number().min(0).optional().nullable(),
  availableQuantity: z.coerce.number().min(0, 'availableQuantity must be >= 0'),
  remainingShelfLifePercent: z.coerce.number().min(0).max(100, 'remainingShelfLifePercent must be 0–100').optional().nullable(),
  unit: optionalStr,
  productionDate: optionalDate,
  expiryDate: optionalDate,
  qualityStatus: z.enum(['RELEASED', 'BLOCKED', 'QUARANTINE', 'PENDING']).optional().nullable(),
  approvedCountries: z.array(z.string()).optional().nullable(),
  plant: optionalStr,
  storageLocation: optionalStr,
});

const tricCaseSchema = z.object({
  tricCaseId: nonEmpty,
  batchNumber: nonEmpty,
  country: nonEmpty,
  materialNumber: optionalStr,
  status: z.enum(['APPROVED', 'BLOCKED', 'PENDING']),
  validFrom: optionalDate,
  validTo: optionalDate,
  notes: optionalStr,
});

const inspectionLotSchema = z.object({
  lotId: nonEmpty,
  batchId: nonEmpty,
  materialNumber: nonEmpty,
  status: z.enum(['RELEASED', 'BLOCKED', 'PENDING', 'IN_INSPECTION']).optional().nullable(),
  usageDecision: optionalStr,
  createdDate: optionalDate,
  releaseDate: optionalDate,
  expectedReleaseDate: optionalDate,
});

const resourceSchema = z.object({
  resourceId: nonEmpty,
  resourceName: nonEmpty,
  resourceType: z.enum(['PERSON', 'EQUIPMENT', 'TOOL', 'LINE']).optional().nullable(),
  plant: optionalStr,
  capacityHoursPerDay: optionalNum,
  active: optionalBool,
});

const workCenterSchema = z.object({
  workCenterId: nonEmpty,
  workCenterName: optionalStr,
  plantId: optionalStr,
  type: z.enum(['PROCESS', 'PACKAGING', 'QC']).optional().nullable(),
  isBottleneck: optionalBool,
  capacityHoursPerDay: optionalNum,
  capacityUnitsPerDay: optionalNum,
  performanceFactor: optionalNum,
  active: optionalBool,
});

const packagingLineSchema = z.object({
  lineId: nonEmpty,
  lineName: optionalStr,
  plantId: optionalStr,
  capacityUnitsPerDay: z.coerce.number().min(0).optional().nullable(),
  shiftPattern: optionalStr,
  active: optionalBool,
  performanceFactor: optionalNum,
});

const shiftCalendarSchema = z.object({
  lineId: nonEmpty,
  weekStarting: nonEmpty,
  availableHours: z.coerce.number().min(0).optional().nullable(),
  maxUnitsPerDay: z.coerce.number().min(0).optional().nullable(),
});

const setupMatrixSchema = z.object({
  fromColor: nonEmpty,
  toColor: nonEmpty,
  setupMinutes: z.coerce.number().min(0),
  description: optionalStr,
});

const capacityBucketSchema = z.object({
  bucketId: nonEmpty,
  plantId: optionalStr,
  lineId: optionalStr,
  weekStarting: optionalDate,
  totalCapacity: z.coerce.number().min(0).optional().nullable(),
  allocatedCapacity: z.coerce.number().min(0).optional().nullable(),
  remainingCapacity: z.coerce.number().min(0).optional().nullable(),
  utilizationPercent: z.coerce.number().min(0).max(100).optional().nullable(),
});

const exceptionSchema = z.object({
  exceptionId: nonEmpty,
  type: optionalStr,
  typeLabel: optionalStr,
  packagingOrderId: optionalStr,
  destinationCountry: optionalStr,
  batchId: optionalStr,
  status: z.enum(['OPEN', 'IN_REVIEW', 'RESOLVED', 'CLOSED']).optional().nullable(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional().nullable(),
  message: optionalStr,
  createdAt: optionalDate,
  updatedAt: optionalDate,
});

const planningResultSchema = z.object({
  resultId: nonEmpty,
  scheduleType: z.enum(['LINE_SEQUENCING', 'DETAILED_SCHEDULING', 'OPERATIONS', 'WHAT_IF']).optional().nullable(),
  label: optionalStr,
  status: z.enum(['DRAFT', 'READY', 'CONFIRMED', 'SUPERSEDED']).optional().nullable(),
  itemCount: z.coerce.number().min(0).optional().nullable(),
  createdAt: optionalDate,
  kpisSummary: optionalStr,
  applicablePlanningHorizon: optionalStr,
  horizonType: z.enum(['FROZEN', 'FIXED', 'FLEXIBLE', 'FORECAST', 'OUT_OF_HORIZON']).optional().nullable(),
  horizonViolation: optionalBool,
  reschedulingAllowed: optionalBool,
  optimizationAllowed: optionalBool,
});

const planningHorizonSchema = z.object({
  horizonId: nonEmpty,
  horizonName: nonEmpty,
  plant: nonEmpty,
  planningArea: nonEmpty,
  scopeType: z.enum(['MATERIAL', 'MATERIAL_GROUP', 'PRODUCT_FAMILY', 'PACKAGING_LINE', 'WORK_CENTER', 'PLANT', 'PLANNING_AREA']),
  scopeValue: nonEmpty,
  horizonType: z.enum(['FROZEN', 'FIXED', 'FLEXIBLE', 'FORECAST']),
  startOffsetDays: z.coerce.number().int().min(0),
  endOffsetDays: z.coerce.number().int().min(0),
  isEditable: optionalBool,
  isAutoSchedulable: optionalBool,
  allowRescheduling: optionalBool,
  priority: z.coerce.number().int().optional().nullable(),
  validFrom: optionalDate,
  validTo: optionalDate,
  description: optionalStr,
}).refine((d) => d.endOffsetDays >= d.startOffsetDays, {
  message: 'endOffsetDays must be >= startOffsetDays',
  path: ['endOffsetDays'],
});

const SCHEMAS = {
  'planning-orders': planningOrderSchema,
  operations: operationSchema,
  components: componentSchema,
  materials: materialSchema,
  batches: batchSchema,
  'tric-cases': tricCaseSchema,
  'inspection-lots': inspectionLotSchema,
  resources: resourceSchema,
  'work-centers': workCenterSchema,
  'packaging-lines': packagingLineSchema,
  'shift-calendars': shiftCalendarSchema,
  'setup-matrix': setupMatrixSchema,
  'capacity-buckets': capacityBucketSchema,
  exceptions: exceptionSchema,
  'planning-results': planningResultSchema,
  'planning-horizons': planningHorizonSchema,
};

function validateEntity(slug, data, { partial = false } = {}) {
  const schema = SCHEMAS[slug];
  if (!schema) {
    return { success: false, errors: [{ path: '_', message: `Unknown entity: ${slug}` }] };
  }
  const target = partial ? schema.partial() : schema;
  const result = target.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errors = result.error.issues.map((i) => ({
    path: i.path.join('.'),
    message: i.message,
  }));
  return { success: false, errors };
}

module.exports = { SCHEMAS, validateEntity };
