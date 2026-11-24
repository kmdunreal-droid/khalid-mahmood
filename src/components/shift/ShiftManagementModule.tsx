import React, { useMemo, useState } from 'react';
import { useFirebaseAuth } from '../auth/FirebaseProvider';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Moon,
  Plus,
  Sun,
  X,
  XCircle,
} from 'lucide-react';
import {
  DEFAULT_ALERT_THRESHOLDS,
  INITIAL_OWNER_NOTIFICATIONS,
  INITIAL_SHIFTS,
} from '../../data/shiftSeedData';
import {
  CashDenominations,
  NozzleReading,
  OwnerAlertThresholds,
  OwnerNotification,
  ShiftExpense,
  ShiftHandoverInfo,
  ShiftPeriodType,
  ShiftRecord,
  ShiftTenders,
  ShiftWorkflowStatus,
} from '../../data/shiftTypes';
import { computeShiftSummary, formatCurrency, formatLitres } from '../../utils/shiftMath';
import { useOfflineSync } from '../../context/OfflineSyncContext';
import { getAllOfflineShifts, storeOfflineShift } from '../../services/offlineStorage';
import { CashCollectionTab } from './CashCollectionTab';
import { ExpensesTab } from './ExpensesTab';
import { ManagerApprovalTab } from './ManagerApprovalTab';
import { NozzleReadingsTab } from './NozzleReadingsTab';
import { OwnerNotificationsTab } from './OwnerNotificationsTab';
import { ShiftHandoverTab } from './ShiftHandoverTab';

type ShiftSubTab =
  | 'readings'
  | 'cash'
  | 'expenses'
  | 'handover'
  | 'approval'
  | 'notifications';

function nowStamp(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

export const ShiftManagementModule: React.FC = () => {
  const { activeRole: rolePersona, setActiveRole: setRolePersona } = useFirebaseAuth();
  const { saveShiftOfflineFirst } = useOfflineSync();

  const [shifts, setShifts] = useState<ShiftRecord[]>(INITIAL_SHIFTS);
  const [activeShiftId, setActiveShiftId] = useState<string>(INITIAL_SHIFTS[0].id);

  // Initialize from offline IndexedDB cache if available
  React.useEffect(() => {
    getAllOfflineShifts().then((cachedShifts) => {
      if (cachedShifts && cachedShifts.length > 0) {
        setShifts((prev) => {
          const map = new Map(cachedShifts.map((s) => [s.id, s]));
          const merged = [...cachedShifts];
          for (const s of prev) {
            if (!map.has(s.id)) {
              merged.push(s);
            }
          }
          return merged;
        });
      }
    });
  }, []);
  const [activeTab, setActiveTab] = useState<ShiftSubTab>('readings');
  const [notifications, setNotifications] = useState<OwnerNotification[]>(
    INITIAL_OWNER_NOTIFICATIONS
  );
  const [thresholds, setThresholds] = useState<OwnerAlertThresholds>(DEFAULT_ALERT_THRESHOLDS);
  const [shiftTypeFilter, setShiftTypeFilter] = useState<'ALL' | ShiftPeriodType>('ALL');

  // Open New Shift dialog state
  const [showNewShiftModal, setShowNewShiftModal] = useState<boolean>(false);
  const [newShiftType, setNewShiftType] = useState<ShiftPeriodType>('NIGHT');
  const [newShiftDate, setNewShiftDate] = useState<string>('2026-11-23');
  const [newOpeningFloat, setNewOpeningFloat] = useState<string>('5000');
  const [newSupervisor, setNewSupervisor] = useState<string>('Rajesh Sharma');
  const [newOutgoingOp, setNewOutgoingOp] = useState<string>('Manoj Tiwari');

  const filteredShifts = useMemo(
    () => shifts.filter((s) => shiftTypeFilter === 'ALL' || s.shiftType === shiftTypeFilter),
    [shifts, shiftTypeFilter]
  );

  const activeShift = useMemo(
    () => shifts.find((s) => s.id === activeShiftId) ?? shifts[0],
    [shifts, activeShiftId]
  );

  const summary = useMemo(() => computeShiftSummary(activeShift), [activeShift]);
  const unreadNotiCount = notifications.filter((n) => !n.isRead).length;

  const pushOwnerNotification = (entry: Omit<OwnerNotification, 'id' | 'createdAt' | 'isRead'>) => {
    const newNoti: OwnerNotification = {
      ...entry,
      id: `noti-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: nowStamp(),
      isRead: false,
    };
    setNotifications((prev) => [newNoti, ...prev]);
  };

  const updateActiveShift = (updater: (prev: ShiftRecord) => ShiftRecord) => {
    setShifts((prev) => prev.map((s) => (s.id === activeShift.id ? updater(s) : s)));
  };

  const handleUpdateNozzle = (nozzleId: string, patch: Partial<NozzleReading>) => {
    updateActiveShift((shift) => {
      const updated = {
        ...shift,
        nozzles: shift.nozzles.map((n) => (n.nozzleId === nozzleId ? { ...n, ...patch } : n)),
      };
      storeOfflineShift(updated);
      return updated;
    });
  };

  const handleUpdateOpeningFloat = (amount: number) => {
    updateActiveShift((shift) => {
      const updated = { ...shift, openingCashFloat: amount };
      storeOfflineShift(updated);
      return updated;
    });
  };

  const handleUpdateTenders = (patch: Partial<ShiftTenders>) => {
    updateActiveShift((shift) => {
      const updated = {
        ...shift,
        tenders: { ...shift.tenders, ...patch },
      };
      storeOfflineShift(updated);
      return updated;
    });
  };

  const handleUpdateDenomination = (key: keyof CashDenominations, value: number) => {
    updateActiveShift((shift) => {
      const updated = {
        ...shift,
        tenders: {
          ...shift.tenders,
          denominations: {
            ...shift.tenders.denominations,
            [key]: value,
          },
        },
      };
      storeOfflineShift(updated);
      return updated;
    });
  };

  const handleAddExpense = (expenseInput: Omit<ShiftExpense, 'id' | 'recordedAt'>) => {
    const newExpense: ShiftExpense = {
      ...expenseInput,
      id: `exp-${Date.now()}`,
      recordedAt: nowStamp(),
    };
    updateActiveShift((shift) => {
      const updated = {
        ...shift,
        expenses: [newExpense, ...shift.expenses],
      };
      saveShiftOfflineFirst(updated, 'ADD_SHIFT_EXPENSE');
      return updated;
    });

    if (newExpense.amount > thresholds.singleExpenseAlertLimit) {
      pushOwnerNotification({
        shiftId: activeShift.id,
        shiftCode: activeShift.shiftCode,
        severity: 'WARNING',
        eventType: 'EXPENSE_THRESHOLD',
        title: `${activeShift.shiftType === 'DAY' ? 'Day' : 'Night'} Shift Expense Exceeded ${formatCurrency(
          thresholds.singleExpenseAlertLimit
        )}`,
        message: `${newExpense.recordedBy} recorded ${newExpense.category} expense of ${formatCurrency(
          newExpense.amount
        )} (${newExpense.vendor}).`,
        metricSummary: `Voucher: ${newExpense.receiptRef} · Amount: ${formatCurrency(newExpense.amount)}`,
      });
    }
  };

  const handleDeleteExpense = (expenseId: string) => {
    updateActiveShift((shift) => ({
      ...shift,
      expenses: shift.expenses.filter((e) => e.id !== expenseId),
    }));
  };

  const handleUpdateHandover = (patch: Partial<ShiftHandoverInfo>) => {
    updateActiveShift((shift) => ({
      ...shift,
      handover: { ...shift.handover, ...patch },
    }));
  };

  const handleToggleChecklist = (key: keyof ShiftHandoverInfo['checklist']) => {
    updateActiveShift((shift) => ({
      ...shift,
      handover: {
        ...shift.handover,
        checklist: {
          ...shift.handover.checklist,
          [key]: !shift.handover.checklist[key],
        },
      },
    }));
  };

  const handleSubmitHandover = () => {
    const stamp = nowStamp();
    const updatedShift: ShiftRecord = {
      ...activeShift,
      status: 'HANDED_OVER',
      handover: {
        ...activeShift.handover,
        handedOverAt: stamp,
      },
    };
    updateActiveShift(() => updatedShift);
    saveShiftOfflineFirst(updatedShift, 'SUBMIT_SHIFT_HANDOVER');

    const absVar = Math.abs(summary.cashVariance);
    if (absVar > thresholds.cashVarianceLimit) {
      pushOwnerNotification({
        shiftId: activeShift.id,
        shiftCode: activeShift.shiftCode,
        severity: 'CRITICAL',
        eventType: 'CASH_VARIANCE',
        title: `Cash Variance Breach at Handover (${formatCurrency(summary.cashVariance)})`,
        message: `${activeShift.handover.outgoingOperator} submitted ${activeShift.shiftCode} with variance exceeding ±${formatCurrency(
          thresholds.cashVarianceLimit
        )} tolerance.`,
        metricSummary: `Expected: ${formatCurrency(summary.expectedCashInDrawer)} · Collected: ${formatCurrency(
          summary.actualCashCollected
        )}`,
      });
    } else {
      pushOwnerNotification({
        shiftId: activeShift.id,
        shiftCode: activeShift.shiftCode,
        severity: 'INFO',
        eventType: 'SHIFT_HANDOVER',
        title: `${activeShift.shiftType === 'DAY' ? 'Day' : 'Night'} Shift Handed Over`,
        message: `${activeShift.handover.outgoingOperator} handed over ${activeShift.shiftCode} to ${activeShift.handover.incomingOperator} (Seal ${activeShift.handover.cashBagSealNo}).`,
        metricSummary: `Cash Drop: ${formatCurrency(summary.actualCashCollected)} · Pending Manager Approval`,
      });
    }
    setActiveTab('approval');
  };

  const handleApproveShift = (verifiedCash: number, auditNotes: string) => {
    const stamp = nowStamp();
    const variance = +(verifiedCash - summary.expectedCashInDrawer).toFixed(2);
    const updatedShift: ShiftRecord = {
      ...activeShift,
      status: 'APPROVED',
      approval: {
        managerName: rolePersona === 'OWNER' ? 'Station Owner' : activeShift.supervisorName,
        decision: 'APPROVED',
        verifiedCashCount: verifiedCash,
        auditNotes: auditNotes || 'Verified and locked.',
        reviewedAt: stamp,
      },
    };
    updateActiveShift(() => updatedShift);
    saveShiftOfflineFirst(updatedShift, 'APPROVE_SHIFT');

    const isCritical = Math.abs(variance) > thresholds.cashVarianceLimit;
    pushOwnerNotification({
      shiftId: activeShift.id,
      shiftCode: activeShift.shiftCode,
      severity: isCritical ? 'WARNING' : 'INFO',
      eventType: 'MANAGER_APPROVED',
      title: `${activeShift.shiftCode} Approved & Locked`,
      message: `Verified by ${
        rolePersona === 'OWNER' ? 'Owner' : activeShift.supervisorName
      }. Total Meter Sales: ${formatCurrency(summary.totalMeterSales)}, Verified Cash: ${formatCurrency(
        verifiedCash
      )} (Variance: ${formatCurrency(variance)}).`,
      metricSummary: `Volume: ${formatLitres(summary.totalLitresDispensed)} · Expenses: ${formatCurrency(
        summary.cashDrawerExpensesTotal
      )}`,
    });
  };

  const handleRejectShift = (auditNotes: string) => {
    const stamp = nowStamp();
    const updatedShift: ShiftRecord = {
      ...activeShift,
      status: 'REJECTED',
      approval: {
        managerName: rolePersona === 'OWNER' ? 'Station Owner' : activeShift.supervisorName,
        decision: 'REJECTED',
        verifiedCashCount: null,
        auditNotes: auditNotes || 'Returned to operator for cash recount / meter verification.',
        reviewedAt: stamp,
      },
    };
    updateActiveShift(() => updatedShift);
    saveShiftOfflineFirst(updatedShift, 'REJECT_SHIFT');

    pushOwnerNotification({
      shiftId: activeShift.id,
      shiftCode: activeShift.shiftCode,
      severity: 'CRITICAL',
      eventType: 'MANAGER_REJECTED',
      title: `${activeShift.shiftCode} Rejected by Manager`,
      message: `Returned to ${activeShift.handover.outgoingOperator} for correction. Reason: ${
        auditNotes || 'Meter or cash bag discrepancy.'
      }`,
      metricSummary: `Declared Cash: ${formatCurrency(summary.actualCashCollected)} · Expected: ${formatCurrency(
        summary.expectedCashInDrawer
      )}`,
    });
  };

  const handleCreateNewShift = (e: React.FormEvent) => {
    e.preventDefault();
    const latestShift = shifts[0];
    const cleanDate = newShiftDate.replace(/-/g, '');
    const id = `shf-${cleanDate}-${newShiftType.toLowerCase()}-${Date.now().toString().slice(-3)}`;
    const shiftCode = `SHF-${cleanDate}-${newShiftType}`;

    const carriedNozzles: NozzleReading[] = latestShift.nozzles.map((n) => ({
      ...n,
      operatorName: newOutgoingOp.trim() || n.operatorName,
      openingReading: n.closingReading,
      closingReading: n.closingReading,
      testingLitres: 0,
    }));

    const created: ShiftRecord = {
      id,
      shiftCode,
      businessDate: newShiftDate,
      shiftType: newShiftType,
      timeWindow: newShiftType === 'DAY' ? '06:00 – 18:00' : '18:00 – 06:00',
      supervisorName: newSupervisor.trim() || 'Rajesh Sharma',
      status: 'OPEN',
      openingCashFloat: Math.max(0, parseFloat(newOpeningFloat) || 5000),
      nozzles: carriedNozzles,
      tenders: {
        upiAmount: 0,
        cardAmount: 0,
        creditSlipAmount: 0,
        denominations: {
          n500: 0,
          n200: 0,
          n100: 0,
          n50: 0,
          n20: 0,
          n10: 0,
          coins: 0,
        },
      },
      expenses: [],
      handover: {
        outgoingOperator: newOutgoingOp.trim() || 'Manoj Tiwari',
        incomingOperator: newShiftType === 'DAY' ? 'Manoj Tiwari' : 'Vikram Nair',
        cashBagSealNo: `BAG-${newShiftType === 'DAY' ? 'DAY' : 'NGT'}-${cleanDate.slice(4)}-01`,
        checklist: {
          cashCountVerified: false,
          dipStickRecorded: false,
          creditSlipsBundled: false,
          dispenserSealsIntact: false,
        },
        remarks: '',
        handedOverAt: null,
      },
      approval: {
        managerName: newSupervisor.trim() || 'Rajesh Sharma',
        decision: 'PENDING',
        verifiedCashCount: null,
        auditNotes: '',
        reviewedAt: null,
      },
    };

    setShifts((prev) => [created, ...prev]);
    saveShiftOfflineFirst(created, 'CREATE_SHIFT');
    setActiveShiftId(created.id);
    setActiveTab('readings');
    setShowNewShiftModal(false);
  };

  const renderStatusIndicator = (status: ShiftWorkflowStatus) => {
    if (status === 'APPROVED') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Approved & Locked</span>
        </span>
      );
    }
    if (status === 'HANDED_OVER') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400">
          <Clock className="w-3.5 h-3.5" />
          <span>Handed Over · Pending Approval</span>
        </span>
      );
    }
    if (status === 'REJECTED') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 dark:text-red-400">
          <XCircle className="w-3.5 h-3.5" />
          <span>Rejected · Recount Required</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
        <Clock className="w-3.5 h-3.5" />
        <span>Open Shift</span>
      </span>
    );
  };

  const absVariance = Math.abs(summary.cashVariance);
  const varianceColor =
    absVariance < 0.5
      ? 'text-emerald-600 dark:text-emerald-400'
      : absVariance > thresholds.cashVarianceLimit
      ? 'text-red-600 dark:text-red-400'
      : 'text-amber-600 dark:text-amber-400';

  return (
    <div className="space-y-6">
      {/* Top Shift Control Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Shift Management
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Day Shift (06:00–18:00) & Night Shift (18:00–06:00)
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowNewShiftModal(true)}
            className="min-h-[42px] inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Open New Shift</span>
          </button>
        </div>

        {/* Shift Selector Strip */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg mr-1">
              {(['ALL', 'DAY', 'NIGHT'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setShiftTypeFilter(t)}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    shiftTypeFilter === t
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {t === 'ALL' ? 'All' : t === 'DAY' ? 'Day' : 'Night'}
                </button>
              ))}
            </div>

            {filteredShifts.map((s) => {
              const isSelected = s.id === activeShift.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveShiftId(s.id)}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-mono rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-semibold'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {s.shiftType === 'DAY' ? (
                    <Sun className="w-3.5 h-3.5 text-amber-500" />
                  ) : (
                    <Moon className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  )}
                  <span>{s.shiftCode}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-mono">
              {activeShift.businessDate} · {activeShift.timeWindow}
            </span>
            <span className="text-slate-300 dark:text-slate-700">·</span>
            {renderStatusIndicator(activeShift.status)}
          </div>
        </div>

        {/* 4-Column Shift KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 pt-5 border-t border-slate-200 dark:border-slate-800">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Fuel Dispensed</div>
            <div className="mt-1 text-xl font-bold text-slate-900 dark:text-white font-mono tabular-nums">
              {formatLitres(summary.totalLitresDispensed)}
            </div>
            <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              Testing: {formatLitres(summary.totalTestingLitres)}
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Meter Sales</div>
            <div className="mt-1 text-xl font-bold text-slate-900 dark:text-white font-mono tabular-nums">
              {formatCurrency(summary.totalMeterSales)}
            </div>
            <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              Online + Credit: {formatCurrency(summary.nonCashTendersTotal)}
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Cash Collected</div>
            <div className="mt-1 text-xl font-bold text-slate-900 dark:text-white font-mono tabular-nums">
              {formatCurrency(summary.actualCashCollected)}
            </div>
            <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              Expected: {formatCurrency(summary.expectedCashInDrawer)}
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Cash Variance</div>
            <div className={`mt-1 text-xl font-bold font-mono tabular-nums ${varianceColor}`}>
              {summary.cashVariance > 0 ? '+' : ''}
              {formatCurrency(summary.cashVariance)}
            </div>
            <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              Expenses: {formatCurrency(summary.cashDrawerExpensesTotal)}
            </div>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-fit max-w-full overflow-x-auto">
        {(
          [
            { id: 'readings', label: 'Meter Readings' },
            { id: 'cash', label: 'Cash Collection' },
            { id: 'expenses', label: `Expenses (${activeShift.expenses.length})` },
            { id: 'handover', label: 'Handover' },
            { id: 'approval', label: 'Approval' },
            {
              id: 'notifications',
              label:
                unreadNotiCount > 0
                  ? `Alerts (${unreadNotiCount})`
                  : 'Alerts',
            },
          ] as { id: ShiftSubTab; label: string }[]
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`min-h-[38px] px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Active Tab Content */}
      {activeTab === 'readings' && (
        <NozzleReadingsTab
          nozzles={activeShift.nozzles}
          shiftStatus={activeShift.status}
          rolePersona={rolePersona}
          onUpdateNozzle={handleUpdateNozzle}
        />
      )}

      {activeTab === 'cash' && (
        <CashCollectionTab
          openingCashFloat={activeShift.openingCashFloat}
          tenders={activeShift.tenders}
          summary={summary}
          shiftStatus={activeShift.status}
          rolePersona={rolePersona}
          varianceLimit={thresholds.cashVarianceLimit}
          onUpdateOpeningFloat={handleUpdateOpeningFloat}
          onUpdateTenders={handleUpdateTenders}
          onUpdateDenomination={handleUpdateDenomination}
        />
      )}

      {activeTab === 'expenses' && (
        <ExpensesTab
          expenses={activeShift.expenses}
          shiftStatus={activeShift.status}
          rolePersona={rolePersona}
          expenseAlertLimit={thresholds.singleExpenseAlertLimit}
          onAddExpense={handleAddExpense}
          onDeleteExpense={handleDeleteExpense}
        />
      )}

      {activeTab === 'handover' && (
        <ShiftHandoverTab
          shiftCode={activeShift.shiftCode}
          shiftStatus={activeShift.status}
          rolePersona={rolePersona}
          handover={activeShift.handover}
          summary={summary}
          onUpdateHandover={handleUpdateHandover}
          onToggleChecklist={handleToggleChecklist}
          onSubmitHandover={handleSubmitHandover}
        />
      )}

      {activeTab === 'approval' && (
        <ManagerApprovalTab
          shift={activeShift}
          summary={summary}
          rolePersona={rolePersona}
          varianceLimit={thresholds.cashVarianceLimit}
          onApproveShift={handleApproveShift}
          onRejectShift={handleRejectShift}
        />
      )}

      {activeTab === 'notifications' && (
        <OwnerNotificationsTab
          notifications={notifications}
          thresholds={thresholds}
          onMarkRead={(id) =>
            setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)))
          }
          onMarkAllRead={() =>
            setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
          }
          onInspectShift={(shiftId) => {
            setActiveShiftId(shiftId);
            setActiveTab('approval');
          }}
          onUpdateThresholds={(patch) => setThresholds((prev) => ({ ...prev, ...patch }))}
        />
      )}

      {/* Open New Day/Night Shift Modal */}
      {showNewShiftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Open New Shift</h2>
              <button
                type="button"
                onClick={() => setShowNewShiftModal(false)}
                className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNewShift} className="p-6 space-y-4 text-xs">
              <div className="space-y-1.5">
                <span className="font-medium text-slate-700 dark:text-slate-300 block">Shift Period</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewShiftType('DAY')}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border font-medium transition-colors ${
                      newShiftType === 'DAY'
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300'
                        : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <Sun className="w-4 h-4 text-amber-500" />
                    <span>Day (06:00–18:00)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewShiftType('NIGHT')}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border font-medium transition-colors ${
                      newShiftType === 'NIGHT'
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300'
                        : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <Moon className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    <span>Night (18:00–06:00)</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Date</span>
                  <input
                    type="date"
                    required
                    value={newShiftDate}
                    onChange={(e) => setNewShiftDate(e.target.value)}
                    className="w-full px-3 py-2 font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Opening Float (Rs.)</span>
                  <input
                    type="number"
                    required
                    min="0"
                    value={newOpeningFloat}
                    onChange={(e) => setNewOpeningFloat(e.target.value)}
                    className="w-full px-3 py-2 font-mono tabular-nums border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Lead Operator</span>
                  <input
                    type="text"
                    required
                    value={newOutgoingOp}
                    onChange={(e) => setNewOutgoingOp(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Shift Manager</span>
                  <input
                    type="text"
                    required
                    value={newSupervisor}
                    onChange={(e) => setNewSupervisor(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewShiftModal(false)}
                  className="px-4 py-2 font-medium text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg"
                >
                  Open Shift
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
