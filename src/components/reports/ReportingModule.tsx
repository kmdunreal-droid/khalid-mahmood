import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import {
  Calendar,
  Clock,
  FileDown,
  FileSpreadsheet,
  Fuel,
  Gauge,
  Lock,
  MessageSquare,
  PackageCheck,
  Printer,
  Search,
  TrendingUp,
  UserCheck,
  Wrench,
} from 'lucide-react';
import { db, DEFAULT_STATION_ID } from '../../firebase';
import { INITIAL_ACCOUNTING_TRANSACTIONS } from '../../data/accountingSeedData';
import {
  AccountingBookType,
  AccountingEntryCategory,
  AccountingPaymentMode,
  AccountingTransactionRecord,
  CashFlowDirection,
  ExpenseCategory,
} from '../../data/accountingTypes';
import {
  INITIAL_DELIVERIES,
  INITIAL_PURCHASE_ORDERS,
  INITIAL_SUPPLIER_INVOICES,
} from '../../data/purchaseSeedData';
import {
  FuelDeliveryRecord,
  PurchaseOrderRecord,
  SupplierInvoiceRecord,
} from '../../data/purchaseTypes';
import { INITIAL_SALES_TRANSACTIONS } from '../../data/salesSeedData';
import { SalesTransactionRecord } from '../../data/salesTypes';
import { INITIAL_SHIFTS } from '../../data/shiftSeedData';
import { ActiveRolePersona, ShiftRecord } from '../../data/shiftTypes';
import { inferFuelFamily, INITIAL_STOCK_PRODUCTS, INITIAL_STORAGE_TANKS } from '../../data/stockSeedData';
import { StorageTankStock } from '../../data/stockTypes';
import { handleFirestoreError, OperationType } from '../../utils/firestoreErrors';
import {
  buildReportPayload,
  ReportKind,
} from '../../utils/reportBuilders';
import {
  exportReportToExcel,
  exportReportToPdf,
  printCurrentReport,
} from '../../utils/reportExporter';
import { useFirebaseAuth } from '../auth/FirebaseProvider';
import { WhatsAppShareModal } from './WhatsAppShareModal';

const REPORT_TABS: {
  id: ReportKind;
  label: string;
  icon: React.ReactNode;
  minRole: 'OPERATOR' | 'MANAGER' | 'OWNER';
}[] = [
  { id: 'daily', label: 'Daily Report', icon: <Calendar className="w-3.5 h-3.5" />, minRole: 'MANAGER' },
  { id: 'shift', label: 'Shift Report', icon: <Clock className="w-3.5 h-3.5" />, minRole: 'OPERATOR' },
  { id: 'operator', label: 'Operator Report', icon: <UserCheck className="w-3.5 h-3.5" />, minRole: 'MANAGER' },
  { id: 'machine', label: 'Machine Report', icon: <Wrench className="w-3.5 h-3.5" />, minRole: 'MANAGER' },
  { id: 'purchase', label: 'Purchase Report', icon: <PackageCheck className="w-3.5 h-3.5" />, minRole: 'MANAGER' },
  { id: 'sales', label: 'Sales Report', icon: <Fuel className="w-3.5 h-3.5" />, minRole: 'MANAGER' },
  { id: 'stock', label: 'Stock Report', icon: <Gauge className="w-3.5 h-3.5" />, minRole: 'MANAGER' },
  { id: 'profit', label: 'Profit Report', icon: <TrendingUp className="w-3.5 h-3.5" />, minRole: 'OWNER' },
];

export const ReportingModule: React.FC = () => {
  const {
    authReady,
    firebaseUser,
    userProfile,
    isBootstrappedOwner,
    activeRole: rolePersona,
  } = useFirebaseAuth();
  const authenticatedRole: ActiveRolePersona | null =
    userProfile?.role ?? (isBootstrappedOwner ? 'OWNER' : null);

  const [activeReport, setActiveReport] = useState<ReportKind>('daily');
  const [dateFilter, setDateFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showWhatsAppModal, setShowWhatsAppModal] = useState<boolean>(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const [shifts, setShifts] = useState<ShiftRecord[]>(INITIAL_SHIFTS);
  const [sales, setSales] = useState<SalesTransactionRecord[]>(INITIAL_SALES_TRANSACTIONS);
  const [purchaseOrders, setPurchaseOrders] =
    useState<PurchaseOrderRecord[]>(INITIAL_PURCHASE_ORDERS);
  const [deliveries, setDeliveries] = useState<FuelDeliveryRecord[]>(INITIAL_DELIVERIES);
  const [invoices, setInvoices] = useState<SupplierInvoiceRecord[]>(INITIAL_SUPPLIER_INVOICES);
  const [tanks, setTanks] = useState<StorageTankStock[]>(INITIAL_STORAGE_TANKS);
  const [accountingTransactions, setAccountingTransactions] = useState<
    AccountingTransactionRecord[]
  >(INITIAL_ACCOUNTING_TRANSACTIONS);

  // Auto-route Operator to Shift Report per RBAC
  useEffect(() => {
    if (rolePersona === 'OPERATOR' && activeReport !== 'shift') {
      setActiveReport('shift');
    }
  }, [rolePersona, activeReport]);

  const effectiveStationId = userProfile?.stationId || DEFAULT_STATION_ID;
  const isLiveCloudActive = Boolean(authReady && firebaseUser && authenticatedRole);

  useEffect(() => {
    if (!isLiveCloudActive || !firebaseUser) return;

    const shiftsPath = `stations/${effectiveStationId}/shifts`;
    const shiftsQuery =
      authenticatedRole === 'OPERATOR'
        ? query(
            collection(db, 'stations', effectiveStationId, 'shifts'),
            where('operatorUid', '==', firebaseUser.uid)
          )
        : collection(db, 'stations', effectiveStationId, 'shifts');

    const unsubShifts = onSnapshot(
      shiftsQuery,
      (snap) => {
        if (snap.empty) return;
        const mapped: ShiftRecord[] = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          const seedMatch = INITIAL_SHIFTS.find(
            (s) => s.id === d.id || s.shiftCode === String(data.shiftCode ?? '')
          );
          if (seedMatch) {
            return {
              ...seedMatch,
              id: d.id,
              status: (data.status as ShiftRecord['status']) ?? seedMatch.status,
              openingCashFloat: Number(data.openingCashFloat ?? seedMatch.openingCashFloat),
            };
          }
          const shiftType = (data.shiftType as ShiftRecord['shiftType']) ?? 'DAY';
          return {
            id: d.id,
            shiftCode: String(data.shiftCode ?? d.id),
            businessDate: String(data.businessDate ?? '2026-11-23'),
            shiftType,
            timeWindow: shiftType === 'DAY' ? '06:00 – 18:00' : '18:00 – 06:00',
            supervisorName: 'Station Manager',
            status: (data.status as ShiftRecord['status']) ?? 'OPEN',
            openingCashFloat: Number(data.openingCashFloat ?? 5000),
            nozzles: [],
            tenders: {
              upiAmount: 0,
              cardAmount: 0,
              creditSlipAmount: 0,
              denominations: {
                n500: Math.floor(Number(data.actualCashCollected ?? 0) / 500),
                n200: 0,
                n100: 0,
                n50: 0,
                n20: 0,
                n10: 0,
                coins: Number(data.actualCashCollected ?? 0) % 500,
              },
            },
            expenses: [],
            handover: {
              outgoingOperator: 'Attendant',
              incomingOperator: 'Next Shift',
              cashBagSealNo: String(data.cashBagSealNo ?? 'PENDING'),
              checklist: {
                cashCountVerified: true,
                dipStickRecorded: true,
                creditSlipsBundled: true,
                dispenserSealsIntact: true,
              },
              remarks: '',
              handedOverAt: null,
            },
            approval: {
              managerName: 'Station Manager',
              decision: data.status === 'APPROVED' ? 'APPROVED' : 'PENDING',
              verifiedCashCount: Number(data.actualCashCollected ?? 0),
              auditNotes: '',
              reviewedAt: null,
            },
            notifications: [],
          };
        });
        setShifts(mapped);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, shiftsPath)
    );

    const salesPath = `stations/${effectiveStationId}/sales`;
    const salesQuery =
      authenticatedRole === 'OPERATOR'
        ? query(
            collection(db, 'stations', effectiveStationId, 'sales'),
            where('operatorUid', '==', firebaseUser.uid)
          )
        : collection(db, 'stations', effectiveStationId, 'sales');

    const unsubSales = onSnapshot(
      salesQuery,
      (snap) => {
        if (snap.empty) return;
        const rows: SalesTransactionRecord[] = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            stationId: String(data.stationId ?? effectiveStationId),
            shiftId: String(data.shiftId ?? 'shf-20261123-day'),
            dispenserCode: String(data.dispenserCode ?? 'MPD-01'),
            nozzleCode: String(data.nozzleCode ?? 'N1-MS'),
            productName: String(data.productName ?? 'Unleaded Petrol (MS)'),
            gradeCode: String(data.gradeCode ?? 'MS-91'),
            quantityLitres: Number(data.quantityLitres ?? 0),
            unitSellingPrice: Number(data.unitSellingPrice ?? 0),
            unitCostPrice: Number(data.unitCostPrice ?? 0),
            grossProfit: Number(data.grossProfit ?? 0),
            operatorUid: String(data.operatorUid ?? ''),
            operatorName: String(data.operatorName ?? 'Attendant'),
            customerId: data.customerId ? String(data.customerId) : undefined,
            customerName: data.customerName ? String(data.customerName) : undefined,
            receiptNumber: String(data.receiptNumber ?? d.id),
            paymentMode: (data.paymentMode as SalesTransactionRecord['paymentMode']) ?? 'CASH',
            paymentReference: data.paymentReference ? String(data.paymentReference) : undefined,
            vehicleNo: data.vehicleNo ? String(data.vehicleNo) : undefined,
            totalAmount: Number(data.totalAmount ?? 0),
            status: (data.status as SalesTransactionRecord['status']) ?? 'POSTED',
            soldDate: String(data.soldDate ?? '2026-11-23'),
            soldTimeLabel: '09:00',
          };
        });
        setSales(rows);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, salesPath)
    );

    const tanksPath = `stations/${effectiveStationId}/tanks`;
    const unsubTanks = onSnapshot(
      collection(db, 'stations', effectiveStationId, 'tanks'),
      (snap) => {
        if (snap.empty) return;
        const rows: StorageTankStock[] = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          const tankCode = String(data.tankCode ?? d.id);
          const productId = String(data.productId ?? 'prod-ms-91');
          const seedTank = INITIAL_STORAGE_TANKS.find(
            (t) => t.id === d.id || t.tankCode === tankCode
          );
          const seedProd = INITIAL_STOCK_PRODUCTS.find((p) => p.id === productId);
          const gradeCode = seedTank?.gradeCode ?? seedProd?.sku ?? 'MS-91';
          const productName = seedTank?.productName ?? seedProd?.name ?? 'Motor Fuel';
          return {
            id: d.id,
            stationId: String(data.stationId ?? effectiveStationId),
            productId,
            tankCode,
            tankLabel: seedTank?.tankLabel ?? `Underground Tank ${tankCode}`,
            fuelFamily: inferFuelFamily(`${gradeCode} ${productName}`),
            gradeCode,
            productName,
            capacityLitres: Number(data.capacityLitres ?? 20000),
            currentBookStockLitres: Number(data.currentBookStockLitres ?? 0),
            lastDipStockLitres: Number(data.lastDipStockLitres ?? 0),
            minThresholdLitres: Number(data.minThresholdLitres ?? 3000),
            lastDipMm: seedTank?.lastDipMm ?? 0,
            lastWaterDipMm: seedTank?.lastWaterDipMm ?? 0,
            densityAt15C: seedTank?.densityAt15C ?? 0.742,
            updatedAtLabel: 'Live',
          };
        });
        rows.sort((a, b) => a.tankCode.localeCompare(b.tankCode));
        setTanks(rows);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, tanksPath)
    );

    const extraUnsubs: (() => void)[] = [];
    if (authenticatedRole === 'OWNER' || authenticatedRole === 'MANAGER') {
      extraUnsubs.push(
        onSnapshot(
          collection(db, 'stations', effectiveStationId, 'purchaseOrders'),
          (snap) => {
            if (snap.empty) return;
            setPurchaseOrders(
              snap.docs.map((d) => {
                const data = d.data() as Record<string, unknown>;
                let items: PurchaseOrderRecord['items'] = [];
                try {
                  items = JSON.parse(String(data.itemsJson ?? '[]'));
                } catch {
                  items = [];
                }
                return {
                  id: d.id,
                  stationId: String(data.stationId ?? effectiveStationId),
                  supplierId: String(data.supplierId ?? ''),
                  supplierName: String(data.supplierName ?? ''),
                  poNumber: String(data.poNumber ?? d.id),
                  orderDate: String(data.orderDate ?? ''),
                  expectedDeliveryDate: String(data.expectedDeliveryDate ?? ''),
                  primaryFuelGrade: String(data.primaryFuelGrade ?? ''),
                  totalOrderedLitres: Number(data.totalOrderedLitres ?? 0),
                  receivedLitres: Number(data.receivedLitres ?? 0),
                  items,
                  notes: String(data.notes ?? ''),
                  status: (data.status as PurchaseOrderRecord['status']) ?? 'ORDERED',
                  totalEstimatedAmount: Number(data.totalEstimatedAmount ?? 0),
                  createdByUid: String(data.createdByUid ?? ''),
                };
              })
            );
          },
          (err) =>
            handleFirestoreError(
              err,
              OperationType.LIST,
              `stations/${effectiveStationId}/purchaseOrders`
            )
        )
      );

      extraUnsubs.push(
        onSnapshot(
          collection(db, 'stations', effectiveStationId, 'deliveries'),
          (snap) => {
            if (snap.empty) return;
            setDeliveries(
              snap.docs.map((d) => {
                const data = d.data() as Record<string, unknown>;
                return {
                  id: d.id,
                  stationId: String(data.stationId ?? effectiveStationId),
                  poId: data.poId ? String(data.poId) : undefined,
                  poNumber: data.poNumber ? String(data.poNumber) : undefined,
                  supplierId: String(data.supplierId ?? ''),
                  supplierName: String(data.supplierName ?? ''),
                  invoiceNumber: String(data.invoiceNumber ?? ''),
                  deliveryDate: String(data.deliveryDate ?? ''),
                  tankerRegNo: String(data.tankerRegNo ?? ''),
                  driverName: String(data.driverName ?? ''),
                  productName: String(data.productName ?? ''),
                  targetTankCode: String(data.targetTankCode ?? ''),
                  invoicedQtyLitres: Number(data.invoicedQtyLitres ?? 0),
                  receivedQtyLitres: Number(data.receivedQtyLitres ?? 0),
                  shortageLitres: Number(data.shortageLitres ?? 0),
                  densityObserved: Number(data.densityObserved ?? 0),
                  temperatureC: Number(data.temperatureC ?? 0),
                  waterDipMm: Number(data.waterDipMm ?? 0),
                  totalInvoiceAmount: Number(data.totalInvoiceAmount ?? 0),
                  status: (data.status as FuelDeliveryRecord['status']) ?? 'POSTED',
                  verifiedByUid: String(data.verifiedByUid ?? ''),
                };
              })
            );
          },
          (err) =>
            handleFirestoreError(
              err,
              OperationType.LIST,
              `stations/${effectiveStationId}/deliveries`
            )
        )
      );

      extraUnsubs.push(
        onSnapshot(
          collection(db, 'stations', effectiveStationId, 'supplierInvoices'),
          (snap) => {
            if (snap.empty) return;
            setInvoices(
              snap.docs.map((d) => {
                const data = d.data() as Record<string, unknown>;
                return {
                  id: d.id,
                  stationId: String(data.stationId ?? effectiveStationId),
                  supplierId: String(data.supplierId ?? ''),
                  supplierName: String(data.supplierName ?? ''),
                  poId: data.poId ? String(data.poId) : undefined,
                  deliveryId: data.deliveryId ? String(data.deliveryId) : undefined,
                  invoiceNumber: String(data.invoiceNumber ?? ''),
                  invoiceDate: String(data.invoiceDate ?? ''),
                  dueDate: String(data.dueDate ?? ''),
                  subtotalAmount: Number(data.subtotalAmount ?? 0),
                  taxAmount: Number(data.taxAmount ?? 0),
                  totalAmount: Number(data.totalAmount ?? 0),
                  paidAmount: Number(data.paidAmount ?? 0),
                  paymentStatus:
                    (data.paymentStatus as SupplierInvoiceRecord['paymentStatus']) ?? 'UNPAID',
                  recordedByUid: String(data.recordedByUid ?? ''),
                };
              })
            );
          },
          (err) =>
            handleFirestoreError(
              err,
              OperationType.LIST,
              `stations/${effectiveStationId}/supplierInvoices`
            )
        )
      );

      extraUnsubs.push(
        onSnapshot(
          collection(db, 'stations', effectiveStationId, 'accountingTransactions'),
          (snap) => {
            if (snap.empty) return;
            setAccountingTransactions(
              snap.docs.map((d) => {
                const data = d.data() as Record<string, unknown>;
                return {
                  id: d.id,
                  stationId: String(data.stationId ?? effectiveStationId),
                  bookType: (data.bookType as AccountingBookType) ?? 'CASH',
                  entryCategory:
                    (data.entryCategory as AccountingEntryCategory) ?? 'OPERATING_EXPENSE',
                  direction: (data.direction as CashFlowDirection) ?? 'OUTFLOW',
                  txDate: String(data.txDate ?? '2026-11-23'),
                  voucherNo: String(data.voucherNo ?? d.id),
                  accountName: String(data.accountName ?? 'Station Cash Chest'),
                  partyOrVendor: String(data.partyOrVendor ?? ''),
                  expenseCategory: data.expenseCategory
                    ? (data.expenseCategory as ExpenseCategory)
                    : undefined,
                  paymentMode: (data.paymentMode as AccountingPaymentMode) ?? 'CASH',
                  amount: Number(data.amount ?? 0),
                  referenceNo: String(data.referenceNo ?? ''),
                  description: data.description ? String(data.description) : undefined,
                  approvalStatus:
                    (data.approvalStatus as AccountingTransactionRecord['approvalStatus']) ??
                    'APPROVED',
                  recordedByUid: String(data.recordedByUid ?? ''),
                  recordedByName: 'Station Accountant',
                  createdAtLabel: 'Live',
                };
              })
            );
          },
          (err) =>
            handleFirestoreError(
              err,
              OperationType.LIST,
              `stations/${effectiveStationId}/accountingTransactions`
            )
        )
      );
    }

    return () => {
      unsubShifts();
      unsubSales();
      unsubTanks();
      extraUnsubs.forEach((u) => u());
    };
  }, [isLiveCloudActive, firebaseUser, authenticatedRole, effectiveStationId]);

  const availableDates = useMemo(() => {
    const dateSet = new Set<string>(['2026-11-23', '2026-11-22', '2026-11-21']);
    shifts.forEach((s) => dateSet.add(s.businessDate));
    sales.forEach((s) => dateSet.add(s.soldDate));
    return Array.from(dateSet).sort((a, b) => b.localeCompare(a));
  }, [shifts, sales]);

  const isReportPermitted = (kind: ReportKind): boolean => {
    if (rolePersona === 'OWNER') return true;
    if (rolePersona === 'MANAGER') return kind !== 'profit';
    return kind === 'shift';
  };

  const baseReport = useMemo(
    () =>
      buildReportPayload(activeReport, {
        stationLabel: `Highway Meridian Fuels (${effectiveStationId})`,
        dateFilter,
        shifts,
        sales,
        purchaseOrders,
        deliveries,
        invoices,
        tanks,
        accountingTransactions,
      }),
    [
      activeReport,
      effectiveStationId,
      dateFilter,
      shifts,
      sales,
      purchaseOrders,
      deliveries,
      invoices,
      tanks,
      accountingTransactions,
    ]
  );

  const visibleReport = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return baseReport;
    const filteredRows = baseReport.rows.filter((row) =>
      Object.values(row).some((val) => String(val).toLowerCase().includes(q))
    );
    return {
      ...baseReport,
      rows: filteredRows,
    };
  }, [baseReport, searchQuery]);

  const handleExportPdf = () => {
    exportReportToPdf(visibleReport);
    setExportNotice(`Downloaded ${visibleReport.title} as PDF.`);
    setTimeout(() => setExportNotice(null), 3000);
  };

  const handleExportExcel = () => {
    exportReportToExcel(visibleReport);
    setExportNotice(`Downloaded ${visibleReport.title} as Excel (.xlsx).`);
    setTimeout(() => setExportNotice(null), 3000);
  };

  const handlePrint = () => {
    printCurrentReport();
  };

  const permittedNow = isReportPermitted(activeReport);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 no-print">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Reports & Exports
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Daily, Shift, Operator, Machine, Purchase, Sales, Stock, and Profit reports
            </p>
          </div>
          {exportNotice && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              {exportNotice}
            </span>
          )}
        </div>
      </div>

      {/* 8 Report Selector Tabs */}
      <div className="bg-slate-200/70 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1 flex flex-wrap gap-1 w-fit max-w-full overflow-x-auto no-print">
        {REPORT_TABS.map((tab) => {
          const isActive = activeReport === tab.id;
          const allowed = isReportPermitted(tab.id);
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveReport(tab.id)}
              className={`min-h-[38px] inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : allowed
                  ? 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  : 'text-slate-400 dark:text-slate-600'
              }`}
            >
              {allowed ? tab.icon : <Lock className="w-3.5 h-3.5" />}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {!permittedNow ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center space-y-3">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 mx-auto">
            <Lock className="w-5 h-5" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            {REPORT_TABS.find((t) => t.id === activeReport)?.label} Restricted
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
            {rolePersona === 'MANAGER'
              ? 'Profit margin reports are restricted to the Station Owner.'
              : 'Operators can export and print their Shift Report.'}
          </p>
        </div>
      ) : (
        <>
          {/* Filter + Export Actions Toolbar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 no-print">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="min-h-[38px] px-3 py-1.5 text-xs font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  aria-label="Filter report by business date"
                >
                  <option value="ALL">All Dates</option>
                  {availableDates.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search report..."
                  className="w-full min-h-[38px] pl-8 pr-3 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white placeholder:text-slate-400"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleExportPdf}
                className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg whitespace-nowrap"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>PDF</span>
              </button>

              <button
                type="button"
                onClick={handleExportExcel}
                className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 whitespace-nowrap"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Excel</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 whitespace-nowrap"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>

              <button
                type="button"
                onClick={() => setShowWhatsAppModal(true)}
                className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg whitespace-nowrap"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </button>
            </div>
          </div>

          {/* Printable Report Document Surface */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">{visibleReport.title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {visibleReport.stationLabel} · {visibleReport.subtitle}
                </p>
              </div>
              <div className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                Generated {visibleReport.generatedAt}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
              {visibleReport.summaryMetrics.map((metric) => (
                <div key={metric.label} className="p-4">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">{metric.label}</div>
                  <div className="text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
                    {metric.value}
                  </div>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-[11px]">
                    {visibleReport.columns.map((col) => (
                      <th
                        key={col.key}
                        className={`py-3 px-4 font-semibold ${
                          col.align === 'right' ? 'text-right' : 'text-left'
                        }`}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {visibleReport.rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={visibleReport.columns.length}
                        className="py-8 px-4 text-center text-slate-500 dark:text-slate-400"
                      >
                        No records match the selected filter.
                      </td>
                    </tr>
                  ) : (
                    visibleReport.rows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        {visibleReport.columns.map((col, colIdx) => (
                          <td
                            key={col.key}
                            className={`py-2.5 px-4 ${
                              col.align === 'right'
                                ? 'text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white'
                                : colIdx === 0
                                ? 'font-mono font-medium text-slate-900 dark:text-slate-100'
                                : 'text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {String(row[col.key] ?? '—')}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {showWhatsAppModal && (
        <WhatsAppShareModal
          report={visibleReport}
          onClose={() => setShowWhatsAppModal(false)}
        />
      )}
    </div>
  );
};
