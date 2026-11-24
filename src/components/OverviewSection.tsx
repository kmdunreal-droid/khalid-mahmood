import React from 'react';
import { ArrowRight, Database, GitBranch, Layers, ShieldCheck, Workflow } from 'lucide-react';
import { ROLE_PROFILES, SYSTEM_MODULES } from '../data/rbacData';
import { DATABASE_TABLES, SQL_ENUMS, SQL_VIEWS, TABLE_RELATIONSHIPS } from '../data/schemaData';
import { WORKFLOW_DIAGRAMS } from '../data/workflowData';
import { ModuleId } from '../data/types';

export type ArchitectureTab =
  | 'dashboards'
  | 'auth_module'
  | 'firestore_schema'
  | 'shift_module'
  | 'purchase_module'
  | 'sales_module'
  | 'stock_module'
  | 'accounting_module'
  | 'reports_module'
  | 'overview'
  | 'schema'
  | 'erd'
  | 'collections'
  | 'rbac'
  | 'workflows';

interface OverviewSectionProps {
  onNavigate: (tab: ArchitectureTab, moduleFilter?: ModuleId) => void;
}

export const OverviewSection: React.FC<OverviewSectionProps> = ({ onNavigate }) => {
  const deliverables: {
    id: ArchitectureTab;
    index: string;
    title: string;
    metric: string;
    summary: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'schema',
      index: '01',
      title: 'Complete Database Schema',
      metric: `${DATABASE_TABLES.length} tables · ${SQL_ENUMS.length} enums · ${SQL_VIEWS.length} views`,
      summary: 'Production PostgreSQL 16 DDL with UUID primary keys, strict foreign key actions, check constraints, and composite indexes.',
      icon: <Database className="w-4 h-4 text-blue-700" />,
    },
    {
      id: 'erd',
      index: '02',
      title: 'Entity Relationship Diagram',
      metric: `${TABLE_RELATIONSHIPS.length} foreign key edges · 4 domains`,
      summary: 'Interactive relational canvas with cardinality labels, domain grouping, and click-to-trace upstream/downstream dependencies.',
      icon: <GitBranch className="w-4 h-4 text-blue-700" />,
    },
    {
      id: 'collections',
      index: '03',
      title: 'Collections & Tables Structure',
      metric: 'SQL columns + NoSQL document mapping',
      summary: 'Side-by-side column definitions, index blueprints, Firestore/MongoDB collection paths, partition keys, and sample JSON payloads.',
      icon: <Layers className="w-4 h-4 text-blue-700" />,
    },
    {
      id: 'rbac',
      index: '04',
      title: 'User Roles & Permissions Matrix',
      metric: '3 roles · 11 modules · 27 capability rules',
      summary: 'Granular access matrix for Owner, Manager, and Operator including tenant isolation, shift locking, and financial masking.',
      icon: <ShieldCheck className="w-4 h-4 text-blue-700" />,
    },
    {
      id: 'workflows',
      index: '05',
      title: 'Workflow Diagrams',
      metric: `${WORKFLOW_DIAGRAMS.length} core operational lifecycles`,
      summary: 'Interactive state-transition flows for Shift Settlement, Tanker Unloading, Fleet Credit Guards, and Double-Entry Posting.',
      icon: <Workflow className="w-4 h-4 text-blue-700" />,
    },
  ];

  return (
    <div className="space-y-10">
      {/* Hero Summary */}
      <section className="bg-white border border-slate-200 rounded-lg p-8">
        <div className="max-w-3xl space-y-3">
          <div className="text-xs font-medium text-slate-500">
            System Architecture Blueprint · Multi-Station Petrol Pump Operations
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 text-balance">
            Petrol Pump Management System Architecture
          </h1>
          <p className="text-sm leading-relaxed text-slate-600">
            A cohesive relational and document-mapped architecture engineered for forecourt dispensing operations,
            underground tank dip reconciliation, OMC tanker deliveries, fleet credit control, and automated double-entry
            accounting across three privilege tiers.
          </p>
        </div>

        {/* 4-column Architectural KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mt-8 pt-6 border-t border-slate-200">
          <div>
            <div className="text-xs text-slate-500">Core Modules</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900 tabular-nums font-mono">11</div>
            <div className="mt-0.5 text-xs text-slate-500">Auth through Notifications</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Role Tiers</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900 tabular-nums font-mono">3</div>
            <div className="mt-0.5 text-xs text-slate-500">Owner · Manager · Operator</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Normalized Entities</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900 tabular-nums font-mono">
              {DATABASE_TABLES.length}
            </div>
            <div className="mt-0.5 text-xs text-slate-500">Tables + {SQL_VIEWS.length} SQL views</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Referential Links</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900 tabular-nums font-mono">
              {TABLE_RELATIONSHIPS.length}
            </div>
            <div className="mt-0.5 text-xs text-slate-500">Enforced FK constraints</div>
          </div>
        </div>
      </section>

      {/* Deliverables Index */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Architecture Deliverables</h2>
          <span className="text-xs text-slate-500">Select any artifact to inspect</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {deliverables.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className="group text-left bg-white border border-slate-200 rounded-lg p-6 hover:border-blue-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-medium text-slate-400 tabular-nums">
                  {item.index}
                </span>
                {item.icon}
              </div>
              <h3 className="mt-3 text-base font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">
                {item.title}
              </h3>
              <div className="mt-1 text-xs font-medium text-slate-500 font-mono tabular-nums">
                {item.metric}
              </div>
              <p className="mt-3 text-sm text-slate-600 leading-relaxed">{item.summary}</p>
              <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-blue-700">
                <span>Open Specification</span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* 3 Role Hierarchy Summary */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Role Hierarchy & Tenancy Boundaries</h2>
          <button
            type="button"
            onClick={() => onNavigate('rbac')}
            className="text-xs font-medium text-blue-700 hover:underline whitespace-nowrap shrink-0"
          >
            Inspect Full Matrix
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {(['OWNER', 'MANAGER', 'OPERATOR'] as const).map((roleKey) => {
            const role = ROLE_PROFILES[roleKey];
            return (
              <div key={roleKey} className="bg-white border border-slate-200 rounded-lg p-6 space-y-3">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-base font-semibold text-slate-900">{role.title}</h3>
                  <span className="text-xs text-slate-500 font-mono">{role.scope}</span>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">{role.summary}</p>
                <div className="pt-3 border-t border-slate-100 text-xs text-slate-500">
                  {role.authPolicy}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 11-Module Directory Table */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">11 System Modules & Primary Data Ownership</h2>
          <span className="text-xs text-slate-500 font-mono tabular-nums">11 Modules</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                <th className="py-3 px-6">Module</th>
                <th className="py-3 px-4">Domain</th>
                <th className="py-3 px-4">Primary Tables / Views</th>
                <th className="py-3 px-6">Architectural Responsibility</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {SYSTEM_MODULES.map((mod) => (
                <tr key={mod.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-6 font-medium text-slate-900 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => onNavigate('collections', mod.id)}
                      className="hover:text-blue-700 hover:underline text-left"
                    >
                      {mod.name}
                    </button>
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">{mod.domain}</td>
                  <td className="py-3 px-4 font-mono text-xs text-slate-700">
                    {mod.primaryTables.join(', ')}
                  </td>
                  <td className="py-3 px-6 text-slate-600 text-xs leading-relaxed">{mod.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
