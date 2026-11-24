import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Droplets,
  Gauge,
  Lock,
  Ruler,
} from 'lucide-react';
import {
  DipReadingType,
  StorageTankStock,
  TankDipReadingRecord,
} from '../../data/stockTypes';
import { formatLitres } from '../../utils/shiftMath';

interface TankMonitoringTabProps {
  tanks: StorageTankStock[];
  dipReadings: TankDipReadingRecord[];
  canMutate: boolean;
  onRecordDipReading: (payload: {
    tankId: string;
    readingType: DipReadingType;
    dipMm: number;
    waterDipMm: number;
    calculatedVolumeLitres: number;
    shiftId?: string;
  }) => Promise<void>;
}

const DIP_TYPES: { value: DipReadingType; label: string }[] = [
  { value: 'SHIFT_OPEN', label: 'Shift Open Dip' },
  { value: 'SHIFT_CLOSE', label: 'Shift Close Dip' },
  { value: 'PRE_DECANT', label: 'Pre-Decant Tanker Dip' },
  { value: 'POST_DECANT', label: 'Post-Decant Tanker Dip' },
  { value: 'AUDIT', label: 'Surprise / Manager Audit' },
];

export const TankMonitoringTab: React.FC<TankMonitoringTabProps> = ({
  tanks,
  dipReadings,
  canMutate,
  onRecordDipReading,
}) => {
  const [selectedTankId, setSelectedTankId] = useState<string>(tanks[0]?.id ?? '');
  const [readingType, setReadingType] = useState<DipReadingType>('AUDIT');
  const [dipMm, setDipMm] = useState<string>('1415');
  const [waterDipMm, setWaterDipMm] = useState<string>('0');
  const [calculatedVolumeLitres, setCalculatedVolumeLitres] = useState<string>('12425');
  const [shiftId, setShiftId] = useState<string>('shf-20261123-day');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [tankFilter, setTankFilter] = useState<string>('ALL');

  const activeTank = useMemo(
    () => tanks.find((t) => t.id === selectedTankId) ?? tanks[0],
    [tanks, selectedTankId]
  );

  const handleSelectTankForDip = (tank: StorageTankStock) => {
    setSelectedTankId(tank.id);
    setDipMm(String(tank.lastDipMm || 1000));
    setWaterDipMm(String(tank.lastWaterDipMm || 0));
    setCalculatedVolumeLitres(String(Math.round(tank.currentBookStockLitres)));
    setFeedback(null);
  };

  const parsedVolume = Number(calculatedVolumeLitres);
  const liveVarianceLitres =
    activeTank && Number.isFinite(parsedVolume)
      ? +(parsedVolume - activeTank.currentBookStockLitres).toFixed(2)
      : 0;
  const liveVariancePct =
    activeTank && activeTank.currentBookStockLitres > 0
      ? +((liveVarianceLitres / activeTank.currentBookStockLitres) * 100).toFixed(2)
      : 0;

  const filteredReadings = useMemo(() => {
    if (tankFilter === 'ALL') return dipReadings;
    return dipReadings.filter((d) => d.tankId === tankFilter);
  }, [dipReadings, tankFilter]);

  const handleSubmitDip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canMutate || !activeTank) return;

    const dipVal = Number(dipMm);
    const waterVal = Number(waterDipMm);
    const volVal = Number(calculatedVolumeLitres);

    if (!Number.isFinite(dipVal) || dipVal < 0) {
      setFeedback({ kind: 'err', text: 'Dipstick height (mm) must be 0 or greater.' });
      return;
    }
    if (!Number.isFinite(waterVal) || waterVal < 0) {
      setFeedback({ kind: 'err', text: 'Water paste level (mm) cannot be negative.' });
      return;
    }
    if (!Number.isFinite(volVal) || volVal < 0 || volVal > activeTank.capacityLitres) {
      setFeedback({
        kind: 'err',
        text: `Measured volume must be between 0 L and tank capacity (${formatLitres(activeTank.capacityLitres)}).`,
      });
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    try {
      await onRecordDipReading({
        tankId: activeTank.id,
        readingType,
        dipMm: dipVal,
        waterDipMm: waterVal,
        calculatedVolumeLitres: +volVal.toFixed(2),
        shiftId: shiftId.trim() || undefined,
      });
      setFeedback({
        kind: 'ok',
        text: `Physical dip logged for ${activeTank.tankCode} (${formatLitres(volVal)} · variance ${liveVarianceLitres >= 0 ? '+' : ''}${liveVarianceLitres} L).`,
      });
    } catch (err) {
      setFeedback({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Unable to save tank dip reading.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Underground Tank Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tanks.map((tank) => {
          const fillPct =
            tank.capacityLitres > 0
              ? Math.min(100, +((tank.currentBookStockLitres / tank.capacityLitres) * 100).toFixed(1))
              : 0;
          const thresholdPct =
            tank.capacityLitres > 0
              ? Math.min(100, +((tank.minThresholdLitres / tank.capacityLitres) * 100).toFixed(1))
              : 0;
          const ullage = Math.max(0, tank.capacityLitres - tank.currentBookStockLitres);
          const variance = +(tank.lastDipStockLitres - tank.currentBookStockLitres).toFixed(2);
          const variancePct =
            tank.currentBookStockLitres > 0
              ? +((variance / tank.currentBookStockLitres) * 100).toFixed(2)
              : 0;
          const isLow = tank.currentBookStockLitres < tank.minThresholdLitres;
          const isWaterHigh = tank.lastWaterDipMm > 5;
          const isSelected = activeTank?.id === tank.id;

          return (
            <div
              key={tank.id}
              className={`bg-white dark:bg-slate-900 border rounded-2xl p-5 transition-colors ${
                isSelected
                  ? 'border-blue-600 dark:border-blue-500 ring-1 ring-blue-600/20 dark:ring-blue-500/20'
                  : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                      {tank.tankCode}
                    </span>
                    <span className="text-slate-300 dark:text-slate-600">·</span>
                    <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
                      {tank.gradeCode}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {tank.productName}
                  </div>
                </div>
                <div className="text-right">
                  {isLow ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 dark:text-red-400">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Below Threshold
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Nominal ({fillPct}%)
                    </span>
                  )}
                </div>
              </div>

              {/* Capacity Bar with Minimum Threshold Marker */}
              <div className="mt-4">
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1.5">
                  <span className="font-mono tabular-nums">
                    Book:{' '}
                    <strong className="text-slate-900 dark:text-white">
                      {formatLitres(tank.currentBookStockLitres)}
                    </strong>
                  </span>
                  <span className="font-mono tabular-nums">
                    Cap: {formatLitres(tank.capacityLitres)}
                  </span>
                </div>
                <div className="relative h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      isLow
                        ? 'bg-red-600'
                        : tank.fuelFamily === 'PETROL'
                        ? 'bg-blue-600'
                        : 'bg-emerald-600'
                    }`}
                    style={{ width: `${fillPct}%` }}
                  />
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-slate-900 dark:bg-white"
                    style={{ left: `${thresholdPct}%` }}
                    title={`Min threshold: ${formatLitres(tank.minThresholdLitres)}`}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  <span className="font-mono tabular-nums">
                    Min Threshold: {formatLitres(tank.minThresholdLitres)}
                  </span>
                  <span className="font-mono tabular-nums">Ullage: {formatLitres(ullage)}</span>
                </div>
              </div>

              {/* Telemetry Grid */}
              <div className="grid grid-cols-4 gap-2 pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                <div>
                  <div className="text-slate-500 dark:text-slate-400 text-[11px]">Last Dip</div>
                  <div className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                    {formatLitres(tank.lastDipStockLitres)}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 dark:text-slate-400 text-[11px]">Variance</div>
                  <div
                    className={`font-mono tabular-nums font-semibold ${
                      Math.abs(variancePct) > 0.5
                        ? 'text-red-700 dark:text-red-400'
                        : 'text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {variance >= 0 ? '+' : ''}
                    {variance} L
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 dark:text-slate-400 text-[11px]">Water Cut</div>
                  <div
                    className={`font-mono tabular-nums font-medium ${
                      isWaterHigh
                        ? 'text-red-700 dark:text-red-400'
                        : 'text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {tank.lastWaterDipMm} mm
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 dark:text-slate-400 text-[11px]">Density 15°C</div>
                  <div className="font-mono tabular-nums font-medium text-slate-800 dark:text-slate-200">
                    {tank.densityAt15C.toFixed(3)}
                  </div>
                </div>
              </div>

              {canMutate && (
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    Updated {tank.updatedAtLabel}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleSelectTankForDip(tank)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
                  >
                    <Ruler className="w-3.5 h-3.5" />
                    Record Dip
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Record Physical Dip Reading Form */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <Gauge className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Record Physical Tank Dip & Water-Cut Reading
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Compare calibrated dipstick volume against live book stock to detect evaporation, leaks, or meter drift.
            </p>
          </div>
          {!canMutate && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
              <Lock className="w-3.5 h-3.5" />
              Read-only for Operator
            </span>
          )}
        </div>

        <form onSubmit={handleSubmitDip} className="pt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Underground Tank
              </label>
              <select
                value={activeTank?.id ?? ''}
                disabled={!canMutate}
                onChange={(e) => {
                  const t = tanks.find((item) => item.id === e.target.value);
                  if (t) handleSelectTankForDip(t);
                }}
                className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 disabled:bg-slate-100 dark:disabled:bg-slate-800/60"
              >
                {tanks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.tankCode} · {t.gradeCode} ({formatLitres(t.currentBookStockLitres)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Reading Type
              </label>
              <select
                value={readingType}
                disabled={!canMutate}
                onChange={(e) => setReadingType(e.target.value as DipReadingType)}
                className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 disabled:bg-slate-100 dark:disabled:bg-slate-800/60"
              >
                {DIP_TYPES.map((dt) => (
                  <option key={dt.value} value={dt.value}>
                    {dt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Dipstick Level (mm)
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                disabled={!canMutate}
                value={dipMm}
                onChange={(e) => setDipMm(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono tabular-nums border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 disabled:bg-slate-100 dark:disabled:bg-slate-800/60"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Water Cut (mm)
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                disabled={!canMutate}
                value={waterDipMm}
                onChange={(e) => setWaterDipMm(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono tabular-nums border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 disabled:bg-slate-100 dark:disabled:bg-slate-800/60"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Chart Volume (Litres)
              </label>
              <input
                type="number"
                step="1"
                min="0"
                disabled={!canMutate}
                value={calculatedVolumeLitres}
                onChange={(e) => setCalculatedVolumeLitres(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono tabular-nums border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 disabled:bg-slate-100 dark:disabled:bg-slate-800/60"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div>
                <span className="text-slate-500 dark:text-slate-400">Current Book Stock: </span>
                <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                  {activeTank ? formatLitres(activeTank.currentBookStockLitres) : '0.00 L'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">Projected Variance: </span>
                <span
                  className={`font-mono tabular-nums font-semibold ${
                    Math.abs(liveVariancePct) > 0.5
                      ? 'text-red-700 dark:text-red-400'
                      : 'text-emerald-700 dark:text-emerald-400'
                  }`}
                >
                  {liveVarianceLitres >= 0 ? '+' : ''}
                  {liveVarianceLitres} L ({liveVariancePct >= 0 ? '+' : ''}
                  {liveVariancePct}%)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 dark:text-slate-400">Shift Ref:</span>
                <input
                  type="text"
                  disabled={!canMutate}
                  value={shiftId}
                  onChange={(e) => setShiftId(e.target.value)}
                  className="px-2.5 py-1 text-xs font-mono border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 w-36 disabled:opacity-60"
                />
              </div>
            </div>

            {canMutate && (
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {submitting ? 'Saving Dip...' : 'Save Physical Dip Reading'}
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

      {/* Physical Dip Calibration Log */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <Droplets className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
              Tank Dip Calibration History
            </h4>
          </div>
          <select
            value={tankFilter}
            onChange={(e) => setTankFilter(e.target.value)}
            className="px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200"
            aria-label="Filter dip readings by tank"
          >
            <option value="ALL">All Underground Tanks</option>
            {tanks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.tankCode} · {t.gradeCode}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-4 font-semibold">Timestamp</th>
                <th className="py-2.5 px-4 font-semibold">Tank · Grade</th>
                <th className="py-2.5 px-4 font-semibold">Type</th>
                <th className="py-2.5 px-4 font-semibold text-right">Dip (mm)</th>
                <th className="py-2.5 px-4 font-semibold text-right">Water (mm)</th>
                <th className="py-2.5 px-4 font-semibold text-right">Dip Volume</th>
                <th className="py-2.5 px-4 font-semibold text-right">Book Stock</th>
                <th className="py-2.5 px-4 font-semibold text-right">Variance</th>
                <th className="py-2.5 px-4 font-semibold">Recorded By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredReadings.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-6 px-4 text-center text-slate-500 dark:text-slate-400">
                    No dip readings logged for the selected filter.
                  </td>
                </tr>
              ) : (
                filteredReadings.map((dip) => (
                  <tr key={dip.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-4 font-mono tabular-nums text-slate-600 dark:text-slate-400">
                      {dip.recordedAtLabel}
                    </td>
                    <td className="py-2.5 px-4 font-mono font-medium text-slate-900 dark:text-white">
                      {dip.tankCode} · {dip.gradeCode}
                    </td>
                    <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300">
                      {dip.readingType.replace(/_/g, ' ')}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200">
                      {dip.dipMm}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200">
                      {dip.waterDipMm}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                      {formatLitres(dip.calculatedVolumeLitres)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {formatLitres(dip.bookStockLitres)}
                    </td>
                    <td
                      className={`py-2.5 px-4 text-right font-mono tabular-nums font-semibold ${
                        Math.abs(dip.varianceLitres) > 100
                          ? 'text-red-700 dark:text-red-400'
                          : 'text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {dip.varianceLitres >= 0 ? '+' : ''}
                      {dip.varianceLitres.toFixed(2)} L
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">
                      {dip.recordedByName}
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
