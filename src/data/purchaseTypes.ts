export type SupplierCategory = 'OMC_FUEL' | 'LUBRICANT' | 'ADDITIVE' | 'EQUIPMENT';

export type SupplierStatus = 'ACTIVE' | 'ON_HOLD' | 'INACTIVE';

export interface SupplierRecord {
  id: string;
  stationId: string;
  supplierCode: string;
  name: string;
  category: SupplierCategory;
  gstNumber: string;
  contactPerson: string;
  phone: string;
  email: string;
  depotLocation: string;
  paymentTermsDays: number;
  creditLimit: number;
  outstandingBalance: number;
  status: SupplierStatus;
}

export type PurchaseOrderStatus = 'DRAFT' | 'ORDERED' | 'PARTIAL' | 'RECEIVED' | 'CANCELLED';

export interface PurchaseOrderItem {
  productName: string;
  gradeCode: string;
  orderedLitres: number;
  unitRate: number;
  taxPct: number;
  lineTotal: number;
}

export interface PurchaseOrderRecord {
  id: string;
  stationId: string;
  supplierId: string;
  supplierName: string;
  poNumber: string;
  orderDate: string;
  expectedDeliveryDate: string;
  primaryFuelGrade: string;
  totalOrderedLitres: number;
  receivedLitres: number;
  items: PurchaseOrderItem[];
  notes: string;
  status: PurchaseOrderStatus;
  totalEstimatedAmount: number;
  createdByUid: string;
  approvedByUid?: string;
}

export type FuelDeliveryStatus = 'PENDING' | 'DECANTED' | 'POSTED';

export interface FuelDeliveryRecord {
  id: string;
  stationId: string;
  poId?: string;
  poNumber?: string;
  supplierId: string;
  supplierName: string;
  invoiceNumber: string;
  deliveryDate: string;
  tankerRegNo: string;
  driverName: string;
  productName: string;
  targetTankCode: string;
  invoicedQtyLitres: number;
  receivedQtyLitres: number;
  shortageLitres: number;
  densityObserved: number;
  temperatureC: number;
  waterDipMm: number;
  totalInvoiceAmount: number;
  status: FuelDeliveryStatus;
  verifiedByUid: string;
}

export type SupplierInvoiceStatus = 'UNPAID' | 'PARTIAL' | 'PAID';

export interface SupplierInvoiceRecord {
  id: string;
  stationId: string;
  supplierId: string;
  supplierName: string;
  poId?: string;
  deliveryId?: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  paymentStatus: SupplierInvoiceStatus;
  recordedByUid: string;
}

export type SupplierPaymentMode = 'RTGS' | 'NEFT' | 'CHEQUE' | 'UPI' | 'CASH';

export interface SupplierPaymentRecord {
  id: string;
  stationId: string;
  supplierId: string;
  supplierName: string;
  invoiceId: string;
  invoiceNumber: string;
  paymentRef: string;
  paymentDate: string;
  paymentMode: SupplierPaymentMode;
  amount: number;
  notes: string;
  recordedByUid: string;
}

export const FUEL_TANK_OPTIONS = [
  { tankCode: 'T-01', productName: 'Motor Spirit (Petrol MS)', gradeCode: 'MS', capacityLitres: 20000, currentStockLitres: 12450, defaultRate: 88.4, defaultDensity: 0.742 },
  { tankCode: 'T-02', productName: 'High Speed Diesel (HSD)', gradeCode: 'HSD', capacityLitres: 35000, currentStockLitres: 18900, defaultRate: 81.2, defaultDensity: 0.831 },
  { tankCode: 'T-03', productName: 'XP95 Premium Petrol', gradeCode: 'XP95', capacityLitres: 15000, currentStockLitres: 6420, defaultRate: 94.8, defaultDensity: 0.748 },
  { tankCode: 'LUBE-STORE', productName: 'Castrol CRB Turbomax 15W-40', gradeCode: 'LUBE', capacityLitres: 5000, currentStockLitres: 1120, defaultRate: 265.0, defaultDensity: 0.875 },
];
