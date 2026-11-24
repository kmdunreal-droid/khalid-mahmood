import React, { useMemo, useState } from 'react';
import { CheckCircle2, Eye, Lock, ShieldAlert, SlidersHorizontal, XCircle } from 'lucide-react';
import { RBAC_MATRIX, ROLE_PROFILES, SYSTEM_MODULES } from '../data/rbacData';
import { AccessLevel, RoleId } from '../data/types';

const ACCESS_META: Record<
  AccessLevel,
  { label: string; textClass: string; icon: React.ReactNode }
> = {
  FULL: {
    label: 'Full Access',
    textClass: 'text-emerald-700',
    icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />,
  },
  APPROVE: {
    label: 'Approve / Override',
    textClass: 'text-blue-700',
    icon: <ShieldAlert className="w-3.5 h-3.5 text-blue-700 shrink-0" />,
  },
  SCOPED: {
    label: 'Scoped Access',
    textClass: 'text-amber-700',
    icon: <SlidersHorizontal className="w-3.5 h-3.5 text-amber-700 shrink-0" />,
  },
  READ_ONLY: {
    label: 'Read Only',
    textClass: 'text-slate-700',
    icon: <Eye className="w-3.5 h-3.5 text-slate-600 shrink-0" />,
  },
  NONE: {
    label: 'Denied',
    textClass: 'text-red-700',
    icon: <XCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />,
  },
};

export const RbacMatrixView: React.FC = () => {
  const [selectedRole, setSelectedRole] = useState<'ALL' | RoleId>('ALL');
  const [moduleFilter, setModuleFilter] = useState<string>('ALL');

  const filteredModules = useMemo(() => {
    return RBAC_MATRIX.filter((m) => moduleFilter === 'ALL' || m.moduleId === moduleFilter);
  }, [moduleFilter]);

  const visibleRoles: RoleId[] =
    selectedRole === 'ALL' ? ['OWNER', 'MANAGER', 'OPERATOR'] : [selectedRole];

  const renderPermissionCell = (level: AccessLevel, rule: string) => {
    const meta = ACCESS_META[level];
    return (
      <div className="space-y-1">
        <div className={`inline-flex items-center gap-1.5 text-xs font-semibold ${meta.textClass}`}>
          {meta.icon}
          <span>{meta.label}</span>
        </div>
        <div className="text-xs text-slate-600 leading-snug">{rule}</div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header & Role Simulator Controls */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-slate-900">
              04. User Roles & Permissions Matrix
            </h1>
            <p className="text-sm text-slate-600">
              Server-enforced RBAC policy matrix across all 3 operational roles and 11 Petrol Pump modules, including
              multi-station tenant boundaries and shift-lock invariants.
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
            {(['ALL', 'OWNER', 'MANAGER', 'OPERATOR'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setSelectedRole(r)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                  selectedRole === r
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {r === 'ALL' ? 'Compare All Roles' : ROLE_PROFILES[r].title}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-200">
          <div className="flex flex-wrap items-center gap-5 text-xs text-slate-600">
            <span className="font-medium text-slate-800">Legend:</span>
            {(['FULL', 'APPROVE', 'SCOPED', 'READ_ONLY', 'NONE'] as AccessLevel[]).map((lvl) => (
              <span key={lvl} className="inline-flex items-center gap-1.5">
                {ACCESS_META[lvl].icon}
                <span>{ACCESS_META[lvl].label}</span>
              </span>
            ))}
          </div>

          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            aria-label="Filter permissions by module"
            className="px-3 py-1.5 text-xs border border-slate-300 rounded-md bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="ALL">All 11 Modules</option>
            {SYSTEM_MODULES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Role Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {visibleRoles.map((roleId) => {
          const profile = ROLE_PROFILES[roleId];
          return (
            <div key={roleId} className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900">{profile.title}</h2>
                <span className="text-xs font-mono text-slate-500">Tier {profile.hierarchyLevel}</span>
              </div>
              <div className="text-xs font-medium text-blue-700">{profile.scope}</div>
              <p className="text-xs text-slate-600 leading-relaxed">{profile.summary}</p>
              <div className="pt-2 border-t border-slate-100 space-y-1.5">
                <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1.5">
                  <Lock className="w-3 h-3 text-slate-400" />
                  <span>{profile.authPolicy}</span>
                </div>
                <ul className="space-y-1 text-xs text-slate-700 list-disc pl-4">
                  {profile.keyResponsibilities.map((resp) => (
                    <li key={resp}>{resp}</li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>

      {/* Granular 11-Module Permissions Matrix Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            Module-Level Capability & Data-Scope Enforcement Matrix
          </h2>
          <span className="text-xs font-mono text-slate-500 tabular-nums">
            {filteredModules.length} modules displayed
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-white text-xs font-semibold text-slate-700">
                <th className="py-3.5 px-6 w-48">Module</th>
                <th className="py-3.5 px-4 w-72">Operation / Action</th>
                {visibleRoles.includes('OWNER') && <th className="py-3.5 px-5">Owner</th>}
                {visibleRoles.includes('MANAGER') && <th className="py-3.5 px-5">Manager</th>}
                {visibleRoles.includes('OPERATOR') && <th className="py-3.5 px-5">Operator</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {filteredModules.map((mod) => (
                <React.Fragment key={mod.moduleId}>
                  {mod.capabilities.map((cap, idx) => (
                    <tr key={`${mod.moduleId}-${cap.action}`} className="hover:bg-slate-50/70">
                      {idx === 0 && (
                        <td
                          rowSpan={mod.capabilities.length}
                          className="py-4 px-6 align-top bg-slate-50/40 border-r border-slate-200"
                        >
                          <div className="font-semibold text-slate-900 text-sm">{mod.moduleName}</div>
                          <div className="mt-2 space-y-1 text-[11px] text-slate-500">
                            {visibleRoles.includes('OWNER') && (
                              <div>
                                <span className="font-medium text-slate-700">Owner:</span>{' '}
                                {mod.dataScopeSummary.owner}
                              </div>
                            )}
                            {visibleRoles.includes('MANAGER') && (
                              <div>
                                <span className="font-medium text-slate-700">Manager:</span>{' '}
                                {mod.dataScopeSummary.manager}
                              </div>
                            )}
                            {visibleRoles.includes('OPERATOR') && (
                              <div>
                                <span className="font-medium text-slate-700">Operator:</span>{' '}
                                {mod.dataScopeSummary.operator}
                              </div>
                            )}
                          </div>
                        </td>
                      )}
                      <td className="py-3.5 px-4 font-medium text-slate-900 align-top">
                        {cap.action}
                      </td>
                      {visibleRoles.includes('OWNER') && (
                        <td className="py-3.5 px-5 align-top">
                          {renderPermissionCell(cap.owner.level, cap.owner.rule)}
                        </td>
                      )}
                      {visibleRoles.includes('MANAGER') && (
                        <td className="py-3.5 px-5 align-top">
                          {renderPermissionCell(cap.manager.level, cap.manager.rule)}
                        </td>
                      )}
                      {visibleRoles.includes('OPERATOR') && (
                        <td className="py-3.5 px-5 align-top">
                          {renderPermissionCell(cap.operator.level, cap.operator.rule)}
                        </td>
                      )}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
