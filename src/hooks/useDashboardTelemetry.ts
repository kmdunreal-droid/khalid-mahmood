import { useCallback, useEffect, useState } from 'react';
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { useFirebaseAuth } from '../components/auth/FirebaseProvider';
import {
  getAllOfflineSales,
  getAllOfflineShifts,
  storeOfflineSale,
  storeOfflineShift,
} from '../services/offlineStorage';
import { INITIAL_ACCOUNTING_TRANSACTIONS } from '../data/accountingSeedData';
import {
  AccountingBookType,
  AccountingEntryCategory,
  AccountingPaymentMode,
  AccountingTransactionRecord,
  CashFlowDirection,
  ExpenseCategory,
} from '../data/accountingTypes';
import {
  INITIAL_DELIVERIES,
  INITIAL_PURCHASE_ORDERS,
  INITIAL_SUPPLIER_INVOICES,
  INITIAL_SUPPLIERS,
} from '../data/purchaseSeedData';
import {
  FuelDeliveryRecord,
  PurchaseOrderRecord,
  SupplierInvoiceRecord,
  SupplierRecord,
} from '../data/purchaseTypes';
import {
  DEFAULT_PROFIT_ASSUMPTIONS,
  INITIAL_CREDIT_CUSTOMERS,
  INITIAL_NOZZLE_CONFIGS,
  INITIAL_SALES_TRANSACTIONS,
} from '../data/salesSeedData';
import {
  CreditCustomerAccount,
  SalePaymentMode,
  SalesTransactionRecord,
} from '../data/salesTypes';
import {
  INITIAL_OWNER_NOTIFICATIONS,
  INITIAL_SHIFTS,
} from '../data/shiftSeedData';
import {
  ActiveRolePersona,
  OwnerNotification,
  ShiftRecord,
} from '../data/shiftTypes';
import {
  inferFuelFamily,
  INITIAL_STOCK_PRODUCTS,
  INITIAL_STORAGE_TANKS,
} from '../data/stockSeedData';
import { StorageTankStock } from '../data/stockTypes';
import { db, DEFAULT_STATION_ID } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrors';
import { computeShiftSummary } from '../utils/shiftMath';

export interface QuickOperatorSaleInput {
  nozzleCode: string;
  quantityLitres: number;
  paymentMode: SalePaymentMode;
  vehicleNo?: string;
  paymentReference?: string;
}

export interface DashboardTelemetryState {
  isLiveCloud: boolean;
  stationId: string;
  stationName: string;
  authenticatedRole: ActiveRolePersona | null;
  shifts: ShiftRecord[];
  sales: SalesTransactionRecord[];
  tanks: StorageTankStock[];
  purchaseOrders: PurchaseOrderRecord[];
  deliveries: FuelDeliveryRecord[];
  invoices: SupplierInvoiceRecord[];
  suppliers: SupplierRecord[];
  creditCustomers: CreditCustomerAccount[];
  accountingTransactions: AccountingTransactionRecord[];
  notifications: OwnerNotification[];
  busyActionId: string | null;
  actionFeedback: string | null;
  clearFeedback: () => void;
  acknowledgeNotification: (notificationId: string) => Promise<void>;
  approvePendingExpense: (txId: string) => Promise<void>;
  reviewShiftHandover: (
    shiftId: string,
    decision: 'APPROVED' | 'REJECTED',
    auditNotes: string
  ) => Promise<void>;
  submitOperatorHandover: (
    shiftId: string,
    cashCollected: number,
    cashBagSealNo: string,
    checklist: ShiftRecord['handover']['checklist']
  ) => Promise<void>;
  adjustOperatorNozzleMeter: (
    shiftId: string,
    nozzleId: string,
    newClosingReading: number
  ) => void;
  recordOperatorQuickSale: (input: QuickOperatorSaleInput) => Promise<void>;
}

export function useDashboardTelemetry(): DashboardTelemetryState {
  const { authReady, firebaseUser, userProfile, station, isBootstrappedOwner } =
    useFirebaseAuth();

  const authenticatedRole: ActiveRolePersona | null =
    userProfile?.role ?? (isBootstrappedOwner ? 'OWNER' : null);

  const stationId = userProfile?.stationId || DEFAULT_STATION_ID;
  const stationName = station?.name || 'Highway Meridian Fuels';
  const isLiveCloud = Boolean(authReady && firebaseUser && authenticatedRole);

  const [shifts, setShifts] = useState<ShiftRecord[]>(INITIAL_SHIFTS);
  const [sales, setSales] = useState<SalesTransactionRecord[]>(INITIAL_SALES_TRANSACTIONS);
  const [tanks, setTanks] = useState<StorageTankStock[]>(INITIAL_STORAGE_TANKS);
  const [purchaseOrders, setPurchaseOrders] =
    useState<PurchaseOrderRecord[]>(INITIAL_PURCHASE_ORDERS);
  const [deliveries, setDeliveries] = useState<FuelDeliveryRecord[]>(INITIAL_DELIVERIES);
  const [invoices, setInvoices] =
    useState<SupplierInvoiceRecord[]>(INITIAL_SUPPLIER_INVOICES);
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>(INITIAL_SUPPLIERS);
  const [creditCustomers, setCreditCustomers] =
    useState<CreditCustomerAccount[]>(INITIAL_CREDIT_CUSTOMERS);
  const [accountingTransactions, setAccountingTransactions] = useState<
    AccountingTransactionRecord[]
  >(INITIAL_ACCOUNTING_TRANSACTIONS);
  const [notifications, setNotifications] = useState<OwnerNotification[]>(
    INITIAL_OWNER_NOTIFICATIONS
  );
  const [busyActionId, setBusyActionId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const clearFeedback = useCallback(() => setActionFeedback(null), []);

  // Hydrate local shifts and sales from IndexedDB offline storage
  useEffect(() => {
    getAllOfflineShifts().then((cachedShifts) => {
      if (cachedShifts && cachedShifts.length > 0) {
        setShifts(cachedShifts);
      }
    });
    getAllOfflineSales(stationId).then((cachedSales) => {
      if (cachedSales && cachedSales.length > 0) {
        setSales((prev) => {
          const map = new Map(cachedSales.map((s) => [s.id, s]));
          const merged = [...cachedSales];
          for (const s of prev) {
            if (!map.has(s.id)) {
              merged.push(s);
            }
          }
          return merged;
        });
      }
    });
  }, [stationId]);

  useEffect(() => {
    if (!isLiveCloud || !firebaseUser || !authenticatedRole) return;

    const handleSafeQueryError = (err: unknown, opType: OperationType, path: string) => {
      if (!navigator.onLine) {
        console.info(`[Offline Mode] Using local cached records for ${path}`);
        return;
      }
      try {
        handleFirestoreError(err, opType, path);
      } catch (e) {
        console.warn(`[Firestore Query Status] ${path}:`, e);
      }
    };

    const shiftsPath = `stations/${stationId}/shifts`;
    const shiftsQuery =
      authenticatedRole === 'OPERATOR'
        ? query(
            collection(db, 'stations', stationId, 'shifts'),
            where('operatorUid', '==', firebaseUser.uid)
          )
        : collection(db, 'stations', stationId, 'shifts');

    const unsubShifts = onSnapshot(
      shiftsQuery,
      (snap) => {
        if (snap.empty) return;
        const rows: ShiftRecord[] = snap.docs.map((d) => {
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
              handover: {
                ...seedMatch.handover,
                cashBagSealNo: String(
                  data.cashBagSealNo ?? seedMatch.handover.cashBagSealNo
                ),
              },
            };
          }
          const shiftType = (data.shiftType as ShiftRecord['shiftType']) ?? 'DAY';
          const actualCash = Number(data.actualCashCollected ?? 0);
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
                n500: Math.floor(actualCash / 500),
                n200: 0,
                n100: 0,
                n50: 0,
                n20: 0,
                n10: 0,
                coins: actualCash % 500,
              },
            },
            expenses: [],
            handover: {
              outgoingOperator: 'Forecourt Attendant',
              incomingOperator: 'Next Shift Attendant',
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
              decision:
                data.status === 'APPROVED'
                  ? 'APPROVED'
                  : data.status === 'REJECTED'
                  ? 'REJECTED'
                  : 'PENDING',
              verifiedCashCount: actualCash,
              auditNotes: '',
              reviewedAt: null,
            },
          };
        });
        setShifts(rows);
      },
      (err) => handleSafeQueryError(err, OperationType.LIST, shiftsPath)
    );

    const salesPath = `stations/${stationId}/sales`;
    const salesQuery =
      authenticatedRole === 'OPERATOR'
        ? query(
            collection(db, 'stations', stationId, 'sales'),
            where('operatorUid', '==', firebaseUser.uid)
          )
        : collection(db, 'stations', stationId, 'sales');

    const unsubSales = onSnapshot(
      salesQuery,
      (snap) => {
        if (snap.empty) return;
        const rows: SalesTransactionRecord[] = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            stationId: String(data.stationId ?? stationId),
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
            paymentMode:
              (data.paymentMode as SalesTransactionRecord['paymentMode']) ?? 'CASH',
            paymentReference: data.paymentReference
              ? String(data.paymentReference)
              : undefined,
            vehicleNo: data.vehicleNo ? String(data.vehicleNo) : undefined,
            totalAmount: Number(data.totalAmount ?? 0),
            status: (data.status as SalesTransactionRecord['status']) ?? 'POSTED',
            soldDate: String(data.soldDate ?? '2026-11-23'),
            soldTimeLabel: 'Live',
          };
        });
        setSales(rows);
      },
      (err) => handleSafeQueryError(err, OperationType.LIST, salesPath)
    );

    const tanksPath = `stations/${stationId}/tanks`;
    const unsubTanks = onSnapshot(
      collection(db, 'stations', stationId, 'tanks'),
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
            stationId: String(data.stationId ?? stationId),
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
        setTanks(rows);
      },
      (err) => handleSafeQueryError(err, OperationType.LIST, tanksPath)
    );

    const creditPath = `stations/${stationId}/creditCustomers`;
    const unsubCredit = onSnapshot(
      collection(db, 'stations', stationId, 'creditCustomers'),
      (snap) => {
        if (snap.empty) return;
        const rows: CreditCustomerAccount[] = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          const seedMatch = INITIAL_CREDIT_CUSTOMERS.find((c) => c.id === d.id);
          return {
            id: d.id,
            stationId: String(data.stationId ?? stationId),
            accountCode: String(data.accountCode ?? d.id),
            companyName: String(data.companyName ?? 'Fleet Account'),
            creditLimit: Number(data.creditLimit ?? 0),
            currentBalance: Number(data.currentBalance ?? 0),
            status: (data.status as CreditCustomerAccount['status']) ?? 'ACTIVE',
            whitelistedVehicles: seedMatch?.whitelistedVehicles ?? [],
          };
        });
        setCreditCustomers(rows);
      },
      (err) => handleSafeQueryError(err, OperationType.LIST, creditPath)
    );

    const extraUnsubs: (() => void)[] = [];

    if (authenticatedRole === 'OWNER' || authenticatedRole === 'MANAGER') {
      const poPath = `stations/${stationId}/purchaseOrders`;
      extraUnsubs.push(
        onSnapshot(
          collection(db, 'stations', stationId, 'purchaseOrders'),
          (snap) => {
            if (snap.empty) return;
            const rows: PurchaseOrderRecord[] = snap.docs.map((d) => {
              const data = d.data() as Record<string, unknown>;
              let items: PurchaseOrderRecord['items'] = [];
              try {
                items = JSON.parse(String(data.itemsJson ?? '[]'));
              } catch {
                items = [];
              }
              return {
                id: d.id,
                stationId: String(data.stationId ?? stationId),
                supplierId: String(data.supplierId ?? ''),
                supplierName: String(data.supplierName ?? 'Fuel Supplier'),
                poNumber: String(data.poNumber ?? d.id),
                orderDate: String(data.orderDate ?? '2026-11-23'),
                expectedDeliveryDate: String(data.expectedDeliveryDate ?? '2026-11-24'),
                primaryFuelGrade: String(data.primaryFuelGrade ?? 'MS-91'),
                totalOrderedLitres: Number(data.totalOrderedLitres ?? 0),
                receivedLitres: Number(data.receivedLitres ?? 0),
                items,
                notes: String(data.notes ?? ''),
                status: (data.status as PurchaseOrderRecord['status']) ?? 'ORDERED',
                totalEstimatedAmount: Number(data.totalEstimatedAmount ?? 0),
                createdByUid: String(data.createdByUid ?? ''),
              };
            });
            setPurchaseOrders(rows);
          },
          (err) => handleSafeQueryError(err, OperationType.LIST, poPath)
        )
      );

      const deliveriesPath = `stations/${stationId}/deliveries`;
      extraUnsubs.push(
        onSnapshot(
          collection(db, 'stations', stationId, 'deliveries'),
          (snap) => {
            if (snap.empty) return;
            const rows: FuelDeliveryRecord[] = snap.docs.map((d) => {
              const data = d.data() as Record<string, unknown>;
              return {
                id: d.id,
                stationId: String(data.stationId ?? stationId),
                poId: data.poId ? String(data.poId) : undefined,
                poNumber: data.poNumber ? String(data.poNumber) : undefined,
                supplierId: String(data.supplierId ?? ''),
                supplierName: String(data.supplierName ?? 'OMC Terminal'),
                invoiceNumber: String(data.invoiceNumber ?? ''),
                deliveryDate: String(data.deliveryDate ?? '2026-11-23'),
                tankerRegNo: String(data.tankerRegNo ?? ''),
                driverName: String(data.driverName ?? ''),
                productName: String(data.productName ?? 'Motor Fuel'),
                targetTankCode: String(data.targetTankCode ?? 'T1-MS'),
                invoicedQtyLitres: Number(data.invoicedQtyLitres ?? 0),
                receivedQtyLitres: Number(data.receivedQtyLitres ?? 0),
                shortageLitres: Number(data.shortageLitres ?? 0),
                densityObserved: Number(data.densityObserved ?? 0.742),
                temperatureC: Number(data.temperatureC ?? 27),
                waterDipMm: Number(data.waterDipMm ?? 0),
                totalInvoiceAmount: Number(data.totalInvoiceAmount ?? 0),
                status: (data.status as FuelDeliveryRecord['status']) ?? 'DECANTED',
                verifiedByUid: String(data.verifiedByUid ?? ''),
              };
            });
            setDeliveries(rows);
          },
          (err) => handleSafeQueryError(err, OperationType.LIST, deliveriesPath)
        )
      );

      const invoicesPath = `stations/${stationId}/supplierInvoices`;
      extraUnsubs.push(
        onSnapshot(
          collection(db, 'stations', stationId, 'supplierInvoices'),
          (snap) => {
            if (snap.empty) return;
            const rows: SupplierInvoiceRecord[] = snap.docs.map((d) => {
              const data = d.data() as Record<string, unknown>;
              return {
                id: d.id,
                stationId: String(data.stationId ?? stationId),
                supplierId: String(data.supplierId ?? ''),
                supplierName: String(data.supplierName ?? 'Supplier'),
                poId: data.poId ? String(data.poId) : undefined,
                deliveryId: data.deliveryId ? String(data.deliveryId) : undefined,
                invoiceNumber: String(data.invoiceNumber ?? d.id),
                invoiceDate: String(data.invoiceDate ?? '2026-11-23'),
                dueDate: String(data.dueDate ?? '2026-11-30'),
                subtotalAmount: Number(data.subtotalAmount ?? 0),
                taxAmount: Number(data.taxAmount ?? 0),
                totalAmount: Number(data.totalAmount ?? 0),
                paidAmount: Number(data.paidAmount ?? 0),
                paymentStatus:
                  (data.paymentStatus as SupplierInvoiceRecord['paymentStatus']) ?? 'UNPAID',
                recordedByUid: String(data.recordedByUid ?? ''),
              };
            });
            setInvoices(rows);
          },
          (err) => handleSafeQueryError(err, OperationType.LIST, invoicesPath)
        )
      );

      const suppliersPath = `stations/${stationId}/suppliers`;
      extraUnsubs.push(
        onSnapshot(
          collection(db, 'stations', stationId, 'suppliers'),
          (snap) => {
            if (snap.empty) return;
            const rows: SupplierRecord[] = snap.docs.map((d) => {
              const data = d.data() as Record<string, unknown>;
              return {
                id: d.id,
                stationId: String(data.stationId ?? stationId),
                supplierCode: String(data.supplierCode ?? d.id),
                name: String(data.name ?? 'Supplier'),
                category: (data.category as SupplierRecord['category']) ?? 'OMC_FUEL',
                gstNumber: String(data.gstNumber ?? ''),
                contactPerson: String(data.contactPerson ?? ''),
                phone: String(data.phone ?? ''),
                email: String(data.email ?? ''),
                depotLocation: String(data.depotLocation ?? ''),
                paymentTermsDays: Number(data.paymentTermsDays ?? 7),
                creditLimit: Number(data.creditLimit ?? 0),
                outstandingBalance: Number(data.outstandingBalance ?? 0),
                status: (data.status as SupplierRecord['status']) ?? 'ACTIVE',
              };
            });
            setSuppliers(rows);
          },
          (err) => handleSafeQueryError(err, OperationType.LIST, suppliersPath)
        )
      );

      const acctPath = `stations/${stationId}/accountingTransactions`;
      extraUnsubs.push(
        onSnapshot(
          collection(db, 'stations', stationId, 'accountingTransactions'),
          (snap) => {
            if (snap.empty) return;
            const rows: AccountingTransactionRecord[] = snap.docs.map((d) => {
              const data = d.data() as Record<string, unknown>;
              return {
                id: d.id,
                stationId: String(data.stationId ?? stationId),
                bookType: (data.bookType as AccountingBookType) ?? 'CASH',
                entryCategory:
                  (data.entryCategory as AccountingEntryCategory) ?? 'OPERATING_EXPENSE',
                direction: (data.direction as CashFlowDirection) ?? 'OUTFLOW',
                txDate: String(data.txDate ?? '2026-11-23'),
                voucherNo: String(data.voucherNo ?? d.id),
                accountName: String(data.accountName ?? 'Station Ledger'),
                partyOrVendor: String(data.partyOrVendor ?? 'Vendor'),
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
                recordedByName: 'Station Staff',
                createdAtLabel: 'Live',
              };
            });
            setAccountingTransactions(rows);
          },
          (err) => handleSafeQueryError(err, OperationType.LIST, acctPath)
        )
      );
    }

    if (authenticatedRole === 'OWNER') {
      const notiPath = `stations/${stationId}/notifications`;
      extraUnsubs.push(
        onSnapshot(
          collection(db, 'stations', stationId, 'notifications'),
          (snap) => {
            if (snap.empty) return;
            const rows: OwnerNotification[] = snap.docs.map((d) => {
              const data = d.data() as Record<string, unknown>;
              return {
                id: d.id,
                shiftId: String(data.shiftId ?? ''),
                shiftCode: String(data.shiftId ?? d.id).toUpperCase(),
                severity: (data.severity as OwnerNotification['severity']) ?? 'INFO',
                eventType:
                  (data.eventType as OwnerNotification['eventType']) ?? 'SHIFT_HANDOVER',
                title: String(data.title ?? 'Station Notification'),
                message: String(data.message ?? ''),
                metricSummary: String(data.eventType ?? 'SYSTEM'),
                createdAt: 'Live',
                isRead: Boolean(data.isRead ?? false),
              };
            });
            setNotifications(rows);
          },
          (err) => handleSafeQueryError(err, OperationType.LIST, notiPath)
        )
      );
    }

    return () => {
      unsubShifts();
      unsubSales();
      unsubTanks();
      unsubCredit();
      extraUnsubs.forEach((fn) => fn());
    };
  }, [isLiveCloud, firebaseUser, authenticatedRole, stationId]);

  const acknowledgeNotification = useCallback(
    async (notificationId: string) => {
      setBusyActionId(notificationId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
      );
      if (isLiveCloud && authenticatedRole === 'OWNER') {
        try {
          await updateDoc(
            doc(db, 'stations', stationId, 'notifications', notificationId),
            { isRead: true }
          );
        } catch {
          // Local seed fallback remains acknowledged if doc does not yet exist in Firestore
        }
      }
      setBusyActionId(null);
      setActionFeedback('Alert marked as acknowledged.');
    },
    [isLiveCloud, authenticatedRole, stationId]
  );

  const approvePendingExpense = useCallback(
    async (txId: string) => {
      setBusyActionId(txId);
      setAccountingTransactions((prev) =>
        prev.map((t) => (t.id === txId ? { ...t, approvalStatus: 'APPROVED' } : t))
      );
      if (isLiveCloud && authenticatedRole === 'OWNER') {
        try {
          await updateDoc(
            doc(db, 'stations', stationId, 'accountingTransactions', txId),
            { approvalStatus: 'APPROVED' }
          );
        } catch {
          // Local seed fallback remains updated if doc is preview-only
        }
      }
      setBusyActionId(null);
      setActionFeedback('High-value voucher approved for general ledger.');
    },
    [isLiveCloud, authenticatedRole, stationId]
  );

  const reviewShiftHandover = useCallback(
    async (
      shiftId: string,
      decision: 'APPROVED' | 'REJECTED',
      auditNotes: string
    ) => {
      setBusyActionId(shiftId);
      const target = shifts.find((s) => s.id === shiftId);
      const summary = target ? computeShiftSummary(target) : null;

      setShifts((prev) =>
        prev.map((s) =>
          s.id === shiftId
            ? {
                ...s,
                status: decision,
                approval: {
                  ...s.approval,
                  decision,
                  auditNotes:
                    auditNotes.trim() ||
                    (decision === 'APPROVED'
                      ? 'Verified cash drop & meter readings.'
                      : 'Returned to operator for cash recount.'),
                  verifiedCashCount: summary?.actualCashCollected ?? s.approval.verifiedCashCount,
                  reviewedAt: '2026-11-23 18:10',
                },
              }
            : s
        )
      );

      if (target) {
        await storeOfflineShift(
          {
            ...target,
            status: decision,
            approval: {
              ...target.approval,
              decision,
              auditNotes: auditNotes.trim() || (decision === 'APPROVED' ? 'Verified cash drop & meter readings.' : 'Returned to operator for cash recount.'),
              verifiedCashCount: summary?.actualCashCollected ?? target.approval.verifiedCashCount,
              reviewedAt: '2026-11-23 18:10',
            },
          },
          decision === 'APPROVED' ? 'APPROVE_SHIFT' : 'REJECT_SHIFT',
          stationId
        );
      }

      if (
        isLiveCloud &&
        (authenticatedRole === 'OWNER' || authenticatedRole === 'MANAGER') &&
        navigator.onLine
      ) {
        try {
          await updateDoc(doc(db, 'stations', stationId, 'shifts', shiftId), {
            status: decision,
            updatedAt: serverTimestamp(),
          });
        } catch {
          // Handled via offline queue
        }
      }

      setBusyActionId(null);
      setActionFeedback(
        decision === 'APPROVED'
          ? 'Shift handover approved and locked.'
          : 'Shift flagged for recount and returned to operator.'
      );
    },
    [shifts, isLiveCloud, authenticatedRole, stationId]
  );

  const submitOperatorHandover = useCallback(
    async (
      shiftId: string,
      cashCollected: number,
      cashBagSealNo: string,
      checklist: ShiftRecord['handover']['checklist']
    ) => {
      setBusyActionId(shiftId);
      const target = shifts.find((s) => s.id === shiftId);
      const summary = target ? computeShiftSummary(target) : null;
      const expectedCash = summary?.expectedCashInDrawer ?? cashCollected;
      const variance = +(cashCollected - expectedCash).toFixed(2);

      setShifts((prev) =>
        prev.map((s) =>
          s.id === shiftId
            ? {
                ...s,
                status: 'HANDED_OVER',
                handover: {
                  ...s.handover,
                  cashBagSealNo: cashBagSealNo.trim() || s.handover.cashBagSealNo,
                  checklist,
                  handedOverAt: '2026-11-23 18:02',
                },
              }
            : s
        )
      );

      if (target) {
        await storeOfflineShift(
          {
            ...target,
            status: 'HANDED_OVER',
            handover: {
              ...target.handover,
              cashBagSealNo: cashBagSealNo.trim() || target.handover.cashBagSealNo,
              checklist,
              handedOverAt: '2026-11-23 18:02',
            },
          },
          'SUBMIT_SHIFT_HANDOVER',
          stationId
        );
      }

      if (isLiveCloud && firebaseUser && navigator.onLine) {
        try {
          await updateDoc(doc(db, 'stations', stationId, 'shifts', shiftId), {
            status: 'HANDED_OVER',
            actualCashCollected: cashCollected,
            cashVariance: variance,
            cashBagSealNo: cashBagSealNo.trim() || 'BAG-SHIFT-SEAL',
            updatedAt: serverTimestamp(),
          });
        } catch {
          // Handled via offline queue
        }
      }

      setBusyActionId(null);
      setActionFeedback('Shift handover submitted to Manager for verification.');
    },
    [shifts, isLiveCloud, firebaseUser, stationId]
  );

  const adjustOperatorNozzleMeter = useCallback(
    (shiftId: string, nozzleId: string, newClosingReading: number) => {
      setShifts((prev) =>
        prev.map((s) =>
          s.id !== shiftId
            ? s
            : {
                ...s,
                nozzles: s.nozzles.map((n) =>
                  n.nozzleId === nozzleId
                    ? {
                        ...n,
                        closingReading: Math.max(n.openingReading, newClosingReading),
                      }
                    : n
                ),
              }
        )
      );
      setActionFeedback('Nozzle meter closing reading updated.');
    },
    []
  );

  const recordOperatorQuickSale = useCallback(
    async (input: QuickOperatorSaleInput) => {
      const nozzleCfg =
        INITIAL_NOZZLE_CONFIGS.find((n) => n.nozzleCode === input.nozzleCode) ??
        INITIAL_NOZZLE_CONFIGS[0];

      const qty = Math.max(0.5, Number(input.quantityLitres.toFixed(2)));
      const totalAmount = +(qty * nozzleCfg.unitSellingPrice).toFixed(2);
      const costPrice =
        DEFAULT_PROFIT_ASSUMPTIONS.costByGrade[nozzleCfg.gradeCode] ??
        nozzleCfg.unitCostPrice;
      const grossProfit = +((nozzleCfg.unitSellingPrice - costPrice) * qty).toFixed(2);
      const receiptNumber = `POS-${Math.floor(100000 + Math.random() * 899999)}`;
      const activeShiftId =
        shifts.find((s) => s.status === 'OPEN')?.id ?? 'shf-20261123-day';

      setBusyActionId('quick-sale');

      const newSale: SalesTransactionRecord = {
        id: `sale-${Date.now()}`,
        stationId,
        shiftId: activeShiftId,
        dispenserCode: nozzleCfg.dispenserCode,
        nozzleCode: nozzleCfg.nozzleCode,
        productName: nozzleCfg.productName,
        gradeCode: nozzleCfg.gradeCode,
        quantityLitres: qty,
        unitSellingPrice: nozzleCfg.unitSellingPrice,
        unitCostPrice: costPrice,
        grossProfit,
        operatorUid: firebaseUser?.uid ?? 'op-vikram-01',
        operatorName: userProfile?.displayName ?? nozzleCfg.operatorName,
        receiptNumber,
        paymentMode: input.paymentMode,
        paymentReference: input.paymentReference?.trim() || undefined,
        vehicleNo: input.vehicleNo?.trim().toUpperCase() || undefined,
        totalAmount,
        status: 'POSTED',
        soldDate: '2026-11-23',
        soldTimeLabel: 'Just now',
      };

      setSales((prev) => [newSale, ...prev]);

      // Advance nozzle closing meter in active shift for immediate feedback
      setShifts((prev) =>
        prev.map((s) =>
          s.id !== activeShiftId
            ? s
            : {
                ...s,
                nozzles: s.nozzles.map((n) =>
                  n.nozzleCode === nozzleCfg.nozzleCode
                    ? { ...n, closingReading: +(n.closingReading + qty).toFixed(2) }
                    : n
                ),
                tenders:
                  input.paymentMode === 'UPI'
                    ? { ...s.tenders, upiAmount: +(s.tenders.upiAmount + totalAmount).toFixed(2) }
                    : input.paymentMode === 'CARD'
                    ? { ...s.tenders, cardAmount: +(s.tenders.cardAmount + totalAmount).toFixed(2) }
                    : input.paymentMode === 'CREDIT' || input.paymentMode === 'FLEET_CARD'
                    ? {
                        ...s.tenders,
                        creditSlipAmount: +(
                          s.tenders.creditSlipAmount + totalAmount
                        ).toFixed(2),
                      }
                    : s.tenders,
              }
        )
      );

      // Save locally to IndexedDB immediately for instant offline persistence
      await storeOfflineSale(newSale, !isLiveCloud || !navigator.onLine);

      if (isLiveCloud && firebaseUser && navigator.onLine) {
        try {
          await addDoc(collection(db, 'stations', stationId, 'sales'), {
            stationId,
            shiftId: activeShiftId,
            dispenserCode: nozzleCfg.dispenserCode,
            nozzleCode: nozzleCfg.nozzleCode,
            productName: nozzleCfg.productName,
            gradeCode: nozzleCfg.gradeCode,
            quantityLitres: qty,
            unitSellingPrice: nozzleCfg.unitSellingPrice,
            unitCostPrice: costPrice,
            grossProfit,
            operatorUid: firebaseUser.uid,
            operatorName: (userProfile?.displayName || nozzleCfg.operatorName).slice(0, 100),
            receiptNumber,
            paymentMode: input.paymentMode,
            ...(input.paymentReference?.trim()
              ? { paymentReference: input.paymentReference.trim().slice(0, 64) }
              : {}),
            ...(input.vehicleNo?.trim()
              ? { vehicleNo: input.vehicleNo.trim().toUpperCase().slice(0, 24) }
              : {}),
            totalAmount,
            status: 'POSTED',
            soldDate: '2026-11-23',
            soldAt: serverTimestamp(),
          });
        } catch (err) {
          console.warn('[Offline Mode] Direct cloud write failed, queued in IndexedDB:', err);
          await storeOfflineSale(newSale, true);
        }
      }

      setBusyActionId(null);
      setActionFeedback(
        !navigator.onLine
          ? `Sale ${receiptNumber} logged offline (${qty} L · Rs. ${totalAmount.toLocaleString('en-PK')}) and saved to device.`
          : `Sale ${receiptNumber} logged (${qty} L · Rs. ${totalAmount.toLocaleString('en-PK')}).`
      );
    },
    [shifts, stationId, firebaseUser, userProfile, isLiveCloud]
  );

  return {
    isLiveCloud,
    stationId,
    stationName,
    authenticatedRole,
    shifts,
    sales,
    tanks,
    purchaseOrders,
    deliveries,
    invoices,
    suppliers,
    creditCustomers,
    accountingTransactions,
    notifications,
    busyActionId,
    actionFeedback,
    clearFeedback,
    acknowledgeNotification,
    approvePendingExpense,
    reviewShiftHandover,
    submitOperatorHandover,
    adjustOperatorNozzleMeter,
    recordOperatorQuickSale,
  };
}
