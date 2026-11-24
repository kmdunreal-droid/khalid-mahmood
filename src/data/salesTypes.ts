export type SalePaymentMode = 'CASH' | 'CARD' | 'UPI' | 'CREDIT' | 'FLEET_CARD';

export type SaleTransactionStatus = 'POSTED' | 'VOIDED';

export interface DispenserMachineSpec {
  dispenserCode: string;
  islandName: string;
  hardwareModel: string;
  nozzleCodes: string[];
  status: 'ONLINE' | 'CALIBRATING';
}

export interface NozzleRateConfig {
  nozzleCode: string;
  dispenserCode: string;
  productName: string;
  gradeCode: string;
  operatorName: string;
  openingMeter: number;
  unitSellingPrice: number;
  unitCostPrice: number;
}

export interface CreditCustomerAccount {
  id: string;
  stationId: string;
  accountCode: string;
  companyName: string;
  creditLimit: number;
  currentBalance: number;
  status: 'ACTIVE' | 'HOLD' | 'SUSPENDED';
  whitelistedVehicles: string[];
}

export interface SalesTransactionRecord {
  id: string;
  stationId: string;
  shiftId: string;
  dispenserCode: string;
  nozzleCode: string;
  productName: string;
  gradeCode: string;
  quantityLitres: number;
  unitSellingPrice: number;
  unitCostPrice: number;
  grossProfit: number;
  operatorUid: string;
  operatorName: string;
  customerId?: string;
  customerName?: string;
  receiptNumber: string;
  paymentMode: SalePaymentMode;
  paymentReference?: string;
  vehicleNo?: string;
  totalAmount: number;
  status: SaleTransactionStatus;
  soldDate: string;
  soldTimeLabel: string;
}

export interface ProfitAssumptions {
  costByGrade: Record<string, number>;
  onlineMdrPct: number;
  dailyOperatingOverhead: number;
}
