import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Lock,
  Search,
} from 'lucide-react';
import { ActiveRolePersona } from '../../data/shiftTypes';
import {
  StockDirection,
  StockMovementRecord,
  StockMovementType,
  StorageTankStock,
} from '../../data/stockTypes';
import { formatLitres } from '../../utils/shiftMath';

interface StockMovementTabProps {
  direction: StockDirection;
  tanks: StorageTankStock[];
  movements: StockMovementRecord[];
  rolePersona: ActiveRolePersona;
  canMutate: boolean;
  preselectedTankId?: string | null;
  onRecordMovement: (payload: {
    tankId: string;
    direction: StockDirection;
    movementType: StockMovementType;
    quantityLitres: number;
    referenceNo: string;
    densityObserved?: number;
    notes?: string;
    movementDate: string;
  }) => Promise<void>;
}

const IN_TYPES: { value: StockMovementType; label: string }[] = [
  { value: 'TANKER_DECANT', label: 'Tanker Decanting / Fuel Receipt' },
  { value: 'TESTING_RETURN', label: 'Nozzle Calibration / Testing Return' },
  { value: 'STOCK_ADJUSTMENT', label: 'Positive Dip Gain Reconciliation' },
];

const OUT_TYPES: { value: StockMovementType; label: string }[] = [
  { value: 'NOZZLE_SALES', label: 'Forecourt Nozzle Sales Deduction' },
  { value: 'TESTING_RETURN', label: 'Pump Calibration / Sample Draw' },
  { value: 'EVAPORATION_LOSS', label: 'Evaporation / Thermal Shrinkage' },
  { value: 'STOCK_ADJUSTMENT', label: 'Physical Audit Stock Write-off' },
];

export const StockMovementTab: React.FC<StockMovementTabProps> = ({
  direction,
  tanks,
  movements,
  rolePersona,
  canMutate,
  preselectedTankId,
  onRecordMovement,
}) => {
  const isStockIn = direction === 'IN';
  const typeOptions = isStockIn ? IN_TYPES : OUT_TYPES;

  const [tankId, setTankId] = useState<string>(preselectedTankId || tanks[0]?.id || '');
  const [movementType, setMovementType] = useState<StockMovementType>(typeOptions[0].value);
  const [quantityLitres, setQuantityLitres] = useState<string>(isStockIn ? '5000' : '450');
  const [referenceNo, setReferenceNo] = useState<string>(
    isStockIn ? 'GRN-PSO-2026-8850' : 'SHF-20261123-DAY'
  );
  const [densityObserved, setDensityObserved] = useState<string>('0.742');
  const [movementDate, setMovementDate] = useState<string>('2026-11-23');
  const [notes, setNotes] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    setMovementType(isStockIn ? 'TANKER_DECANT' : 'NOZZLE_SALES');
    setQuantityLitres(isStockIn ? '5000' : '450');
    setReferenceNo(isStockIn ? 'GRN-PSO-2026-8850' : 'SHF-20261123-DAY');
    setFeedback(null);
  }, [isStockIn]);

  useEffect(() => {
    if (preselectedTankId && tanks.some((t) => t.id === preselectedTankId)) {
      setTankId(preselectedTankId);
    }
  }, [preselectedTankId, tanks]);

  const selectedTank = useMemo(
    () => tanks.find((t) => t.id === tankId) ?? tanks[0],
    [tanks, tankId]
  );

  useEffect(() => {
    if (selectedTank) {
      setDensityObserved(selectedTank.densityAt15C.toFixed(3));
    }
  }, [selectedTank?.id]);

  const directionalMovements = useMemo(
    () => movements.filter((m) => m.direction === direction),
    [movements, direction]
  );

  const filteredMovements = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return directionalMovements;
    return directionalMovements.filter(
      (m) =>
        m.tankCode.toLowerCase().includes(q) ||
        m.gradeCode.toLowerCase().includes(q) ||
        m.referenceNo.toLowerCase().includes(q) ||
        m.movementType.toLowerCase().includes(q)
    );
  }, [directionalMovements, searchQuery]);

  const totalVolume = directionalMovements.reduce((s, m) => s + m.quantityLitres, 0);
  const petrolVolume = directionalMovements
    .filter((m) => m.fuelFamily === 'PETROL')
    .reduce((s, m) => s + m.quantityLitres, 0);
  const dieselVolume = directionalMovements
    .filter((m) => m.fuelFamily === 'DIESEL')
    .reduce((s, m) => s + m.quantityLitres, 0);

  const qtyNum = Number(quantityLitres);
  const projectedBalance = selectedTank
    ? isStockIn
      ? +(selectedTank.currentBookStockLitres + (Number.isFinite(qtyNum) ? qtyNum : 0)).toFixed(2)
      : +(selectedTank.currentBookStockLitres - (Number.isFinite(qtyNum) ? qtyNum : 0)).toFixed(2)
    : 0;
  const ullageAvailable = selectedTank
    ? Math.max(0, +(selectedTank.capacityLitres - selectedTank.currentBookStockLitres).toFixed(2))
    : 0;

  const isAdjustmentType =
    movementType === 'EVAPORATION_LOSS' || movementType === 'STOCK_ADJUSTMENT';
  const managerToleranceLimit = selectedTank ? +(selectedTank.capacityLitres * 0.005).toFixed(2) : 0;
  const exceedsManagerTolerance =
    isAdjustmentType &&
    rolePersona === 'MANAGER' &&
    Number.isFinite(qtyNum) &&
    qtyNum > managerToleranceLimit;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canMutate || !selectedTank) return;

    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      setFeedback({ kind: 'err', text: 'Volume must be greater than 0 litres.' });
      return;
    }

    if (isStockIn && qtyNum > ullageAvailable) {
      setFeedback({
        kind: 'err',
        text: `Tanker volume exceeds safe ullage in ${selectedTank.tankCode} (max ${formatLitres(ullageAvailable)}).`,
      });
      return;
    }

    if (!isStockIn && qtyNum > selectedTank.currentBookStockLitres) {
      setFeedback({
        kind: 'err',
        text: `Cannot deduct ${formatLitres(qtyNum)}: ${selectedTank.tankCode} only has ${formatLitres(selectedTank.currentBookStockLitres)}.`,
      });
      return;
    }

    if (exceedsManagerTolerance) {
      setFeedback({
        kind: 'err',
        text: `RBAC Policy: Manager gain/loss adjustment is capped at ±0.5% of tank capacity (${formatLitres(managerToleranceLimit)}). Switch to Owner for larger write-offs.`,
      });
      return;
    }

    const refClean = referenceNo.trim();
    if (refClean.length < 2) {
      setFeedback({ kind: 'err', text: 'Enter a valid GRN, Shift, or Audit reference code.' });
      return;
    }

    const densityVal = Number(densityObserved);
    setSubmitting(true);
    setFeedback(null);
    try {
      await onRecordMovement({
        tankId: selectedTank.id,
        direction,
        movementType,
        quantityLitres: +qtyNum.toFixed(2),
        referenceNo: refClean,
        densityObserved:
          isStockIn && Number.isFinite(densityVal) && densityVal > 0 ? +densityVal.toFixed(3) : undefined,
        notes: notes.trim() || undefined,
        movementDate,
      });
      setNotes('');
      setFeedback({
        kind: 'ok',
        text: `${isStockIn ? 'Stock In' : 'Stock Out'} recorded for ${selectedTank.tankCode} (${isStockIn ? '+' : '-'}${formatLitres(qtyNum)} · new balance ${formatLitres(projectedBalance)}).`,
      });
    } catch (err) {
      setFeedback({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Unable to save stock movement.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Directional Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {isStockIn ? 'Cumulative Stock In' : 'Cumulative Stock Out'}
          </div>
          <div className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
            {formatLitres(totalVolume)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {directionalMovements.length} ledger postings
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Petrol Grades (MS-91 · MS-95)
          </div>
          <div className="text-lg font-bold font-mono tabular-nums text-blue-600 dark:text-blue-400 mt-1">
            {formatLitres(petrolVolume)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Motor spirit volume
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Diesel Grade (HSD-STD)</div>
          <div className="text-lg font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
            {formatLitres(dieselVolume)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            High speed diesel volume
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {isStockIn ? 'Selected Tank Ullage' : 'Selected Tank On-Hand'}
          </div>
          <div className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
            {selectedTank
              ? formatLitres(isStockIn ? ullageAvailable : selectedTank.currentBookStockLitres)
              : '0.00 L'}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {selectedTank ? `${selectedTank.tankCode} · ${selectedTank.gradeCode}` : 'No tank'}
          </div>
        </div>
      </div>

      {/* Stock Movement Entry Form */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            {isStockIn ? (
              <ArrowDownToLine className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <ArrowUpFromLine className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            )}
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                {isStockIn
                  ? 'Record Stock In (Tanker Decanting / Receipt)'
                  : 'Record Stock Out (Sales Outflow / Shrinkage)'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isStockIn
                  ? 'Increases underground tank book inventory with ullage overfill protection.'
                  : 'Deducts metered sales, pump testing draws, or variance write-offs.'}
              </p>
            </div>
          </div>
          {!canMutate && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
              <Lock className="w-3.5 h-3.5" />
              Read-only for Operator
            </span>
          )}
        </div>

        <form onSubmit={handleSubmit} className="pt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                {isStockIn ? 'Receiving Tank' : 'Source Tank'}
              </label>
              <select
                value={selectedTank?.id ?? ''}
                disabled={!canMutate}
                onChange={(e) => setTankId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 disabled:bg-slate-100 dark:disabled:bg-slate-800/60"
              >
                {tanks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.tankCode} · {t.gradeCode} (Book: {formatLitres(t.currentBookStockLitres)})
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Movement Type
              </label>
              <select
                value={movementType}
                disabled={!canMutate}
                onChange={(e) => setMovementType(e.target.value as StockMovementType)}
                className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 disabled:bg-slate-100 dark:disabled:bg-slate-800/60"
              >
                {typeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Volume (Litres)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                disabled={!canMutate}
                value={quantityLitres}
                onChange={(e) => setQuantityLitres(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono tabular-nums border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 disabled:bg-slate-100 dark:disabled:bg-slate-800/60"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Date
              </label>
              <input
                type="date"
                disabled={!canMutate}
                value={movementDate}
                onChange={(e) => setMovementDate(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 disabled:bg-slate-100 dark:disabled:bg-slate-800/60"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                {isStockIn ? 'GRN / Tanker Invoice Ref' : 'Shift / Audit Reference'}
              </label>
              <input
                type="text"
                disabled={!canMutate}
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                placeholder={isStockIn ? 'GRN-PSO-2026-8850' : 'SHF-20261123-DAY'}
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 disabled:bg-slate-100 dark:disabled:bg-slate-800/60"
              />
            </div>

            {isStockIn && (
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Density @ 15°C
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0.65"
                  max="0.95"
                  disabled={!canMutate}
                  value={densityObserved}
                  onChange={(e) => setDensityObserved(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono tabular-nums border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 disabled:bg-slate-100 dark:disabled:bg-slate-800/60"
                />
              </div>
            )}

            <div className={isStockIn ? 'lg:col-span-3' : 'lg:col-span-4'}>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Operational Notes (Optional)
              </label>
              <input
                type="text"
                disabled={!canMutate}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  isStockIn
                    ? 'Seal number, compartment check, hydrometer notes...'
                    : 'Nozzle totalizer batch, calibration vessel notes...'
                }
                className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 disabled:bg-slate-100 dark:disabled:bg-slate-800/60"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div>
                <span className="text-slate-500 dark:text-slate-400">Projected Tank Balance: </span>
                <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                  {formatLitres(Math.max(0, projectedBalance))}
                </span>
              </div>
              {isAdjustmentType && rolePersona === 'MANAGER' && (
                <div
                  className={`inline-flex items-center gap-1.5 font-medium ${
                    exceedsManagerTolerance
                      ? 'text-red-700 dark:text-red-400'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Manager adjustment limit: ±0.5% ({formatLitres(managerToleranceLimit)})
                </div>
              )}
            </div>

            {canMutate && (
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {submitting
                  ? 'Posting Entry...'
                  : isStockIn
                  ? 'Post Stock In Entry'
                  : 'Post Stock Out Entry'}
              </button>
            )}
          </div>

          {feedback && (
            <div
              className={`text-xs px-3 py-2 rounded-xl border ${
                feedback.kind === 'ok'
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300'
                  : 'bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-900/60 text-red-800 dark:text-red-300'
              }`}
            >
              {feedback.text}
            </div>
          )}
        </form>
      </div>

      {/* Immutable Ledger Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
              {isStockIn ? 'Stock In Ledger' : 'Stock Out Ledger'}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Append-only movement history synchronized with tank book balances.
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tank, grade, ref..."
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-4 font-semibold">Date</th>
                <th className="py-2.5 px-4 font-semibold">Tank · Grade</th>
                <th className="py-2.5 px-4 font-semibold">Movement Type</th>
                <th className="py-2.5 px-4 font-semibold">Reference</th>
                {isStockIn && <th className="py-2.5 px-4 font-semibold text-right">Density</th>}
                <th className="py-2.5 px-4 font-semibold text-right">Quantity</th>
                <th className="py-2.5 px-4 font-semibold text-right">Balance After</th>
                <th className="py-2.5 px-4 font-semibold">Recorded By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredMovements.length === 0 ? (
                <tr>
                  <td colSpan={isStockIn ? 8 : 7} className="py-6 px-4 text-center text-slate-500 dark:text-slate-400">
                    No {isStockIn ? 'Stock In' : 'Stock Out'} entries match your search.
                  </td>
                </tr>
              ) : (
                filteredMovements.map((mov) => (
                  <tr key={mov.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-4 font-mono tabular-nums text-slate-600 dark:text-slate-400">
                      {mov.movementDate}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-mono font-semibold text-slate-900 dark:text-white">
                        {mov.tankCode} · {mov.gradeCode}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">{mov.productName}</div>
                    </td>
                    <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300">
                      <div>{mov.movementType.replace(/_/g, ' ')}</div>
                      {mov.notes && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">{mov.notes}</div>
                      )}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-700 dark:text-slate-300">
                      {mov.referenceNo}
                    </td>
                    {isStockIn && (
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        {mov.densityObserved ? mov.densityObserved.toFixed(3) : '—'}
                      </td>
                    )}
                    <td
                      className={`py-2.5 px-4 text-right font-mono tabular-nums font-semibold ${
                        isStockIn
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {isStockIn ? '+' : '-'}
                      {formatLitres(mov.quantityLitres)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {formatLitres(mov.balanceAfterLitres)}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">
                      {mov.recordedByName}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
