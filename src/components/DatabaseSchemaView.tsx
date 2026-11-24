import React, { useMemo, useState } from 'react';
import { Check, Copy, Download, Search } from 'lucide-react';
import { DATABASE_TABLES, SQL_ENUMS, SQL_VIEWS, generateFullPostgresDDL } from '../data/schemaData';
import { SYSTEM_MODULES } from '../data/rbacData';
import { DatabaseTable } from '../data/types';

type SchemaSubView = 'ddl' | 'enums' | 'views';

export const DatabaseSchemaView: React.FC = () => {
  const [subView, setSubView] = useState<SchemaSubView>('ddl');
  const [domainFilter, setDomainFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  const domains = ['ALL', 'Core & Security', 'Inventory & Supply', 'Forecourt Operations', 'Finance & Analytics'];

  const filteredTables = useMemo(() => {
    return DATABASE_TABLES.filter((t) => {
      const matchesDomain = domainFilter === 'ALL' || t.domain === domainFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.columns.some((c) => c.name.toLowerCase().includes(q));
      return matchesDomain && matchesQuery;
    });
  }, [domainFilter, searchQuery]);

  const ddlScript = useMemo(() => {
    return generateFullPostgresDDL(filteredTables);
  }, [filteredTables]);

  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(ddlScript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard fallback ignored if blocked
    }
  };

  const handleDownloadSql = () => {
    const fullDdl = generateFullPostgresDDL(DATABASE_TABLES);
    const blob = new Blob([fullDdl], { type: 'application/sql;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'petrol_pump_management_schema.sql';
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderTableDDL = (table: DatabaseTable) => {
    const modName = SYSTEM_MODULES.find((m) => m.id === table.moduleId)?.name ?? table.moduleId;
    return (
      <div key={table.id} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-baseline gap-3">
            <h3 className="font-mono text-sm font-semibold text-slate-900">{table.name}</h3>
            <span className="text-xs text-slate-500">
              {modName} · {table.domain} · {table.columns.length} columns
            </span>
          </div>
          <span className="text-xs font-mono text-slate-500 tabular-nums">
            Est. {table.estimatedGrowth}
          </span>
        </div>

        <div className="px-5 py-3 border-b border-slate-100 text-xs text-slate-600">
          {table.description}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-medium text-slate-500 bg-white">
                <th className="py-2.5 px-5">Column</th>
                <th className="py-2.5 px-4">PostgreSQL Type</th>
                <th className="py-2.5 px-4">Key / Constraint</th>
                <th className="py-2.5 px-4">Default</th>
                <th className="py-2.5 px-5">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {table.columns.map((col) => (
                <tr key={col.name} className="hover:bg-slate-50/60">
                  <td className="py-2.5 px-5 font-mono font-medium text-slate-900 whitespace-nowrap">
                    {col.name}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-blue-700 whitespace-nowrap">
                    {col.dataType}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-slate-700 whitespace-nowrap">
                    {[
                      col.key,
                      !col.nullable ? 'NOT NULL' : 'NULL',
                      col.references ? `-> ${col.references}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-slate-500 whitespace-nowrap">
                    {col.defaultValue ?? '—'}
                  </td>
                  <td className="py-2.5 px-5 text-slate-600">{col.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {table.indexes.length > 0 && (
          <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-200 text-xs font-mono text-slate-600">
            Indexes: {table.indexes.map((idx) => `${idx.name} (${idx.columns.join(', ')})`).join(' · ')}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-slate-900">01. Complete Database Schema</h1>
            <p className="text-sm text-slate-600">
              Normalized PostgreSQL 16 schema with UUID primary keys, strict foreign key referential integrity, enum
              constraints, and analytical SQL views.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopySql}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border border-slate-300 bg-white text-slate-700 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied SQL' : 'Copy Filtered SQL'}</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadSql}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-blue-700 text-white rounded-md hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Full .SQL</span>
            </button>
          </div>
        </div>

        {/* Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-200">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
            <button
              type="button"
              onClick={() => setSubView('ddl')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                subView === 'ddl' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tables ({filteredTables.length})
            </button>
            <button
              type="button"
              onClick={() => setSubView('enums')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                subView === 'enums' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Enums ({SQL_ENUMS.length})
            </button>
            <button
              type="button"
              onClick={() => setSubView('views')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                subView === 'views' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              SQL Views ({SQL_VIEWS.length})
            </button>
          </div>

          {subView === 'ddl' && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter tables or columns..."
                  className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-md bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 w-56"
                />
              </div>

              <select
                value={domainFilter}
                onChange={(e) => setDomainFilter(e.target.value)}
                aria-label="Filter by domain"
                className="px-3 py-1.5 text-xs border border-slate-300 rounded-md bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {domains.map((d) => (
                  <option key={d} value={d}>
                    {d === 'ALL' ? 'All Domains' : d}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Main Schema Content */}
      {subView === 'ddl' && (
        <div className="space-y-4">
          {filteredTables.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-lg p-10 text-center space-y-2">
              <div className="text-sm font-medium text-slate-900">No matching tables found</div>
              <p className="text-xs text-slate-500">Adjust your search keyword or reset the domain filter.</p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setDomainFilter('ALL');
                }}
                className="mt-2 px-3 py-1.5 text-xs font-medium text-blue-700 hover:underline"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            filteredTables.map(renderTableDDL)
          )}
        </div>
      )}

      {subView === 'enums' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="py-3 px-6">Enum Name</th>
                  <th className="py-3 px-4">Allowed Values</th>
                  <th className="py-3 px-6">Domain Purpose</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {SQL_ENUMS.map((en) => (
                  <tr key={en.name} className="hover:bg-slate-50/70">
                    <td className="py-3 px-6 font-mono font-semibold text-slate-900 whitespace-nowrap">
                      {en.name}
                    </td>
                    <td className="py-3 px-4 font-mono text-blue-700">
                      {en.values.join(' | ')}
                    </td>
                    <td className="py-3 px-6 text-slate-600">{en.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subView === 'views' && (
        <div className="space-y-4">
          {SQL_VIEWS.map((view) => (
            <div key={view.name} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="font-mono text-sm font-semibold text-slate-900">{view.name}</h3>
                  <p className="text-xs text-slate-600 mt-0.5">{view.purpose}</p>
                </div>
                <span className="text-xs font-mono text-slate-500">
                  Sources: {view.sourceTables.join(', ')}
                </span>
              </div>
              <pre className="p-5 bg-slate-950 text-slate-100 text-xs font-mono overflow-x-auto leading-relaxed">
                <code>{view.sql}</code>
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
