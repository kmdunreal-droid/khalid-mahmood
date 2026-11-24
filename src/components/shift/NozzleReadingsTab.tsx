import React from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { ActiveRolePersona, NozzleReading, ShiftWorkflowStatus } from '../../data/shiftTypes';
import { computeNozzleMetrics, formatCurrency, formatLitres } from '../../utils/shiftMath';

interface NozzleReadingsTabProps {
  nozzles: NozzleReading[];
  shiftStatus: ShiftWorkflowStatus;
  rolePersona: ActiveRolePersona;
  onUpdateNozzle: (nozzleId: string, patch: Partial<NozzleReading>) => void;
}

export const NozzleReadingsTab: React.FC<NozzleReadingsTabProps> = ({
  nozzles,
  shiftStatus,
  rolePersona,
  onUpdateNozzle,
}) => {
  const isLocked = shiftStatus === 'APPROVED';
  const canEditOpening =
    !isLocked && (rolePersona === 'MANAGER' || rolePersona === 'OWNER') && shiftStatus === 'OPEN';
  const canEditClosing = !isLocked && (shiftStatus === 'OPEN' || rolePersona !== 'OPERATOR');

  const totals = nozzles.reduce(
    (acc, n) => {
      const m = computeNozzleMetrics(n);
      acc.netLitres += m.netLitres;
      acc.testingLitres += n.testingLitres;
      acc.grossAmount += m.grossAmount;
      if (m.hasInvalidReading) acc.invalidCount += 1;
      return acc;
    },
    { netLitres: 0, testingLitres: 0, grossAmount: 0, invalidCount: 0 }
  );

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Nozzle Opening & Closing Meter Readings
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Net dispensed volume equals Closing Reading minus Opening Reading minus testing pours.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {totals.invalidCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 font-semibold text-red-700 dark:text-red-400">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{totals.invalidCount} nozzle closing reading below opening</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>All totalizer deltas valid</span>
            </span>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-xs font-medium text-slate-600 dark:text-slate-400">
              <th className="py-3 px-5">Nozzle / Island</th>
              <th className="py-3 px-4">Fuel Grade</th>
              <th className="py-3 px-4">Operator</th>
              <th className="py-3 px-4 text-right">Rate / L</th>
              <th className="py-3 px-4 text-right">Opening Reading</th>
              <th className="py-3 px-4 text-right">Closing Reading</th>
              <th className="py-3 px-4 text-right">Testing (L)</th>
              <th className="py-3 px-4 text-right">Net Litres</th>
              <th className="py-3 px-5 text-right">Gross Sales</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {nozzles.map((nozzle) => {
              const metrics = computeNozzleMetrics(nozzle);
              return (
                <tr key={nozzle.nozzleId} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-5 whitespace-nowrap">
                    <div className="font-mono font-semibold text-slate-900 dark:text-white">{nozzle.nozzleCode}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{nozzle.dispenserCode}</div>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="font-medium text-slate-900 dark:text-slate-100">{nozzle.productName}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{nozzle.sku}</div>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap text-slate-700 dark:text-slate-300">{nozzle.operatorName}</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    {formatCurrency(nozzle.unitPrice)}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <input
                      type="number"
                      step="0.01"
                      disabled={!canEditOpening}
                      value={nozzle.openingReading}
                      onChange={(e) =>
                        onUpdateNozzle(nozzle.nozzleId, {
                          openingReading: parseFloat(e.target.value) || 0,
                        })
                      }
                      aria-label={`${nozzle.nozzleCode} opening reading`}
                      className="w-32 px-2.5 py-1.5 text-right font-mono tabular-nums border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white disabled:bg-slate-100 dark:disabled:bg-slate-800/60 disabled:text-slate-500 dark:disabled:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <input
                      type="number"
                      step="0.01"
                      disabled={!canEditClosing}
                      value={nozzle.closingReading}
                      onChange={(e) =>
                        onUpdateNozzle(nozzle.nozzleId, {
                          closingReading: parseFloat(e.target.value) || 0,
                        })
                      }
                      aria-label={`${nozzle.nozzleCode} closing reading`}
                      className={`w-32 px-2.5 py-1.5 text-right font-mono tabular-nums border rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white disabled:bg-slate-100 dark:disabled:bg-slate-800/60 disabled:text-slate-500 dark:disabled:text-slate-400 focus:outline-none focus:ring-2 ${
                        metrics.hasInvalidReading
                          ? 'border-red-500 focus:ring-red-600 text-red-700 dark:text-red-400'
                          : 'border-slate-300 dark:border-slate-700 focus:ring-blue-600'
                      }`}
                    />
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      disabled={!canEditClosing}
                      value={nozzle.testingLitres}
                      onChange={(e) =>
                        onUpdateNozzle(nozzle.nozzleId, {
                          testingLitres: Math.max(0, parseFloat(e.target.value) || 0),
                        })
                      }
                      aria-label={`${nozzle.nozzleCode} testing litres`}
                      className="w-20 px-2 py-1.5 text-right font-mono tabular-nums border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white disabled:bg-slate-100 dark:disabled:bg-slate-800/60 disabled:text-slate-500 dark:disabled:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                    {formatLitres(metrics.netLitres)}
                  </td>
                  <td className="py-3 px-5 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                    {formatCurrency(metrics.grossAmount)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-xs font-semibold text-slate-900 dark:text-white">
              <td colSpan={6} className="py-3 px-5">
                Shift Totalizer Summary ({nozzles.length} nozzles)
              </td>
              <td className="py-3 px-4 text-right font-mono tabular-nums">
                {formatLitres(totals.testingLitres)}
              </td>
              <td className="py-3 px-4 text-right font-mono tabular-nums">
                {formatLitres(totals.netLitres)}
              </td>
              <td className="py-3 px-5 text-right font-mono tabular-nums text-blue-700 dark:text-blue-400">
                {formatCurrency(totals.grossAmount)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
