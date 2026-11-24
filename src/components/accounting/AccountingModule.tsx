import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  BookOpen,
  Building2,
  FileSpreadsheet,
  Lock,
  Receipt,
  Scale,
  Users,
  Wallet,
} from 'lucide-react';
import { db, DEFAULT_STATION_ID } from '../../firebase';
import {
  EXPENSE_CATEGORY_LABELS,
  INITIAL_ACCOUNTING_TRANSACTIONS,
  INITIAL_CREDIT_LEDGER_ENTRIES,
} from '../../data/accountingSeedData';
import {
  AccountingBookType,
  AccountingEntryCategory,
  AccountingPaymentMode,
  AccountingTransactionRecord,
  CashFlowDirection,
  CreditLedgerEntryRecord,
  ExpenseCategory,
} from '../../data/accountingTypes';
import {
  INITIAL_SUPPLIER_INVOICES,
  INITIAL_SUPPLIER_PAYMENTS,
  INITIAL_SUPPLIERS,
} from '../../data/purchaseSeedData';
import {
  SupplierInvoiceRecord,
  SupplierPaymentRecord,
  SupplierRecord,
} from '../../data/purchaseTypes';
import { INITIAL_CREDIT_CUSTOMERS } from '../../data/salesSeedData';
import { CreditCustomerAccount } from '../../data/salesTypes';
import { ActiveRolePersona } from '../../data/shiftTypes';
import {
  computeBookLedger,
  computeProfitAndLoss,
} from '../../utils/accountingMath';
import { handleFirestoreError, OperationType } from '../../utils/firestoreErrors';
import { formatCurrency } from '../../utils/shiftMath';
import { useFirebaseAuth } from '../auth/FirebaseProvider';
import { CashBankBookTab } from './CashBankBookTab';
import { CustomerLedgerTab } from './CustomerLedgerTab';
import { ExpensesLedgerTab } from './ExpensesLedgerTab';
import { FinancialStatementsTab } from './FinancialStatementsTab';
import { SupplierLedgerTab } from './SupplierLedgerTab';

type AccountingSubTab =
  | 'cash_book'
  | 'bank_book'
  | 'customer_ledger'
  | 'supplier_ledger'
  | 'expenses_ledger'
  | 'profit_loss'
  | 'balance_sheet';

interface AccountingModuleProps {
  onNavigateToPurchase?: () => void;
}

function formatTsLabel(ts: unknown): string {
  if (
    ts &&
    typeof ts === 'object' &&
    'toDate' in ts &&
    typeof (ts as { toDate: () => Date }).toDate === 'function'
  ) {
    const d = (ts as { toDate: () => Date }).toDate();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
  }
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(
    now.getMinutes()
  ).padStart(2, '0')}`;
}

function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '-');
  return cleaned.length >= 2 ? cleaned.slice(0, 64) : `REF-${Date.now()}`;
}

export const AccountingModule: React.FC<AccountingModuleProps> = ({
  onNavigateToPurchase,
}) => {
  const {
    authReady,
    firebaseUser,
    userProfile,
    isBootstrappedOwner,
    activeRole: rolePersona,
  } = useFirebaseAuth();
  const authenticatedRole: ActiveRolePersona | null =
    userProfile?.role ?? (isBootstrappedOwner ? 'OWNER' : null);

  const [activeTab, setActiveTab] = useState<AccountingSubTab>('cash_book');

  const [transactions, setTransactions] = useState<AccountingTransactionRecord[]>(
    INITIAL_ACCOUNTING_TRANSACTIONS
  );
  const [customers, setCustomers] = useState<CreditCustomerAccount[]>(
    INITIAL_CREDIT_CUSTOMERS
  );
  const [creditLedgerEntries, setCreditLedgerEntries] = useState<CreditLedgerEntryRecord[]>(
    INITIAL_CREDIT_LEDGER_ENTRIES
  );
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>(INITIAL_SUPPLIERS);
  const [invoices, setInvoices] = useState<SupplierInvoiceRecord[]>(
    INITIAL_SUPPLIER_INVOICES
  );
  const [payments, setPayments] = useState<SupplierPaymentRecord[]>(
    INITIAL_SUPPLIER_PAYMENTS
  );
  const [cloudBanner, setCloudBanner] = useState<string | null>(null);

  const effectiveStationId = userProfile?.stationId || DEFAULT_STATION_ID;
  const isLiveCloudActive = Boolean(authReady && firebaseUser && authenticatedRole);
  const canReadAccountingCloud =
    isLiveCloudActive &&
    (authenticatedRole === 'OWNER' || authenticatedRole === 'MANAGER');

  useEffect(() => {
    if (!canReadAccountingCloud || !firebaseUser) return;

    const txPath = `stations/${effectiveStationId}/accountingTransactions`;
    const unsubTx = onSnapshot(
      collection(db, 'stations', effectiveStationId, 'accountingTransactions'),
      (snap) => {
        if (snap.empty) return;
        const rows: AccountingTransactionRecord[] = snap.docs.map((d) => {
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
            partyOrVendor: String(data.partyOrVendor ?? 'Station Counter'),
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
            recordedByName:
              data.recordedByUid === firebaseUser.uid
                ? userProfile?.displayName || firebaseUser.email || 'Station User'
                : 'Station Accountant',
            createdAtLabel: formatTsLabel(data.createdAt),
          };
        });
        setTransactions(rows);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, txPath)
    );

    const custPath = `stations/${effectiveStationId}/creditCustomers`;
    const unsubCustomers = onSnapshot(
      collection(db, 'stations', effectiveStationId, 'creditCustomers'),
      (snap) => {
        if (snap.empty) return;
        const rows: CreditCustomerAccount[] = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          const seedCust = INITIAL_CREDIT_CUSTOMERS.find((c) => c.id === d.id);
          return {
            id: d.id,
            stationId: String(data.stationId ?? effectiveStationId),
            accountCode: String(data.accountCode ?? d.id),
            companyName: String(data.companyName ?? 'Fleet Customer'),
            creditLimit: Number(data.creditLimit ?? 0),
            currentBalance: Number(data.currentBalance ?? 0),
            status: (data.status as CreditCustomerAccount['status']) ?? 'ACTIVE',
            whitelistedVehicles: seedCust?.whitelistedVehicles ?? [],
          };
        });
        setCustomers(rows);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, custPath)
    );

    const supPath = `stations/${effectiveStationId}/suppliers`;
    const unsubSuppliers = onSnapshot(
      collection(db, 'stations', effectiveStationId, 'suppliers'),
      (snap) => {
        if (snap.empty) return;
        const rows: SupplierRecord[] = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            stationId: String(data.stationId ?? effectiveStationId),
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
      (err) => handleFirestoreError(err, OperationType.LIST, supPath)
    );

    const invPath = `stations/${effectiveStationId}/supplierInvoices`;
    const unsubInvoices = onSnapshot(
      collection(db, 'stations', effectiveStationId, 'supplierInvoices'),
      (snap) => {
        if (snap.empty) return;
        const rows: SupplierInvoiceRecord[] = snap.docs.map((d) => {
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
            paymentStatus: (data.paymentStatus as SupplierInvoiceRecord['paymentStatus']) ?? 'UNPAID',
            recordedByUid: String(data.recordedByUid ?? ''),
          };
        });
        setInvoices(rows);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, invPath)
    );

    const pmtPath = `stations/${effectiveStationId}/supplierPayments`;
    const unsubPayments = onSnapshot(
      collection(db, 'stations', effectiveStationId, 'supplierPayments'),
      (snap) => {
        if (snap.empty) return;
        const rows: SupplierPaymentRecord[] = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            stationId: String(data.stationId ?? effectiveStationId),
            supplierId: String(data.supplierId ?? ''),
            supplierName: String(data.supplierName ?? ''),
            invoiceId: String(data.invoiceId ?? ''),
            invoiceNumber: String(data.invoiceNumber ?? ''),
            paymentRef: String(data.paymentRef ?? ''),
            paymentDate: String(data.paymentDate ?? ''),
            paymentMode: (data.paymentMode as SupplierPaymentRecord['paymentMode']) ?? 'RTGS',
            amount: Number(data.amount ?? 0),
            notes: String(data.notes ?? ''),
            recordedByUid: String(data.recordedByUid ?? ''),
          };
        });
        setPayments(rows);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, pmtPath)
    );

    return () => {
      unsubTx();
      unsubCustomers();
      unsubSuppliers();
      unsubInvoices();
      unsubPayments();
    };
  }, [canReadAccountingCloud, firebaseUser, effectiveStationId, userProfile?.displayName]);

  // Listen to customer credit subledger entries
  useEffect(() => {
    if (!canReadAccountingCloud || !firebaseUser) return;
    const ledgerMap = new Map<string, CreditLedgerEntryRecord>();
    const unsubs = customers.map((cust) => {
      const path = `stations/${effectiveStationId}/creditCustomers/${cust.id}/ledger`;
      return onSnapshot(
        collection(db, 'stations', effectiveStationId, 'creditCustomers', cust.id, 'ledger'),
        (snap) => {
          snap.docs.forEach((d) => {
            const data = d.data() as Record<string, unknown>;
            ledgerMap.set(d.id, {
              id: d.id,
              customerId: String(data.customerId ?? cust.id),
              stationId: String(data.stationId ?? effectiveStationId),
              txType: (data.txType as CreditLedgerEntryRecord['txType']) ?? 'INVOICE_DEBIT',
              amount: Number(data.amount ?? 0),
              runningBalance: Number(data.runningBalance ?? 0),
              referenceId: String(data.referenceId ?? d.id),
              notes:
                data.txType === 'PAYMENT_CREDIT'
                  ? 'Fleet credit settlement posted'
                  : 'Fleet fuel invoice debit',
              txDate: formatTsLabel(data.createdAt).slice(0, 10),
            });
          });
          if (ledgerMap.size > 0) {
            setCreditLedgerEntries(Array.from(ledgerMap.values()));
          }
        },
        (err) => handleFirestoreError(err, OperationType.LIST, path)
      );
    });

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [canReadAccountingCloud, firebaseUser, effectiveStationId, customers.map((c) => c.id).join(',')]);

  const cashBookSummary = useMemo(
    () => computeBookLedger(transactions, 'CASH'),
    [transactions]
  );
  const bankBookSummary = useMemo(
    () => computeBookLedger(transactions, 'BANK'),
    [transactions]
  );
  const plMonth = useMemo(
    () => computeProfitAndLoss(transactions, 'MONTH', EXPENSE_CATEGORY_LABELS),
    [transactions]
  );
  const totalReceivable = useMemo(
    () => customers.reduce((s, c) => s + c.currentBalance, 0),
    [customers]
  );
  const totalPayable = useMemo(
    () => suppliers.reduce((s, v) => s + v.outstandingBalance, 0),
    [suppliers]
  );

  const persistAccountingTx = async (newTx: AccountingTransactionRecord) => {
    setTransactions((prev) => [newTx, ...prev]);

    if (canReadAccountingCloud && firebaseUser) {
      const path = `stations/${effectiveStationId}/accountingTransactions/${newTx.id}`;
      const docData: Record<string, unknown> = {
        stationId: effectiveStationId,
        bookType: newTx.bookType,
        entryCategory: newTx.entryCategory,
        direction: newTx.direction,
        txDate: newTx.txDate,
        voucherNo: newTx.voucherNo,
        accountName: newTx.accountName,
        partyOrVendor: newTx.partyOrVendor,
        paymentMode: newTx.paymentMode,
        amount: newTx.amount,
        referenceNo: newTx.referenceNo,
        approvalStatus: newTx.approvalStatus,
        recordedByUid: firebaseUser.uid,
        createdAt: serverTimestamp(),
      };
      if (newTx.expenseCategory) docData.expenseCategory = newTx.expenseCategory;
      if (newTx.description) docData.description = newTx.description;

      try {
        await setDoc(
          doc(db, 'stations', effectiveStationId, 'accountingTransactions', newTx.id),
          docData
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }
    }
  };

  const handleAddBookTransaction = async (payload: {
    bookType: AccountingBookType;
    entryCategory: AccountingEntryCategory;
    direction: CashFlowDirection;
    txDate: string;
    voucherNo: string;
    accountName: string;
    partyOrVendor: string;
    paymentMode: AccountingPaymentMode;
    amount: number;
    referenceNo: string;
    description?: string;
  }) => {
    const id = `acct-tx-${Date.now()}`;
    const approvalStatus =
      rolePersona === 'MANAGER' && payload.amount > 5000 && payload.entryCategory === 'OPERATING_EXPENSE'
        ? 'PENDING_OWNER'
        : 'APPROVED';

    const newTx: AccountingTransactionRecord = {
      id,
      stationId: effectiveStationId,
      bookType: payload.bookType,
      entryCategory: payload.entryCategory,
      direction: payload.direction,
      txDate: payload.txDate,
      voucherNo: payload.voucherNo,
      accountName: payload.accountName,
      partyOrVendor: payload.partyOrVendor,
      paymentMode: payload.paymentMode,
      amount: payload.amount,
      referenceNo: payload.referenceNo,
      description: payload.description,
      approvalStatus,
      recordedByUid: firebaseUser?.uid || rolePersona.toLowerCase(),
      recordedByName: userProfile?.displayName || firebaseUser?.email || rolePersona,
      createdAtLabel: formatTsLabel(null),
    };

    await persistAccountingTx(newTx);
  };

  const handleRecordCustomerRepayment = async (payload: {
    customerId: string;
    amount: number;
    paymentMode: AccountingPaymentMode;
    referenceId: string;
    txDate: string;
    notes: string;
  }) => {
    const cust = customers.find((c) => c.id === payload.customerId);
    if (!cust) return;

    const newBalance = Math.max(0, +(cust.currentBalance - payload.amount).toFixed(2));
    const nextStatus =
      cust.status === 'HOLD' && newBalance < cust.creditLimit * 0.9 ? 'ACTIVE' : cust.status;

    setCustomers((prev) =>
      prev.map((c) =>
        c.id === cust.id ? { ...c, currentBalance: newBalance, status: nextStatus } : c
      )
    );

    const ledgerId = `cl-${Date.now()}`;
    const safeRef = sanitizeId(payload.referenceId);

    setCreditLedgerEntries((prev) => [
      {
        id: ledgerId,
        customerId: cust.id,
        stationId: effectiveStationId,
        txType: 'PAYMENT_CREDIT',
        amount: payload.amount,
        runningBalance: newBalance,
        referenceId: safeRef,
        notes: payload.notes,
        txDate: payload.txDate,
      },
      ...prev,
    ]);

    if (canReadAccountingCloud && firebaseUser) {
      const custPath = `stations/${effectiveStationId}/creditCustomers/${cust.id}`;
      try {
        await updateDoc(doc(db, 'stations', effectiveStationId, 'creditCustomers', cust.id), {
          currentBalance: newBalance,
          status: nextStatus,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, custPath);
      }

      const ledgerPath = `stations/${effectiveStationId}/creditCustomers/${cust.id}/ledger/${ledgerId}`;
      try {
        await setDoc(
          doc(
            db,
            'stations',
            effectiveStationId,
            'creditCustomers',
            cust.id,
            'ledger',
            ledgerId
          ),
          {
            customerId: cust.id,
            stationId: effectiveStationId,
            txType: 'PAYMENT_CREDIT',
            amount: payload.amount,
            runningBalance: newBalance,
            referenceId: safeRef,
            createdAt: serverTimestamp(),
          }
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, ledgerPath);
      }
    }

    const isCashReceipt = payload.paymentMode === 'CASH';
    await persistAccountingTx({
      id: `acct-tx-${Date.now()}`,
      stationId: effectiveStationId,
      bookType: isCashReceipt ? 'CASH' : 'BANK',
      entryCategory: 'CUSTOMER_PAYMENT',
      direction: 'INFLOW',
      txDate: payload.txDate,
      voucherNo: `RCT-${Date.now().toString().slice(-5)}`,
      accountName: isCashReceipt ? 'Station Cash Chest' : 'HDFC Current A/c #4819',
      partyOrVendor: `${cust.companyName} (${cust.accountCode})`,
      paymentMode: payload.paymentMode,
      amount: payload.amount,
      referenceNo: payload.referenceId,
      description: payload.notes,
      approvalStatus: 'APPROVED',
      recordedByUid: firebaseUser?.uid || rolePersona.toLowerCase(),
      recordedByName: userProfile?.displayName || firebaseUser?.email || rolePersona,
      createdAtLabel: formatTsLabel(null),
    });
  };

  const handleRecordSupplierSettlement = async (payload: {
    supplierId: string;
    invoiceId?: string;
    amount: number;
    paymentMode: AccountingPaymentMode;
    paymentRef: string;
    paymentDate: string;
    notes?: string;
  }) => {
    const sup = suppliers.find((s) => s.id === payload.supplierId);
    if (!sup) return;

    const newPayable = Math.max(0, +(sup.outstandingBalance - payload.amount).toFixed(2));
    setSuppliers((prev) =>
      prev.map((s) =>
        s.id === sup.id ? { ...s, outstandingBalance: newPayable } : s
      )
    );

    const targetInvoice = payload.invoiceId
      ? invoices.find((i) => i.id === payload.invoiceId)
      : undefined;

    if (targetInvoice) {
      const nextPaid = Math.min(
        targetInvoice.totalAmount,
        +(targetInvoice.paidAmount + payload.amount).toFixed(2)
      );
      const nextStatus: SupplierInvoiceRecord['paymentStatus'] =
        nextPaid >= targetInvoice.totalAmount ? 'PAID' : 'PARTIAL';

      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === targetInvoice.id
            ? { ...inv, paidAmount: nextPaid, paymentStatus: nextStatus }
            : inv
        )
      );

      const pmtId = `pmt-${Date.now()}`;
      const normalizedMode: SupplierPaymentRecord['paymentMode'] =
        payload.paymentMode === 'CASH' ||
        payload.paymentMode === 'UPI' ||
        payload.paymentMode === 'CHEQUE' ||
        payload.paymentMode === 'NEFT' ||
        payload.paymentMode === 'RTGS'
          ? payload.paymentMode
          : 'RTGS';

      setPayments((prev) => [
        {
          id: pmtId,
          stationId: effectiveStationId,
          supplierId: sup.id,
          supplierName: sup.name,
          invoiceId: targetInvoice.id,
          invoiceNumber: targetInvoice.invoiceNumber,
          paymentRef: payload.paymentRef,
          paymentDate: payload.paymentDate,
          paymentMode: normalizedMode,
          amount: payload.amount,
          notes: payload.notes ?? '',
          recordedByUid: firebaseUser?.uid || rolePersona.toLowerCase(),
        },
        ...prev,
      ]);

      if (canReadAccountingCloud && firebaseUser) {
        const invPath = `stations/${effectiveStationId}/supplierInvoices/${targetInvoice.id}`;
        try {
          await updateDoc(
            doc(db, 'stations', effectiveStationId, 'supplierInvoices', targetInvoice.id),
            {
              paidAmount: nextPaid,
              paymentStatus: nextStatus,
              updatedAt: serverTimestamp(),
            }
          );
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, invPath);
        }

        const pmtPath = `stations/${effectiveStationId}/supplierPayments/${pmtId}`;
        const pmtDoc: Record<string, unknown> = {
          stationId: effectiveStationId,
          supplierId: sup.id,
          supplierName: sup.name,
          invoiceId: targetInvoice.id,
          invoiceNumber: targetInvoice.invoiceNumber,
          paymentRef: payload.paymentRef,
          paymentDate: payload.paymentDate,
          paymentMode: normalizedMode,
          amount: payload.amount,
          recordedByUid: firebaseUser.uid,
          createdAt: serverTimestamp(),
        };
        if (payload.notes) pmtDoc.notes = payload.notes;
        try {
          await setDoc(
            doc(db, 'stations', effectiveStationId, 'supplierPayments', pmtId),
            pmtDoc
          );
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, pmtPath);
        }
      }
    }

    if (canReadAccountingCloud && firebaseUser) {
      const supPath = `stations/${effectiveStationId}/suppliers/${sup.id}`;
      try {
        await updateDoc(doc(db, 'stations', effectiveStationId, 'suppliers', sup.id), {
          outstandingBalance: newPayable,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, supPath);
      }
    }

    const isCashOut = payload.paymentMode === 'CASH';
    await persistAccountingTx({
      id: `acct-tx-${Date.now()}`,
      stationId: effectiveStationId,
      bookType: isCashOut ? 'CASH' : 'BANK',
      entryCategory: 'SUPPLIER_PAYMENT',
      direction: 'OUTFLOW',
      txDate: payload.paymentDate,
      voucherNo: `PMT-${Date.now().toString().slice(-5)}`,
      accountName: isCashOut ? 'Station Cash Chest' : 'HDFC Current A/c #4819',
      partyOrVendor: sup.name,
      paymentMode: payload.paymentMode,
      amount: payload.amount,
      referenceNo: payload.paymentRef,
      description: payload.notes,
      approvalStatus: 'APPROVED',
      recordedByUid: firebaseUser?.uid || rolePersona.toLowerCase(),
      recordedByName: userProfile?.displayName || firebaseUser?.email || rolePersona,
      createdAtLabel: formatTsLabel(null),
    });
  };

  const handleLogExpense = async (payload: {
    expenseCategory: ExpenseCategory;
    bookType: 'CASH' | 'BANK';
    paymentMode: AccountingPaymentMode;
    partyOrVendor: string;
    amount: number;
    txDate: string;
    referenceNo: string;
    description?: string;
  }) => {
    const approvalStatus =
      rolePersona === 'MANAGER' && payload.amount > 5000 ? 'PENDING_OWNER' : 'APPROVED';

    await persistAccountingTx({
      id: `acct-tx-${Date.now()}`,
      stationId: effectiveStationId,
      bookType: payload.bookType,
      entryCategory: 'OPERATING_EXPENSE',
      direction: 'OUTFLOW',
      txDate: payload.txDate,
      voucherNo: `EXP-${Date.now().toString().slice(-5)}`,
      accountName:
        payload.bookType === 'CASH' ? 'Station Cash Chest' : 'HDFC Current A/c #4819',
      partyOrVendor: payload.partyOrVendor,
      expenseCategory: payload.expenseCategory,
      paymentMode: payload.paymentMode,
      amount: payload.amount,
      referenceNo: payload.referenceNo,
      description: payload.description,
      approvalStatus,
      recordedByUid: firebaseUser?.uid || rolePersona.toLowerCase(),
      recordedByName: userProfile?.displayName || firebaseUser?.email || rolePersona,
      createdAtLabel: formatTsLabel(null),
    });
  };

  const handleApproveExpense = async (txId: string) => {
    if (rolePersona !== 'OWNER') return;
    setTransactions((prev) =>
      prev.map((t) => (t.id === txId ? { ...t, approvalStatus: 'APPROVED' } : t))
    );

    if (isLiveCloudActive && authenticatedRole === 'OWNER') {
      const path = `stations/${effectiveStationId}/accountingTransactions/${txId}`;
      try {
        await updateDoc(
          doc(db, 'stations', effectiveStationId, 'accountingTransactions', txId),
          {
            approvalStatus: 'APPROVED',
          }
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    }
  };

  const tabs: { id: AccountingSubTab; label: string; icon: React.ReactNode }[] = [
    { id: 'cash_book', label: 'Cash Book', icon: <Wallet className="w-3.5 h-3.5" /> },
    { id: 'bank_book', label: 'Bank Book', icon: <Building2 className="w-3.5 h-3.5" /> },
    { id: 'customer_ledger', label: 'Customer Ledger', icon: <Users className="w-3.5 h-3.5" /> },
    { id: 'supplier_ledger', label: 'Supplier Ledger', icon: <BookOpen className="w-3.5 h-3.5" /> },
    { id: 'expenses_ledger', label: 'Expenses Ledger', icon: <Receipt className="w-3.5 h-3.5" /> },
    { id: 'profit_loss', label: 'Profit & Loss', icon: <FileSpreadsheet className="w-3.5 h-3.5" /> },
    { id: 'balance_sheet', label: 'Balance Sheet', icon: <Scale className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Module Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Accounting & Ledgers
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Cash Book, Bank Book, Customer & Supplier Ledgers, Expenses, Profit & Loss, and Balance Sheet
            </p>
          </div>
          {cloudBanner && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              {cloudBanner}
            </span>
          )}
        </div>
      </div>

      {rolePersona === 'OPERATOR' ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center space-y-3">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 mx-auto">
            <Lock className="w-5 h-5" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            Manager or Owner Access Required
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
            Cash Book, Bank Book, Customer/Supplier Ledgers, Expenses, Profit & Loss, and Balance Sheet are restricted to Station Managers and the Station Owner.
          </p>
        </div>
      ) : (
        <>
          {/* 4-Column Financial KPI Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">Cash in Hand</div>
              <div className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
                {formatCurrency(cashBookSummary.closingBalance)}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Station Cash Chest</div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">Bank Balance</div>
              <div className="text-xl font-bold font-mono tabular-nums text-blue-600 dark:text-blue-400 mt-1">
                {formatCurrency(bankBookSummary.closingBalance)}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Station Current A/c</div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">Receivable / Payable</div>
              <div className="text-base font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
                AR {formatCurrency(totalReceivable)}
              </div>
              <div className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 mt-0.5">
                AP {formatCurrency(totalPayable)}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {rolePersona === 'OWNER' ? 'Net Operating Profit' : 'Operating Expenses'}
              </div>
              <div className="text-xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
                {rolePersona === 'OWNER'
                  ? formatCurrency(plMonth.netOperatingProfit)
                  : formatCurrency(plMonth.totalExpenses)}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {rolePersona === 'OWNER'
                  ? `Net Margin ${plMonth.netMarginPct}%`
                  : 'P&L hidden for Manager'}
              </div>
            </div>
          </div>

          {/* 7 Sub-Tab Navigation */}
          <div className="bg-slate-200/70 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1 flex flex-wrap gap-1 w-fit max-w-full overflow-x-auto">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`min-h-[38px] inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {activeTab === 'cash_book' && (
            <CashBankBookTab
              bookMode="CASH"
              transactions={transactions}
              onAddTransaction={handleAddBookTransaction}
            />
          )}

          {activeTab === 'bank_book' && (
            <CashBankBookTab
              bookMode="BANK"
              transactions={transactions}
              onAddTransaction={handleAddBookTransaction}
            />
          )}

          {activeTab === 'customer_ledger' && (
            <CustomerLedgerTab
              customers={customers}
              ledgerEntries={creditLedgerEntries}
              onRecordCustomerRepayment={handleRecordCustomerRepayment}
            />
          )}

          {activeTab === 'supplier_ledger' && (
            <SupplierLedgerTab
              suppliers={suppliers}
              invoices={invoices}
              payments={payments}
              onRecordSupplierSettlement={handleRecordSupplierSettlement}
              onNavigateToPurchase={onNavigateToPurchase}
            />
          )}

          {activeTab === 'expenses_ledger' && (
            <ExpensesLedgerTab
              transactions={transactions}
              rolePersona={rolePersona}
              onLogExpense={handleLogExpense}
              onApproveExpense={handleApproveExpense}
            />
          )}

          {activeTab === 'profit_loss' && (
            <FinancialStatementsTab
              statementMode="PL"
              rolePersona={rolePersona}
              transactions={transactions}
              customers={customers}
              suppliers={suppliers}
            />
          )}

          {activeTab === 'balance_sheet' && (
            <FinancialStatementsTab
              statementMode="BS"
              rolePersona={rolePersona}
              transactions={transactions}
              customers={customers}
              suppliers={suppliers}
            />
          )}
        </>
      )}
    </div>
  );
};
