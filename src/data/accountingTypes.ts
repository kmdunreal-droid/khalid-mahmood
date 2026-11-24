export type AccountingBookType = 'CASH' | 'BANK' | 'CONTRA';

export type AccountingEntryCategory =
  | 'FUEL_SALES_RECEIPT'
  | 'CUSTOMER_PAYMENT'
  | 'SUPPLIER_PAYMENT'
  | 'OPERATING_EXPENSE'
  | 'BANK_DEPOSIT'
  | 'CASH_WITHDRAWAL'
  | 'OWNER_CAPITAL'
  | 'OTHER_INCOME';

export type CashFlowDirection = 'INFLOW' | 'OUTFLOW';

export type ExpenseCategory =
  | 'GENERATOR_FUEL'
  | 'UTILITIES'
  | 'MAINTENANCE'
  | 'STAFF_WELFARE'
  | 'SALARIES'
  | 'RENT'
  | 'CLEANING'
  | 'BANK_CHARGES';

export type AccountingPaymentMode =
  | 'CASH'
  | 'UPI'
  | 'CARD'
  | 'NEFT'
  | 'RTGS'
  | 'CHEQUE'
  | 'CONTRA';

export type ExpenseApprovalStatus = 'APPROVED' | 'PENDING_OWNER';

export interface AccountingTransactionRecord {
  id: string;
  stationId: string;
  bookType: AccountingBookType;
  entryCategory: AccountingEntryCategory;
  direction: CashFlowDirection;
  txDate: string;
  voucherNo: string;
  accountName: string;
  partyOrVendor: string;
  expenseCategory?: ExpenseCategory;
  paymentMode: AccountingPaymentMode;
  amount: number;
  referenceNo: string;
  description?: string;
  approvalStatus: ExpenseApprovalStatus;
  recordedByUid: string;
  recordedByName: string;
  createdAtLabel: string;
}

export interface CreditLedgerEntryRecord {
  id: string;
  customerId: string;
  stationId: string;
  txType: 'INVOICE_DEBIT' | 'PAYMENT_CREDIT' | 'ADJUSTMENT';
  amount: number;
  runningBalance: number;
  referenceId: string;
  notes: string;
  txDate: string;
}

export interface DoubleEntryJournalRecord {
  id: string;
  stationId: string;
  voucherNo: string;
  sourceModule: string;
  sourceId?: string;
  totalDebit: number;
  totalCredit: number;
  status: 'DRAFT' | 'POSTED' | 'REVERSED';
  postedByUid: string;
  createdAtLabel: string;
}

export interface PeriodRevenueBaseline {
  label: string;
  petrolMsRevenue: number;
  petrolXp95Revenue: number;
  dieselHsdRevenue: number;
  lubricantRevenue: number;
  petrolMsCogs: number;
  petrolXp95Cogs: number;
  dieselHsdCogs: number;
  lubricantCogs: number;
  priorPeriodExpenses: Record<ExpenseCategory, number>;
}
