export type ShiftPeriodType = 'DAY' | 'NIGHT';

export type ShiftWorkflowStatus = 'OPEN' | 'HANDED_OVER' | 'APPROVED' | 'REJECTED';

export type ActiveRolePersona = 'OPERATOR' | 'MANAGER' | 'OWNER';

export type ExpenseCategory =
  | 'GENERATOR_FUEL'
  | 'UTILITIES'
  | 'MAINTENANCE'
  | 'STAFF_WELFARE'
  | 'CLEANING';

export interface NozzleReading {
  nozzleId: string;
  nozzleCode: string;
  dispenserCode: string;
  productName: string;
  sku: string;
  unitPrice: number;
  operatorName: string;
  openingReading: number;
  closingReading: number;
  testingLitres: number;
}

export interface CashDenominations {
  n5000?: number;
  n1000?: number;
  n500: number;
  n200?: number;
  n100: number;
  n50: number;
  n20: number;
  n10: number;
  coins: number;
}

export interface ShiftTenders {
  upiAmount: number;
  cardAmount: number;
  creditSlipAmount: number;
  denominations: CashDenominations;
}

export interface ShiftExpense {
  id: string;
  category: ExpenseCategory;
  vendor: string;
  description: string;
  amount: number;
  paidFromCashDrawer: boolean;
  receiptRef: string;
  recordedBy: string;
  recordedAt: string;
}

export interface ShiftHandoverInfo {
  outgoingOperator: string;
  incomingOperator: string;
  cashBagSealNo: string;
  checklist: {
    cashCountVerified: boolean;
    dipStickRecorded: boolean;
    creditSlipsBundled: boolean;
    dispenserSealsIntact: boolean;
  };
  remarks: string;
  handedOverAt: string | null;
}

export interface ManagerApprovalInfo {
  managerName: string;
  decision: 'PENDING' | 'APPROVED' | 'REJECTED';
  verifiedCashCount: number | null;
  auditNotes: string;
  reviewedAt: string | null;
}

export interface ShiftRecord {
  id: string;
  shiftCode: string;
  businessDate: string;
  shiftType: ShiftPeriodType;
  timeWindow: string;
  supervisorName: string;
  status: ShiftWorkflowStatus;
  openingCashFloat: number;
  nozzles: NozzleReading[];
  tenders: ShiftTenders;
  expenses: ShiftExpense[];
  handover: ShiftHandoverInfo;
  approval: ManagerApprovalInfo;
}

export interface OwnerNotification {
  id: string;
  shiftId: string;
  shiftCode: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  eventType:
    | 'CASH_VARIANCE'
    | 'EXPENSE_THRESHOLD'
    | 'SHIFT_HANDOVER'
    | 'MANAGER_APPROVED'
    | 'MANAGER_REJECTED';
  title: string;
  message: string;
  metricSummary: string;
  createdAt: string;
  isRead: boolean;
}

export interface OwnerAlertThresholds {
  cashVarianceLimit: number;
  singleExpenseAlertLimit: number;
}
