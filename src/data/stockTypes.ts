export type FuelFamily = 'PETROL' | 'DIESEL';

export type DipReadingType =
  | 'SHIFT_OPEN'
  | 'SHIFT_CLOSE'
  | 'PRE_DECANT'
  | 'POST_DECANT'
  | 'AUDIT';

export type StockDirection = 'IN' | 'OUT';

export type StockMovementType =
  | 'TANKER_DECANT'
  | 'NOZZLE_SALES'
  | 'TESTING_RETURN'
  | 'EVAPORATION_LOSS'
  | 'STOCK_ADJUSTMENT';

export type AlertSeverity = 'CRITICAL' | 'WARNING' | 'NOMINAL';

export interface FuelProductStock {
  id: string;
  stationId: string;
  sku: string;
  name: string;
  fuelFamily: FuelFamily;
  category: 'FUEL' | 'LUBRICANT' | 'ADDITIVE';
  unit: 'LITRE' | 'KG' | 'BOTTLE';
  currentSellingPrice: number;
  taxRatePct: number;
  reorderLevel: number;
  avgDailyOutflowLitres: number;
  updatedAtLabel: string;
}

export interface StorageTankStock {
  id: string;
  stationId: string;
  productId: string;
  tankCode: string;
  tankLabel: string;
  fuelFamily: FuelFamily;
  gradeCode: string;
  productName: string;
  capacityLitres: number;
  currentBookStockLitres: number;
  lastDipStockLitres: number;
  minThresholdLitres: number;
  lastDipMm: number;
  lastWaterDipMm: number;
  densityAt15C: number;
  updatedAtLabel: string;
}

export interface TankDipReadingRecord {
  id: string;
  tankId: string;
  tankCode: string;
  gradeCode: string;
  shiftId?: string;
  recordedByUid: string;
  recordedByName: string;
  readingType: DipReadingType;
  dipMm: number;
  waterDipMm: number;
  calculatedVolumeLitres: number;
  bookStockLitres: number;
  varianceLitres: number;
  recordedAtLabel: string;
}

export interface StockMovementRecord {
  id: string;
  stationId: string;
  tankId: string;
  tankCode: string;
  productId: string;
  productName: string;
  gradeCode: string;
  fuelFamily: FuelFamily;
  direction: StockDirection;
  movementType: StockMovementType;
  quantityLitres: number;
  balanceAfterLitres: number;
  referenceNo: string;
  densityObserved?: number;
  notes?: string;
  recordedByUid: string;
  recordedByName: string;
  movementDate: string;
  createdAtLabel: string;
}

export interface LowStockAlertItem {
  tank: StorageTankStock;
  product: FuelProductStock | undefined;
  severity: AlertSeverity;
  fillPct: number;
  ullageLitres: number;
  shortfallLitres: number;
  estimatedDaysRemaining: number;
  recommendedOrderLitres: number;
}
