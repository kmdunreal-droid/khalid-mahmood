import React from 'react';
import {
  CheckCircle2,
  ShieldCheck,
  UserCheck,
  UserCog,
  X,
} from 'lucide-react';
import { ActiveRolePersona } from '../../data/shiftTypes';
import { useDashboardTelemetry } from '../../hooks/useDashboardTelemetry';
import { useFirebaseAuth } from '../auth/FirebaseProvider';
import { ArchitectureTab } from '../OverviewSection';
import { ManagerDashboard } from './ManagerDashboard';
import { OperatorDashboard } from './OperatorDashboard';
import { OwnerDashboard } from './OwnerDashboard';

interface DashboardsHubProps {
  onNavigateTab: (tab: ArchitectureTab) => void;
}

const DASHBOARD_ROLES: {
  id: ActiveRolePersona;
  label: string;
  icon: React.ReactNode;
}[] = [
  { id: 'OWNER', label: 'Owner', icon: <ShieldCheck className="w-4 h-4" /> },
  { id: 'MANAGER', label: 'Manager', icon: <UserCog className="w-4 h-4" /> },
  { id: 'OPERATOR', label: 'Operator', icon: <UserCheck className="w-4 h-4" /> },
];

export const DashboardsHub: React.FC<DashboardsHubProps> = ({ onNavigateTab }) => {
  const { activeRole, setActiveRole, isRoleLocked } = useFirebaseAuth();
  const telemetry = useDashboardTelemetry();

  return (
    <div className="space-y-5">
      {/* Clean Role Switcher (hidden when locked to Manager/Operator account) */}
      {!isRoleLocked && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Station Dashboard
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {telemetry.stationName}
            </p>
          </div>

          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            {DASHBOARD_ROLES.map((role) => {
              const isActive = activeRole === role.id;
              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => setActiveRole(role.id)}
                  className={`min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {role.icon}
                  <span>{role.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Action Confirmation */}
      {telemetry.actionFeedback && (
        <div
          role="status"
          className="rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-3 flex items-center justify-between gap-3 text-xs text-emerald-900 dark:text-emerald-200"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-medium">{telemetry.actionFeedback}</span>
          </div>
          <button
            type="button"
            onClick={telemetry.clearFeedback}
            className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
            aria-label="Dismiss message"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {activeRole === 'OWNER' && (
        <OwnerDashboard telemetry={telemetry} onNavigateTab={onNavigateTab} />
      )}
      {activeRole === 'MANAGER' && (
        <ManagerDashboard telemetry={telemetry} onNavigateTab={onNavigateTab} />
      )}
      {activeRole === 'OPERATOR' && (
        <OperatorDashboard telemetry={telemetry} onNavigateTab={onNavigateTab} />
      )}
    </div>
  );
};
