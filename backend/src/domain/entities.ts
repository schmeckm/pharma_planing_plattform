import type { BaseEntity } from './base/types';

export interface PlanningOrder extends BaseEntity {
  orderId: string;
  plant: string;
  finishedGoodMaterial: string;
  orderQuantity: number;
  salesOrder?: string | null;
  destinationCountry?: string | null;
  priority?: 'HIGH' | 'MEDIUM' | 'LOW' | null;
  plannedStartDate?: string | null;
  plannedEndDate?: string | null;
  requestedDeliveryDate?: string | null;
  productionLine?: string | null;
  planningStatus?: string | null;
  durationHours?: number | null;
  sapOrderNumber?: string | null;
}

export interface Operation extends BaseEntity {
  operationId: string;
  orderId: string;
  operationNo: number;
  operationName?: string | null;
  workCenterId: string;
  setupTimeMinutes: number;
  runTimeMinutes: number;
  teardownTimeMinutes: number;
  cleaningTimeMinutes: number;
  isBottleneck?: boolean | null;
  plannedStartDate?: string | null;
  plannedEndDate?: string | null;
}

export interface Component extends BaseEntity {
  componentId: string;
  orderId: string;
  materialNumber: string;
  componentType?: 'BULK' | 'PACKAGING' | 'LABEL' | 'INSERT' | null;
  requiredQuantity: number;
  unit?: string | null;
  availableQuantity?: number | null;
}

export interface Material extends BaseEntity {
  materialNumber: string;
  materialDescription?: string | null;
  packageType?: string | null;
  campaignGroup?: string | null;
  colorFamily?: string | null;
  revenuePerUnit?: number | null;
  regulatoryCritical?: boolean | null;
}

export interface Batch extends BaseEntity {
  batchId: string;
  batchNumber?: string | null;
  materialNumber: string;
  materialDescription?: string | null;
  quantity?: number | null;
  availableQuantity: number;
  remainingShelfLifePercent?: number | null;
  unit?: string | null;
  productionDate?: string | null;
  expiryDate?: string | null;
  qualityStatus?: 'RELEASED' | 'BLOCKED' | 'QUARANTINE' | 'PENDING' | null;
  approvedCountries?: string[] | null;
  plant?: string | null;
  storageLocation?: string | null;
}

export interface TricCase extends BaseEntity {
  tricCaseId: string;
  batchNumber: string;
  country: string;
  materialNumber?: string | null;
  status: 'APPROVED' | 'BLOCKED' | 'PENDING';
  validFrom?: string | null;
  validTo?: string | null;
  notes?: string | null;
}

export interface InspectionLot extends BaseEntity {
  lotId: string;
  batchId: string;
  materialNumber: string;
  status?: 'RELEASED' | 'BLOCKED' | 'PENDING' | 'IN_INSPECTION' | null;
  usageDecision?: string | null;
  createdDate?: string | null;
  releaseDate?: string | null;
  expectedReleaseDate?: string | null;
}

export interface Resource extends BaseEntity {
  resourceId: string;
  resourceName: string;
  resourceType?: 'PERSON' | 'EQUIPMENT' | 'TOOL' | 'LINE' | null;
  plant?: string | null;
  capacityHoursPerDay?: number | null;
  active?: boolean | null;
}

export interface SetupMatrixEntry extends BaseEntity {
  fromColor: string;
  toColor: string;
  setupMinutes: number;
  description?: string | null;
}

export interface CapacityBucket extends BaseEntity {
  bucketId: string;
  plantId?: string | null;
  lineId?: string | null;
  weekStarting?: string | null;
  totalCapacity?: number | null;
  allocatedCapacity?: number | null;
  remainingCapacity?: number | null;
  utilizationPercent?: number | null;
}

export interface PlanningHorizon extends BaseEntity {
  horizonId: string;
  horizonName: string;
  plant: string;
  planningArea: string;
  scopeType: 'MATERIAL' | 'MATERIAL_GROUP' | 'PRODUCT_FAMILY' | 'PACKAGING_LINE' | 'WORK_CENTER' | 'PLANT' | 'PLANNING_AREA';
  scopeValue: string;
  horizonType: 'FROZEN' | 'FIXED' | 'FLEXIBLE' | 'FORECAST';
  startOffsetDays: number;
  endOffsetDays: number;
  isEditable?: boolean | null;
  isAutoSchedulable?: boolean | null;
  allowRescheduling?: boolean | null;
  priority?: number | null;
  validFrom?: string | null;
  validTo?: string | null;
  description?: string | null;
}

export interface WorkCenter extends BaseEntity {
  workCenterId: string;
  workCenterName?: string | null;
  plantId?: string | null;
  type?: 'PROCESS' | 'PACKAGING' | 'QC' | null;
  isBottleneck?: boolean | null;
  capacityHoursPerDay?: number | null;
  capacityUnitsPerDay?: number | null;
  performanceFactor?: number | null;
  active?: boolean | null;
}

export interface PackagingLine extends BaseEntity {
  lineId: string;
  lineName?: string | null;
  plantId?: string | null;
  capacityUnitsPerDay?: number | null;
  shiftPattern?: string | null;
  active?: boolean | null;
  performanceFactor?: number | null;
}

export interface ShiftCalendar extends BaseEntity {
  lineId: string;
  weekStarting: string;
  availableHours?: number | null;
  maxUnitsPerDay?: number | null;
}

export interface PlanningException extends BaseEntity {
  exceptionId: string;
  type?: string | null;
  typeLabel?: string | null;
  packagingOrderId?: string | null;
  destinationCountry?: string | null;
  batchId?: string | null;
  status?: 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'CLOSED' | null;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null;
  message?: string | null;
}

export interface PlanningResult extends BaseEntity {
  resultId: string;
  scheduleType?: 'LINE_SEQUENCING' | 'DETAILED_SCHEDULING' | 'OPERATIONS' | 'WHAT_IF' | null;
  label?: string | null;
  status?: 'DRAFT' | 'READY' | 'CONFIRMED' | 'SUPERSEDED' | null;
  itemCount?: number | null;
  kpisSummary?: string | null;
  applicablePlanningHorizon?: string | null;
  horizonType?: 'FROZEN' | 'FIXED' | 'FLEXIBLE' | 'FORECAST' | 'OUT_OF_HORIZON' | null;
  horizonViolation?: boolean | null;
  reschedulingAllowed?: boolean | null;
  optimizationAllowed?: boolean | null;
}

export type DomainEntity =
  | PlanningOrder
  | Operation
  | Component
  | Material
  | Batch
  | TricCase
  | InspectionLot
  | Resource
  | SetupMatrixEntry
  | CapacityBucket
  | PlanningHorizon
  | WorkCenter
  | PackagingLine
  | ShiftCalendar
  | PlanningException
  | PlanningResult;
