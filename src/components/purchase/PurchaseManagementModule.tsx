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
  BarChart3,
  Building2,
  ClipboardList,
  CreditCard,
  FileText,
  ShieldAlert,
  Truck,
} from 'lucide-react';
import { db, DEFAULT_STATION_ID } from '../../firebase';
import {
  INITIAL_DELIVERIES,
  INITIAL_PURCHASE_ORDERS,
  INITIAL_SUPPLIERS,
  INITIAL_SUPPLIER_INVOICES,
  INITIAL_SUPPLIER_PAYMENTS,
} from '../../data/purchaseSeedData';
import {
  FuelDeliveryRecord,
  FuelDeliveryStatus,
  PurchaseOrderItem,
  PurchaseOrderRecord,
  PurchaseOrderStatus,
  SupplierInvoiceRecord,
  SupplierInvoiceStatus,
  SupplierPaymentRecord,
  SupplierRecord,
} from '../../data/purchaseTypes';
import { ActiveRolePersona } from '../../data/shiftTypes';
import { handleFirestoreError, OperationType } from '../../utils/firestoreErrors';
import { formatCurrency, formatLitres } from '../../utils/shiftMath';
import { useFirebaseAuth } from '../auth/FirebaseProvider';
import { FuelReceivingTab } from './FuelReceivingTab';
import { InvoicesTab } from './InvoicesTab';
import { PaymentsTab } from './PaymentsTab';
import { PurchaseOrdersTab } from './PurchaseOrdersTab';
import { PurchaseReportsTab } from './PurchaseReportsTab';
import { SuppliersTab } from './SuppliersTab';

type PurchaseSubTab =
  | 'suppliers'
  | 'orders'
  | 'receiving'
  | 'invoices'
  | 'payments'
  | 'reports';

function addDaysIso(isoDate: string, days: number): string {
  const dt = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return isoDate;
  dt.setDate(dt.getDate() + days);
  return dt.toISOString().slice(0, 10);
}

function parsePoItems(itemsJson: string): PurchaseOrderItem[] {
  try {
    const parsed = JSON.parse(itemsJson);
    return Array.isArray(parsed) ? (parsed as PurchaseOrderItem[]) : [];
  } catch {
    return [];
  }
}

export const PurchaseManagementModule: React.FC = () => {
  const {
    authReady,
    firebaseUser,
    userProfile,
    isBootstrappedOwner,
    activeRole: rolePersona,
    setActiveRole,
  } = useFirebaseAuth();
  const authenticatedRole: ActiveRolePersona | null =
    userProfile?.role ?? (isBootstrappedOwner ? 'OWNER' : null);

  const [activeTab, setActiveTab] = useState<PurchaseSubTab>('suppliers');

  // State initialized from seed data for instant offline/preview usability
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>(INITIAL_SUPPLIERS);
  const [orders, setOrders] = useState<PurchaseOrderRecord[]>(INITIAL_PURCHASE_ORDERS);
  const [deliveries, setDeliveries] = useState<FuelDeliveryRecord[]>(INITIAL_DELIVERIES);
  const [invoices, setInvoices] = useState<SupplierInvoiceRecord[]>(INITIAL_SUPPLIER_INVOICES);
  const [payments, setPayments] = useState<SupplierPaymentRecord[]>(INITIAL_SUPPLIER_PAYMENTS);

  const [preselectedPoForReceiving, setPreselectedPoForReceiving] =
    useState<PurchaseOrderRecord | null>(null);
  const [preselectedInvoiceForPayment, setPreselectedInvoiceForPayment] =
    useState<SupplierInvoiceRecord | null>(null);

  const effectiveStationId = userProfile?.stationId || DEFAULT_STATION_ID;
  const isLiveCloudActive = Boolean(
    authReady &&
      firebaseUser &&
      (authenticatedRole === 'OWNER' || authenticatedRole === 'MANAGER')
  );

  // Real-time Firestore sync when authenticated as OWNER or MANAGER
  useEffect(() => {
    if (!isLiveCloudActive) return;

    const supPath = `stations/${effectiveStationId}/suppliers`;
    const poPath = `stations/${effectiveStationId}/purchaseOrders`;
    const delPath = `stations/${effectiveStationId}/deliveries`;
    const invPath = `stations/${effectiveStationId}/supplierInvoices`;
    const payPath = `stations/${effectiveStationId}/supplierPayments`;

    const unsubSup = onSnapshot(
      collection(db, 'stations', effectiveStationId, 'suppliers'),
      (snap) => {
        const rows: SupplierRecord[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<SupplierRecord, 'id'>),
        }));
        setSuppliers(rows);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, supPath)
    );

    const unsubPo = onSnapshot(
      collection(db, 'stations', effectiveStationId, 'purchaseOrders'),
      (snap) => {
        const rows: PurchaseOrderRecord[] = snap.docs.map((d) => {
          const raw = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            stationId: String(raw.stationId ?? effectiveStationId),
            supplierId: String(raw.supplierId ?? ''),
            supplierName: String(raw.supplierName ?? ''),
            poNumber: String(raw.poNumber ?? ''),
            orderDate: String(raw.orderDate ?? ''),
            expectedDeliveryDate: String(raw.expectedDeliveryDate ?? ''),
            primaryFuelGrade: String(raw.primaryFuelGrade ?? ''),
            totalOrderedLitres: Number(raw.totalOrderedLitres ?? 0),
            receivedLitres: Number(raw.receivedLitres ?? 0),
            items: parsePoItems(String(raw.itemsJson ?? '[]')),
            notes: String(raw.notes ?? ''),
            status: (raw.status as PurchaseOrderStatus) ?? 'DRAFT',
            totalEstimatedAmount: Number(raw.totalEstimatedAmount ?? 0),
            createdByUid: String(raw.createdByUid ?? ''),
            approvedByUid: raw.approvedByUid ? String(raw.approvedByUid) : undefined,
          };
        });
        setOrders(rows);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, poPath)
    );

    const unsubDel = onSnapshot(
      collection(db, 'stations', effectiveStationId, 'deliveries'),
      (snap) => {
        const rows: FuelDeliveryRecord[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<FuelDeliveryRecord, 'id'>),
        }));
        setDeliveries(rows);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, delPath)
    );

    const unsubInv = onSnapshot(
      collection(db, 'stations', effectiveStationId, 'supplierInvoices'),
      (snap) => {
        const rows: SupplierInvoiceRecord[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<SupplierInvoiceRecord, 'id'>),
        }));
        setInvoices(rows);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, invPath)
    );

    const unsubPay = onSnapshot(
      collection(db, 'stations', effectiveStationId, 'supplierPayments'),
      (snap) => {
        const rows: SupplierPaymentRecord[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<SupplierPaymentRecord, 'id'>),
        }));
        setPayments(rows);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, payPath)
    );

    return () => {
      unsubSup();
      unsubPo();
      unsubDel();
      unsubInv();
      unsubPay();
    };
  }, [isLiveCloudActive, effectiveStationId]);

  const kpis = useMemo(() => {
    const activeSupplierCount = suppliers.filter((s) => s.status === 'ACTIVE').length;
    const openPoList = orders.filter((o) => o.status === 'ORDERED' || o.status === 'PARTIAL');
    const pendingIndentLitres = openPoList.reduce(
      (sum, o) => sum + Math.max(0, o.totalOrderedLitres - o.receivedLitres),
      0
    );
    const totalReceivedLitres = deliveries.reduce((sum, d) => sum + d.receivedQtyLitres, 0);
    const totalShortageLitres = deliveries.reduce((sum, d) => sum + d.shortageLitres, 0);
    const openPayables = invoices.reduce(
      (sum, inv) => sum + Math.max(0, inv.totalAmount - inv.paidAmount),
      0
    );
    return {
      activeSupplierCount,
      openPoCount: openPoList.length,
      pendingIndentLitres,
      totalReceivedLitres,
      totalShortageLitres,
      openPayables: +openPayables.toFixed(2),
    };
  }, [suppliers, orders, deliveries, invoices]);

  // ==================== MUTATION HANDLERS ====================

  const handleCreateSupplier = async (sup: Omit<SupplierRecord, 'id' | 'stationId'>) => {
    const newId = `sup-${Date.now()}`;
    if (isLiveCloudActive) {
      const path = `stations/${effectiveStationId}/suppliers/${newId}`;
      try {
        await setDoc(doc(db, 'stations', effectiveStationId, 'suppliers', newId), {
          stationId: effectiveStationId,
          ...sup,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
      return;
    }

    setSuppliers((prev) => [
      { id: newId, stationId: effectiveStationId, ...sup },
      ...prev,
    ]);
  };

  const handleUpdateSupplier = async (id: string, patch: Partial<SupplierRecord>) => {
    if (isLiveCloudActive) {
      const path = `stations/${effectiveStationId}/suppliers/${id}`;
      try {
        await updateDoc(doc(db, 'stations', effectiveStationId, 'suppliers', id), {
          ...patch,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
      return;
    }

    setSuppliers((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const handleCreateOrder = async (
    order: Omit<PurchaseOrderRecord, 'id' | 'stationId' | 'createdByUid'>
  ) => {
    const newId = `po-${Date.now()}`;
    const creatorUid = firebaseUser?.uid ?? `local-${rolePersona.toLowerCase()}`;

    if (isLiveCloudActive && firebaseUser) {
      const path = `stations/${effectiveStationId}/purchaseOrders/${newId}`;
      try {
        await setDoc(doc(db, 'stations', effectiveStationId, 'purchaseOrders', newId), {
          stationId: effectiveStationId,
          supplierId: order.supplierId,
          supplierName: order.supplierName,
          poNumber: order.poNumber,
          orderDate: order.orderDate,
          expectedDeliveryDate: order.expectedDeliveryDate,
          primaryFuelGrade: order.primaryFuelGrade,
          totalOrderedLitres: order.totalOrderedLitres,
          receivedLitres: order.receivedLitres,
          itemsJson: JSON.stringify(order.items).slice(0, 2000),
          notes: order.notes,
          status: order.status,
          totalEstimatedAmount: order.totalEstimatedAmount,
          createdByUid: firebaseUser.uid,
          ...(order.status === 'ORDERED' ? { approvedByUid: firebaseUser.uid } : {}),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
      return;
    }

    setOrders((prev) => [
      {
        id: newId,
        stationId: effectiveStationId,
        createdByUid: creatorUid,
        ...(order.status === 'ORDERED' ? { approvedByUid: creatorUid } : {}),
        ...order,
      },
      ...prev,
    ]);
  };

  const handleUpdateOrderStatus = async (id: string, nextStatus: PurchaseOrderStatus) => {
    if (isLiveCloudActive && firebaseUser) {
      const path = `stations/${effectiveStationId}/purchaseOrders/${id}`;
      try {
        await updateDoc(doc(db, 'stations', effectiveStationId, 'purchaseOrders', id), {
          status: nextStatus,
          ...(nextStatus === 'ORDERED' && rolePersona === 'OWNER'
            ? { approvedByUid: firebaseUser.uid }
            : {}),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
      return;
    }

    setOrders((prev) =>
      prev.map((po) => (po.id === id ? { ...po, status: nextStatus } : po))
    );
  };

  const handleRecordDelivery = async (
    delivery: Omit<FuelDeliveryRecord, 'id' | 'stationId' | 'verifiedByUid'>,
    options: { autoCreateInvoice: boolean; invoiceDueDays: number }
  ) => {
    const newGrnId = `grn-${Date.now()}`;
    const verifierUid = firebaseUser?.uid ?? `local-${rolePersona.toLowerCase()}`;

    if (isLiveCloudActive && firebaseUser) {
      const grnPath = `stations/${effectiveStationId}/deliveries/${newGrnId}`;
      try {
        await setDoc(doc(db, 'stations', effectiveStationId, 'deliveries', newGrnId), {
          stationId: effectiveStationId,
          ...(delivery.poId ? { poId: delivery.poId } : {}),
          ...(delivery.poNumber ? { poNumber: delivery.poNumber } : {}),
          supplierId: delivery.supplierId,
          supplierName: delivery.supplierName,
          invoiceNumber: delivery.invoiceNumber,
          deliveryDate: delivery.deliveryDate,
          tankerRegNo: delivery.tankerRegNo,
          driverName: delivery.driverName,
          productName: delivery.productName,
          targetTankCode: delivery.targetTankCode,
          invoicedQtyLitres: delivery.invoicedQtyLitres,
          receivedQtyLitres: delivery.receivedQtyLitres,
          shortageLitres: delivery.shortageLitres,
          densityObserved: delivery.densityObserved,
          temperatureC: delivery.temperatureC,
          waterDipMm: delivery.waterDipMm,
          totalInvoiceAmount: delivery.totalInvoiceAmount,
          status: delivery.status,
          verifiedByUid: firebaseUser.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, grnPath);
      }

      if (delivery.poId) {
        const linkedPo = orders.find((o) => o.id === delivery.poId);
        if (linkedPo) {
          const updatedReceived = +(linkedPo.receivedLitres + delivery.receivedQtyLitres).toFixed(2);
          const nextPoStatus: PurchaseOrderStatus =
            updatedReceived >= linkedPo.totalOrderedLitres * 0.98 ? 'RECEIVED' : 'PARTIAL';
          const poPath = `stations/${effectiveStationId}/purchaseOrders/${linkedPo.id}`;
          try {
            await updateDoc(doc(db, 'stations', effectiveStationId, 'purchaseOrders', linkedPo.id), {
              receivedLitres: updatedReceived,
              status: nextPoStatus,
              updatedAt: serverTimestamp(),
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.UPDATE, poPath);
          }
        }
      }

      if (options.autoCreateInvoice) {
        await handleCreateInvoice({
          supplierId: delivery.supplierId,
          supplierName: delivery.supplierName,
          poId: delivery.poId,
          deliveryId: newGrnId,
          invoiceNumber: delivery.invoiceNumber,
          invoiceDate: delivery.deliveryDate,
          dueDate: addDaysIso(delivery.deliveryDate, options.invoiceDueDays),
          subtotalAmount: delivery.totalInvoiceAmount,
          taxAmount: 0,
          totalAmount: delivery.totalInvoiceAmount,
        });
      }
      return;
    }

    // Local preview update
    setDeliveries((prev) => [
      {
        id: newGrnId,
        stationId: effectiveStationId,
        verifiedByUid: verifierUid,
        ...delivery,
      },
      ...prev,
    ]);

    if (delivery.poId) {
      setOrders((prev) =>
        prev.map((po) => {
          if (po.id !== delivery.poId) return po;
          const updatedReceived = +(po.receivedLitres + delivery.receivedQtyLitres).toFixed(2);
          const nextStatus: PurchaseOrderStatus =
            updatedReceived >= po.totalOrderedLitres * 0.98 ? 'RECEIVED' : 'PARTIAL';
          return { ...po, receivedLitres: updatedReceived, status: nextStatus };
        })
      );
    }

    if (options.autoCreateInvoice) {
      await handleCreateInvoice({
        supplierId: delivery.supplierId,
        supplierName: delivery.supplierName,
        poId: delivery.poId,
        deliveryId: newGrnId,
        invoiceNumber: delivery.invoiceNumber,
        invoiceDate: delivery.deliveryDate,
        dueDate: addDaysIso(delivery.deliveryDate, options.invoiceDueDays),
        subtotalAmount: delivery.totalInvoiceAmount,
        taxAmount: 0,
        totalAmount: delivery.totalInvoiceAmount,
      });
    }
  };

  const handleUpdateDeliveryStatus = async (id: string, status: FuelDeliveryStatus) => {
    if (isLiveCloudActive) {
      const path = `stations/${effectiveStationId}/deliveries/${id}`;
      try {
        await updateDoc(doc(db, 'stations', effectiveStationId, 'deliveries', id), {
          status,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
      return;
    }

    setDeliveries((prev) => prev.map((d) => (d.id === id ? { ...d, status } : d)));
  };

  const handleCreateInvoice = async (
    invoice: Omit<
      SupplierInvoiceRecord,
      'id' | 'stationId' | 'recordedByUid' | 'paidAmount' | 'paymentStatus'
    >
  ) => {
    const newId = `inv-${Date.now()}`;
    const recorderUid = firebaseUser?.uid ?? `local-${rolePersona.toLowerCase()}`;
    const targetSupplier = suppliers.find((s) => s.id === invoice.supplierId);

    if (isLiveCloudActive && firebaseUser) {
      const invPath = `stations/${effectiveStationId}/supplierInvoices/${newId}`;
      try {
        await setDoc(doc(db, 'stations', effectiveStationId, 'supplierInvoices', newId), {
          stationId: effectiveStationId,
          supplierId: invoice.supplierId,
          supplierName: invoice.supplierName,
          ...(invoice.poId ? { poId: invoice.poId } : {}),
          ...(invoice.deliveryId ? { deliveryId: invoice.deliveryId } : {}),
          invoiceNumber: invoice.invoiceNumber,
          invoiceDate: invoice.invoiceDate,
          dueDate: invoice.dueDate,
          subtotalAmount: invoice.subtotalAmount,
          taxAmount: invoice.taxAmount,
          totalAmount: invoice.totalAmount,
          paidAmount: 0,
          paymentStatus: 'UNPAID',
          recordedByUid: firebaseUser.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, invPath);
      }

      if (targetSupplier) {
        const supPath = `stations/${effectiveStationId}/suppliers/${targetSupplier.id}`;
        try {
          await updateDoc(
            doc(db, 'stations', effectiveStationId, 'suppliers', targetSupplier.id),
            {
              outstandingBalance: +(
                targetSupplier.outstandingBalance + invoice.totalAmount
              ).toFixed(2),
              updatedAt: serverTimestamp(),
            }
          );
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, supPath);
        }
      }
      return;
    }

    setInvoices((prev) => [
      {
        id: newId,
        stationId: effectiveStationId,
        recordedByUid: recorderUid,
        paidAmount: 0,
        paymentStatus: 'UNPAID',
        ...invoice,
      },
      ...prev,
    ]);

    setSuppliers((prev) =>
      prev.map((s) =>
        s.id === invoice.supplierId
          ? { ...s, outstandingBalance: +(s.outstandingBalance + invoice.totalAmount).toFixed(2) }
          : s
      )
    );
  };

  const handleRecordPayment = async (
    payment: Omit<SupplierPaymentRecord, 'id' | 'stationId' | 'recordedByUid'>
  ) => {
    const newId = `pay-${Date.now()}`;
    const recorderUid = firebaseUser?.uid ?? `local-${rolePersona.toLowerCase()}`;
    const targetInv = invoices.find((i) => i.id === payment.invoiceId);
    const targetSup = suppliers.find((s) => s.id === payment.supplierId);

    const newPaidAmount = targetInv
      ? +Math.min(targetInv.totalAmount, targetInv.paidAmount + payment.amount).toFixed(2)
      : payment.amount;
    const nextInvStatus: SupplierInvoiceStatus =
      targetInv && newPaidAmount >= targetInv.totalAmount - 0.01 ? 'PAID' : 'PARTIAL';

    if (isLiveCloudActive && firebaseUser) {
      const payPath = `stations/${effectiveStationId}/supplierPayments/${newId}`;
      try {
        await setDoc(doc(db, 'stations', effectiveStationId, 'supplierPayments', newId), {
          stationId: effectiveStationId,
          ...payment,
          recordedByUid: firebaseUser.uid,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, payPath);
      }

      if (targetInv) {
        const invPath = `stations/${effectiveStationId}/supplierInvoices/${targetInv.id}`;
        try {
          await updateDoc(
            doc(db, 'stations', effectiveStationId, 'supplierInvoices', targetInv.id),
            {
              paidAmount: newPaidAmount,
              paymentStatus: nextInvStatus,
              updatedAt: serverTimestamp(),
            }
          );
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, invPath);
        }
      }

      if (targetSup) {
        const supPath = `stations/${effectiveStationId}/suppliers/${targetSup.id}`;
        try {
          await updateDoc(doc(db, 'stations', effectiveStationId, 'suppliers', targetSup.id), {
            outstandingBalance: Math.max(
              0,
              +(targetSup.outstandingBalance - payment.amount).toFixed(2)
            ),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, supPath);
        }
      }
      return;
    }

    setPayments((prev) => [
      {
        id: newId,
        stationId: effectiveStationId,
        recordedByUid: recorderUid,
        ...payment,
      },
      ...prev,
    ]);

    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === payment.invoiceId
          ? { ...inv, paidAmount: newPaidAmount, paymentStatus: nextInvStatus }
          : inv
      )
    );

    setSuppliers((prev) =>
      prev.map((s) =>
        s.id === payment.supplierId
          ? {
              ...s,
              outstandingBalance: Math.max(
                0,
                +(s.outstandingBalance - payment.amount).toFixed(2)
              ),
            }
          : s
      )
    );
  };

  const SUB_TABS: { id: PurchaseSubTab; label: string; icon: React.ReactNode }[] = [
    { id: 'suppliers', label: 'Supplier Management', icon: <Building2 className="w-3.5 h-3.5" /> },
    { id: 'orders', label: 'Purchase Orders', icon: <ClipboardList className="w-3.5 h-3.5" /> },
    { id: 'receiving', label: 'Fuel Receiving', icon: <Truck className="w-3.5 h-3.5" /> },
    { id: 'invoices', label: 'Invoice Management', icon: <FileText className="w-3.5 h-3.5" /> },
    { id: 'payments', label: 'Payment Tracking', icon: <CreditCard className="w-3.5 h-3.5" /> },
    { id: 'reports', label: 'Purchase Reports', icon: <BarChart3 className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Purchases & Tanker Intake
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Suppliers, purchase orders, tanker receiving, vendor invoices, and payments
          </p>
        </div>

        {/* 4-Column KPI Strip */}
        {rolePersona !== 'OPERATOR' && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mt-5 pt-5 border-t border-slate-200 dark:border-slate-800">
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Active Suppliers</div>
              <div className="mt-1 text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                {kpis.activeSupplierCount} / {suppliers.length}
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">OMC & lube vendors</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Open Orders</div>
              <div className="mt-1 text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                {kpis.openPoCount} POs
              </div>
              <div className="mt-0.5 text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {formatLitres(kpis.pendingIndentLitres)} pending
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Volume Received</div>
              <div className="mt-1 text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                {formatLitres(kpis.totalReceivedLitres)}
              </div>
              <div className="mt-0.5 text-[11px] font-mono tabular-nums text-amber-600 dark:text-amber-400">
                Transit loss: {formatLitres(kpis.totalShortageLitres)}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Payables Due</div>
              <div className="mt-1 text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                {formatCurrency(kpis.openPayables)}
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Unpaid & partial bills</div>
            </div>
          </div>
        )}
      </section>

      {/* RBAC Gate: OPERATOR Denied */}
      {rolePersona === 'OPERATOR' ? (
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center max-w-xl mx-auto space-y-3">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 mx-auto">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Manager or Owner Access Required
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Purchase orders, tanker receiving, and supplier payments are available only to Managers and the Station Owner.
          </p>
          {!authenticatedRole && (
            <button
              type="button"
              onClick={() => setActiveRole('MANAGER')}
              className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg"
            >
              Switch View to Manager
            </button>
          )}
        </section>
      ) : (
        <>
          {/* 6-Feature Sub-Navigation */}
          <nav
            aria-label="Purchase sections"
            className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-fit max-w-full overflow-x-auto"
          >
            {SUB_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
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
          </nav>

          {/* Active Sub-Tab */}
          {activeTab === 'suppliers' && (
            <SuppliersTab
              suppliers={suppliers}
              rolePersona={rolePersona}
              onCreateSupplier={handleCreateSupplier}
              onUpdateSupplier={handleUpdateSupplier}
            />
          )}

          {activeTab === 'orders' && (
            <PurchaseOrdersTab
              suppliers={suppliers}
              orders={orders}
              rolePersona={rolePersona}
              onCreateOrder={handleCreateOrder}
              onUpdateOrderStatus={handleUpdateOrderStatus}
              onReceiveFromPo={(po) => {
                setPreselectedPoForReceiving(po);
                setActiveTab('receiving');
              }}
            />
          )}

          {activeTab === 'receiving' && (
            <FuelReceivingTab
              suppliers={suppliers}
              orders={orders}
              deliveries={deliveries}
              preselectedPo={preselectedPoForReceiving}
              onClearPreselectedPo={() => setPreselectedPoForReceiving(null)}
              onRecordDelivery={handleRecordDelivery}
              onUpdateDeliveryStatus={handleUpdateDeliveryStatus}
            />
          )}

          {activeTab === 'invoices' && (
            <InvoicesTab
              suppliers={suppliers}
              orders={orders}
              invoices={invoices}
              onCreateInvoice={handleCreateInvoice}
              onPayInvoice={(inv) => {
                setPreselectedInvoiceForPayment(inv);
                setActiveTab('payments');
              }}
            />
          )}

          {activeTab === 'payments' && (
            <PaymentsTab
              invoices={invoices}
              payments={payments}
              preselectedInvoice={preselectedInvoiceForPayment}
              onClearPreselectedInvoice={() => setPreselectedInvoiceForPayment(null)}
              onRecordPayment={handleRecordPayment}
            />
          )}

          {activeTab === 'reports' && (
            <PurchaseReportsTab
              suppliers={suppliers}
              orders={orders}
              deliveries={deliveries}
              invoices={invoices}
              payments={payments}
            />
          )}
        </>
      )}
    </div>
  );
};
