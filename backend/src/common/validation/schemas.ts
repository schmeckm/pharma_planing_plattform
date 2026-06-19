import { z } from 'zod';

const nonEmpty = z.string().trim().min(1, 'Required');
const optionalStr = z.string().trim().optional().nullable();
const optionalNum = z.coerce.number().optional().nullable();
const optionalBool = z.boolean().optional().nullable();
const optionalDate = z.string().optional().nullable();

const auditFields = {
  id: z.string().uuid().optional(),
  createdAt: optionalDate,
  createdBy: optionalStr,
  updatedAt: optionalDate,
  updatedBy: optionalStr,
  version: z.coerce.number().int().min(1).optional(),
  sourceSystem: optionalStr,
  sourceObjectType: optionalStr,
  sourceObjectId: optionalStr,
  sourcePayload: z.record(z.string(), z.unknown()).optional().nullable(),
  lastImportedAt: optionalDate,
};

export const planningOrderSchema = z.object({
  ...auditFields,
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
  sapOrderNumber: optionalStr,
});

export const operationSchema = z.object({
  ...auditFields,
  operationId: nonEmpty,
  orderId: nonEmpty,
  operationNo: z.coerce.number().int().min(1),
  operationName: optionalStr,
  workCenterId: nonEmpty,
  setupTimeMinutes: z.coerce.number().min(0),
  runTimeMinutes: z.coerce.number().min(0),
  teardownTimeMinutes: z.coerce.number().min(0),
  cleaningTimeMinutes: z.coerce.number().min(0),
  isBottleneck: optionalBool,
  plannedStartDate: optionalDate,
  plannedEndDate: optionalDate,
});

export const componentSchema = z.object({
  ...auditFields,
  componentId: nonEmpty,
  orderId: nonEmpty,
  materialNumber: nonEmpty,
  componentType: z.enum(['BULK', 'PACKAGING', 'LABEL', 'INSERT']).optional().nullable(),
  requiredQuantity: z.coerce.number().min(0),
  unit: optionalStr,
  availableQuantity: z.coerce.number().min(0).optional().nullable(),
});

export const materialSchema = z.object({
  ...auditFields,
  materialNumber: nonEmpty,
  materialDescription: optionalStr,
  packageType: optionalStr,
  campaignGroup: optionalStr,
  colorFamily: optionalStr,
  revenuePerUnit: optionalNum,
  regulatoryCritical: optionalBool,
});

export const batchSchema = z.object({
  ...auditFields,
  batchId: nonEmpty,
  batchNumber: optionalStr,
  materialNumber: nonEmpty,
  materialDescription: optionalStr,
  quantity: z.coerce.number().min(0).optional().nullable(),
  availableQuantity: z.coerce.number().min(0),
  remainingShelfLifePercent: z.coerce.number().min(0).max(100).optional().nullable(),
  unit: optionalStr,
  productionDate: optionalDate,
  expiryDate: optionalDate,
  qualityStatus: z.enum(['RELEASED', 'BLOCKED', 'QUARANTINE', 'PENDING']).optional().nullable(),
  approvedCountries: z.array(z.string()).optional().nullable(),
  plant: optionalStr,
  storageLocation: optionalStr,
});

export const tricCaseSchema = z.object({
  ...auditFields,
  tricCaseId: nonEmpty,
  batchNumber: nonEmpty,
  country: nonEmpty,
  materialNumber: optionalStr,
  status: z.enum(['APPROVED', 'BLOCKED', 'PENDING']),
  validFrom: optionalDate,
  validTo: optionalDate,
  notes: optionalStr,
});

export const inspectionLotSchema = z.object({
  ...auditFields,
  lotId: nonEmpty,
  batchId: nonEmpty,
  materialNumber: nonEmpty,
  status: z.enum(['RELEASED', 'BLOCKED', 'PENDING', 'IN_INSPECTION']).optional().nullable(),
  usageDecision: optionalStr,
  createdDate: optionalDate,
  releaseDate: optionalDate,
  expectedReleaseDate: optionalDate,
});

export const resourceSchema = z.object({
  ...auditFields,
  resourceId: nonEmpty,
  resourceName: nonEmpty,
  resourceType: z.enum(['PERSON', 'EQUIPMENT', 'TOOL', 'LINE']).optional().nullable(),
  plant: optionalStr,
  capacityHoursPerDay: optionalNum,
  active: optionalBool,
});

export const setupMatrixSchema = z.object({
  ...auditFields,
  fromColor: nonEmpty,
  toColor: nonEmpty,
  setupMinutes: z.coerce.number().min(0),
  description: optionalStr,
});

export const capacityBucketSchema = z.object({
  ...auditFields,
  bucketId: nonEmpty,
  plantId: optionalStr,
  lineId: optionalStr,
  weekStarting: optionalDate,
  totalCapacity: z.coerce.number().min(0).optional().nullable(),
  allocatedCapacity: z.coerce.number().min(0).optional().nullable(),
  remainingCapacity: z.coerce.number().min(0).optional().nullable(),
  utilizationPercent: z.coerce.number().min(0).max(100).optional().nullable(),
});

export const planningHorizonSchema = z.object({
  ...auditFields,
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

export const workCenterSchema = z.object({
  ...auditFields,
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

export const packagingLineSchema = z.object({
  ...auditFields,
  lineId: nonEmpty,
  lineName: optionalStr,
  plantId: optionalStr,
  capacityUnitsPerDay: z.coerce.number().min(0).optional().nullable(),
  shiftPattern: optionalStr,
  active: optionalBool,
  performanceFactor: optionalNum,
});

export const shiftCalendarSchema = z.object({
  ...auditFields,
  lineId: nonEmpty,
  weekStarting: nonEmpty,
  availableHours: z.coerce.number().min(0).optional().nullable(),
  maxUnitsPerDay: z.coerce.number().min(0).optional().nullable(),
});

export const exceptionSchema = z.object({
  ...auditFields,
  exceptionId: nonEmpty,
  type: optionalStr,
  typeLabel: optionalStr,
  packagingOrderId: optionalStr,
  destinationCountry: optionalStr,
  batchId: optionalStr,
  status: z.enum(['OPEN', 'IN_REVIEW', 'RESOLVED', 'CLOSED']).optional().nullable(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional().nullable(),
  message: optionalStr,
});

export const planningResultSchema = z.object({
  ...auditFields,
  resultId: nonEmpty,
  scheduleType: z.enum(['LINE_SEQUENCING', 'DETAILED_SCHEDULING', 'OPERATIONS', 'WHAT_IF']).optional().nullable(),
  label: optionalStr,
  status: z.enum(['DRAFT', 'READY', 'CONFIRMED', 'SUPERSEDED']).optional().nullable(),
  itemCount: z.coerce.number().min(0).optional().nullable(),
  kpisSummary: optionalStr,
  applicablePlanningHorizon: optionalStr,
  horizonType: z.enum(['FROZEN', 'FIXED', 'FLEXIBLE', 'FORECAST', 'OUT_OF_HORIZON']).optional().nullable(),
  horizonViolation: optionalBool,
  reschedulingAllowed: optionalBool,
  optimizationAllowed: optionalBool,
});

export type EntitySlug =
  | 'planning-orders'
  | 'operations'
  | 'components'
  | 'materials'
  | 'batches'
  | 'tric-cases'
  | 'inspection-lots'
  | 'resources'
  | 'setup-matrix'
  | 'capacity-buckets'
  | 'planning-horizons'
  | 'work-centers'
  | 'packaging-lines'
  | 'shift-calendars'
  | 'exceptions'
  | 'planning-results';

export const ENTITY_SCHEMAS = {
  'planning-orders': planningOrderSchema,
  operations: operationSchema,
  components: componentSchema,
  materials: materialSchema,
  batches: batchSchema,
  'tric-cases': tricCaseSchema,
  'inspection-lots': inspectionLotSchema,
  resources: resourceSchema,
  'setup-matrix': setupMatrixSchema,
  'capacity-buckets': capacityBucketSchema,
  'planning-horizons': planningHorizonSchema,
  'work-centers': workCenterSchema,
  'packaging-lines': packagingLineSchema,
  'shift-calendars': shiftCalendarSchema,
  exceptions: exceptionSchema,
  'planning-results': planningResultSchema,
} as const satisfies Record<EntitySlug, z.ZodObject<Record<string, z.ZodTypeAny>>>;

export function validateEntity(
  slug: EntitySlug,
  data: unknown,
  options: { partial?: boolean } = {},
): { success: true; data: Record<string, unknown> } | { success: false; errors: { path: string; message: string }[] } {
  const schema = ENTITY_SCHEMAS[slug];
  const target = options.partial ? schema.partial() : schema;
  const result = target.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data as Record<string, unknown> };
  }
  return {
    success: false,
    errors: result.error.issues.map((i: { path: PropertyKey[]; message: string }) => ({
      path: i.path.map(String).join('.'),
      message: i.message,
    })),
  };
}
