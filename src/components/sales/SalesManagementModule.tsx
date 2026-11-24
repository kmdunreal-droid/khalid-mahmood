import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  Banknote,
  Building,
  Calculator,
  Fuel,
  Gauge,
  Smartphone,
} from 'lucide-react';
import { db, DEFAULT_STATION_ID } from '../../firebase';
import {
  DEFAULT_PROFIT_ASSUMPTIONS,
  INITIAL_CREDIT_CUSTOMERS,
  INITIAL_NOZZLE_CONFIGS,
  INITIAL_SALES_TRANSACTIONS,
  STATION_DISPENSER_MACHINES,
} from '../../data/salesSeedData';
import {
  CreditCustomerAccount,
  ProfitAssumptions,
  SalesTransactionRecord,
} from '../../data/salesTypes';
import { ActiveRolePersona } from '../../data/shiftTypes';
import { handleFirestoreError, OperationType } from '../../utils/firestoreErrors';
import { formatCurrency, formatLitres } from '../../utils/shiftMath';
import { useOfflineSync } from '../../context/OfflineSyncContext';
import { getAllOfflineSales } from '../../services/offlineStorage';
import { useFirebaseAuth } from '../auth/FirebaseProvider';
import { MachineSalesTab } from './MachineSalesTab';
import { NozzleSalesTab } from './NozzleSalesTab';
import { ProfitCalculationTab } from './ProfitCalculationTab';
import { SalesLedgerPanel } from './SalesLedgerPanel';

type SalesSubTab =
  | 'machine'
  | 'nozzle'
  | 'cash'
  | 'credit'
  | 'online'
  | 'profit';

function formatSoldTime(ts: unknown): string {
  if (ts && typeof ts === 'object' && 'toDate' in ts && typeof (ts as { toDate: () => Date }).toDate === 'function') {
    const d = (ts as { toDate: () => Date }).toDate();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export const SalesManagementModule: React.FC = () => {
  const {
    authReady,
    firebaseUser,
    userProfile,
    isBootstrappedOwner,
    activeRole: rolePersona,
  } = useFirebaseAuth();
  const authenticatedRole: ActiveRolePersona | null =
    userProfile?.role ?? (isBootstrappedOwner ? 'OWNER' : null);

  const [activeTab, setActiveTab] = useState<SalesSubTab>('machine');
  const [sales, setSales] = useState<SalesTransactionRecord[]>(INITIAL_SALES_TRANSACTIONS);
  const [creditCustomers, setCreditCustomers] = useState<CreditCustomerAccount[]>(
    INITIAL_CREDIT_CUSTOMERS
  );
  const [assumptions, setAssumptions] = useState<ProfitAssumptions>(DEFAULT_PROFIT_ASSUMPTIONS);
  const [quickSaleSeed, setQuickSaleSeed] = useState<{
    dispenserCode?: string;
    nozzleCode?: string;
  } | null>(null);

  const effectiveStationId = userProfile?.stationId || DEFAULT_STATION_ID;
  const isLiveCloudActive = Boolean(authReady && firebaseUser && authenticatedRole);

  useEffect(() => {
    if (!isLiveCloudActive || !firebaseUser) return;

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
            receiptNumber: String(data.receiptNumber ?? ''),
            paymentMode: (data.paymentMode as SalesTransactionRecord['paymentMode']) ?? 'CASH',
            paymentReference: data.paymentReference ? String(data.paymentReference) : undefined,
            vehicleNo: data.vehicleNo ? String(data.vehicleNo) : undefined,
            totalAmount: Number(data.totalAmount ?? 0),
            status: (data.status as SalesTransactionRecord['status']) ?? 'POSTED',
            soldDate: String(data.soldDate ?? '2026-11-23'),
            soldTimeLabel: formatSoldTime(data.soldAt),
          };
        });
        setSales(rows);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, salesPath)
    );

    const custPath = `stations/${effectiveStationId}/creditCustomers`;
    const unsubCust = onSnapshot(
      collection(db, 'stations', effectiveStationId, 'creditCustomers'),
      (snap) => {
        if (snap.empty) return;
        const rows: CreditCustomerAccount[] = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          const seedMatch = INITIAL_CREDIT_CUSTOMERS.find((c) => c.id === d.id);
          return {
            id: d.id,
            stationId: String(data.stationId ?? effectiveStationId),
            accountCode: String(data.accountCode ?? ''),
            companyName: String(data.companyName ?? ''),
            creditLimit: Number(data.creditLimit ?? 0),
            currentBalance: Number(data.currentBalance ?? 0),
            status: (data.status as CreditCustomerAccount['status']) ?? 'ACTIVE',
            whitelistedVehicles: seedMatch?.whitelistedVehicles ?? [],
          };
        });
        setCreditCustomers(rows);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, custPath)
    );

    return () => {
      unsubSales();
      unsubCust();
    };
  }, [isLiveCloudActive, firebaseUser, authenticatedRole, effectiveStationId]);

  const kpis = useMemo(() => {
    const posted = sales.filter((s) => s.status === 'POSTED');
    let grossRevenue = 0;
    let totalLitres = 0;
    let cashTotal = 0;
    let creditTotal = 0;
    let onlineTotal = 0;
    let grossProfit = 0;

    for (const s of posted) {
      grossRevenue += s.totalAmount;
      totalLitres += s.quantityLitres;
      const costRate = assumptions.costByGrade[s.gradeCode] ?? s.unitCostPrice;
      grossProfit += (s.unitSellingPrice - costRate) * s.quantityLitres;
      if (s.paymentMode === 'CASH') cashTotal += s.totalAmount;
      else if (s.paymentMode === 'CREDIT') creditTotal += s.totalAmount;
      else onlineTotal += s.totalAmount;
    }

    const mdrCost = +((onlineTotal * assumptions.onlineMdrPct) / 100).toFixed(2);
    const netProfit = +(grossProfit - mdrCost - assumptions.dailyOperatingOverhead).toFixed(2);

    return {
      txCount: posted.length,
      grossRevenue: +grossRevenue.toFixed(2),
      totalLitres: +totalLitres.toFixed(2),
      cashTotal: +cashTotal.toFixed(2),
      creditTotal: +creditTotal.toFixed(2),
      onlineTotal: +onlineTotal.toFixed(2),
      grossProfit: +grossProfit.toFixed(2),
      netProfit,
    };
  }, [sales, assumptions]);

  const { recordSaleOfflineFirst } = useOfflineSync();

  useEffect(() => {
    getAllOfflineSales(effectiveStationId).then((offlineSales) => {
      if (offlineSales && offlineSales.length > 0) {
        setSales((prev) => {
          const offlineMap = new Map(offlineSales.map((s) => [s.id, s]));
          const merged = [...offlineSales];
          for (const s of prev) {
            if (!offlineMap.has(s.id)) {
              merged.push(s);
            }
          }
          return merged;
        });
      }
    });
  }, [effectiveStationId]);

  const handleRecordSale = async (
    sale: Omit<SalesTransactionRecord, 'id' | 'stationId' | 'operatorUid' | 'soldTimeLabel'>
  ) => {
    const { sale: recordedSale } = await recordSaleOfflineFirst(sale, effectiveStationId);

    setSales((prev) => [
      recordedSale,
      ...prev.filter((s) => s.id !== recordedSale.id),
    ]);

    if (sale.paymentMode === 'CREDIT' && sale.customerId) {
      setCreditCustomers((prev) =>
        prev.map((c) =>
          c.id === sale.customerId
            ? { ...c, currentBalance: +(c.currentBalance + sale.totalAmount).toFixed(2) }
            : c
        )
      );
    }
  };

  const handleVoidSale = async (saleId: string) => {
    const target = sales.find((s) => s.id === saleId);
    if (!target || target.status === 'VOIDED') return;

    setSales((prev) =>
      prev.map((s) => (s.id === saleId ? { ...s, status: 'VOIDED' } : s))
    );

    if (isLiveCloudActive && navigator.onLine) {
      const path = `stations/${effectiveStationId}/sales/${saleId}`;
      try {
        await updateDoc(doc(db, 'stations', effectiveStationId, 'sales', saleId), {
          status: 'VOIDED',
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    }
  };

  const canViewProfit = rolePersona === 'OWNER' || rolePersona === 'MANAGER';

  const SUB_TABS: { id: SalesSubTab; label: string; icon: React.ReactNode }[] = [
    { id: 'machine', label: 'Machine-wise Sales', icon: <Fuel className="w-3.5 h-3.5" /> },
    { id: 'nozzle', label: 'Nozzle-wise Sales', icon: <Gauge className="w-3.5 h-3.5" /> },
    { id: 'cash', label: 'Cash Sales', icon: <Banknote className="w-3.5 h-3.5" /> },
    { id: 'credit', label: 'Credit Sales', icon: <Building className="w-3.5 h-3.5" /> },
    { id: 'online', label: 'Online Sales', icon: <Smartphone className="w-3.5 h-3.5" /> },
    {
      id: 'profit',
      label: 'Automatic Profit Calculation',
      icon: <Calculator className="w-3.5 h-3.5" />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Summary Card */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Sales & Forecourt POS
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Machine-wise and nozzle-wise sales, cash, credit, online channels, and automatic profit
          </p>
        </div>

        {/* 4-Column KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mt-5 pt-5 border-t border-slate-200 dark:border-slate-800">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Gross Forecourt Sales</div>
            <div className="mt-1 text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
              {formatCurrency(kpis.grossRevenue)}
            </div>
            <div className="mt-0.5 text-[11px] font-mono text-slate-500 dark:text-slate-400">
              {formatLitres(kpis.totalLitres)} · {kpis.txCount} receipts
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Cash / Online Split</div>
            <div className="mt-1 text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white">
              Cash {formatCurrency(kpis.cashTotal)}
            </div>
            <div className="mt-0.5 text-[11px] font-mono text-slate-500 dark:text-slate-400">
              Online {formatCurrency(kpis.onlineTotal)}
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Fleet Credit Billed</div>
            <div className="mt-1 text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
              {formatCurrency(kpis.creditTotal)}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Whitelisted fleet accounts
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {canViewProfit ? 'Auto Net Profit' : 'Active Shift Scope'}
            </div>
            <div
              className={`mt-1 text-xl font-bold font-mono tabular-nums ${
                canViewProfit
                  ? kpis.netProfit >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400'
                  : 'text-slate-900 dark:text-white'
              }`}
            >
              {canViewProfit ? formatCurrency(kpis.netProfit) : 'SHIFT OPEN'}
            </div>
            <div className="mt-0.5 text-[11px] font-mono text-slate-500 dark:text-slate-400">
              {canViewProfit
                ? `Gross profit: ${formatCurrency(kpis.grossProfit)}`
                : 'Attendant POS entry enabled'}
            </div>
          </div>
        </div>
      </section>

      {/* 6-Feature Sub-Navigation */}
      <nav
        aria-label="Sales management sections"
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
      {activeTab === 'machine' && (
        <MachineSalesTab
          machines={STATION_DISPENSER_MACHINES}
          nozzles={INITIAL_NOZZLE_CONFIGS}
          sales={sales}
          profitAssumptions={assumptions}
          rolePersona={rolePersona}
          onQuickSaleForMachine={(dispenserCode) => {
            setQuickSaleSeed({ dispenserCode });
            setActiveTab('cash');
          }}
        />
      )}

      {activeTab === 'nozzle' && (
        <NozzleSalesTab
          nozzles={INITIAL_NOZZLE_CONFIGS}
          sales={sales}
          profitAssumptions={assumptions}
          rolePersona={rolePersona}
          onQuickSaleForNozzle={(nozzleCode) => {
            setQuickSaleSeed({ nozzleCode });
            setActiveTab('cash');
          }}
        />
      )}

      {activeTab === 'cash' && (
        <SalesLedgerPanel
          key={`cash-${quickSaleSeed?.dispenserCode ?? ''}-${quickSaleSeed?.nozzleCode ?? ''}`}
          channel="CASH"
          nozzles={INITIAL_NOZZLE_CONFIGS}
          sales={sales}
          creditCustomers={creditCustomers}
          profitAssumptions={assumptions}
          rolePersona={rolePersona}
          initialDispenserOrNozzle={quickSaleSeed}
          onClearInitialSelection={() => setQuickSaleSeed(null)}
          onRecordSale={handleRecordSale}
          onVoidSale={handleVoidSale}
        />
      )}

      {activeTab === 'credit' && (
        <SalesLedgerPanel
          key="credit"
          channel="CREDIT"
          nozzles={INITIAL_NOZZLE_CONFIGS}
          sales={sales}
          creditCustomers={creditCustomers}
          profitAssumptions={assumptions}
          rolePersona={rolePersona}
          onClearInitialSelection={() => setQuickSaleSeed(null)}
          onRecordSale={handleRecordSale}
          onVoidSale={handleVoidSale}
        />
      )}

      {activeTab === 'online' && (
        <SalesLedgerPanel
          key="online"
          channel="ONLINE"
          nozzles={INITIAL_NOZZLE_CONFIGS}
          sales={sales}
          creditCustomers={creditCustomers}
          profitAssumptions={assumptions}
          rolePersona={rolePersona}
          onClearInitialSelection={() => setQuickSaleSeed(null)}
          onRecordSale={handleRecordSale}
          onVoidSale={handleVoidSale}
        />
      )}

      {activeTab === 'profit' && (
        <ProfitCalculationTab
          machines={STATION_DISPENSER_MACHINES}
          sales={sales}
          assumptions={assumptions}
          rolePersona={rolePersona}
          onUpdateAssumptions={setAssumptions}
          onResetAssumptions={() => setAssumptions(DEFAULT_PROFIT_ASSUMPTIONS)}
        />
      )}
    </div>
  );
};
