import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { DATABASE_TABLES } from '../data/schemaData';
import { SYSTEM_MODULES } from '../data/rbacData';
import { ModuleId } from '../data/types';

interface CollectionsTablesViewProps {
  initialModuleFilter?: ModuleId | 'ALL';
}

export const CollectionsTablesView: React.FC<CollectionsTablesViewProps> = ({
  initialModuleFilter = 'ALL',
}) => {
  const [moduleFilter, setModuleFilter] = useState<string>(initialModuleFilter);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTableId, setSelectedTableId] = useState<string>(DATABASE_TABLES[0].id);
  const [structureMode, setStructureMode] = useState<'both' | 'relational' | 'nosql'>('both');

  const filteredTables = useMemo(() => {
    return DATABASE_TABLES.filter((t) => {
      const modMatch = moduleFilter === 'ALL' || t.moduleId === moduleFilter;
      const q = searchQuery.trim().toLowerCase();
      const qMatch =
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.collectionPath.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q);
      return modMatch && qMatch;
    });
  }, [moduleFilter, searchQuery]);

  const activeTable = useMemo(() => {
    return (
      filteredTables.find((t) => t.id === selectedTableId) ??
      filteredTables[0] ??
      DATABASE_TABLES[0]
    );
  }, [filteredTables, selectedTableId]);

  return (
    <div className="space-y-6">
      {/* Header & Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-slate-900">
              03. Collections & Tables Structure
            </h1>
            <p className="text-sm text-slate-600">
              Dual-model storage blueprint mapping every PostgreSQL table, index, and foreign key to its NoSQL /
              Firestore document hierarchy and partition strategy.
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
            <button
              type="button"
              onClick={() => setStructureMode('both')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                structureMode === 'both' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Side-by-Side
            </button>
            <button
              type="button"
              onClick={() => setStructureMode('relational')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                structureMode === 'relational'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              SQL Table
            </button>
            <button
              type="button"
              onClick={() => setStructureMode('nosql')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                structureMode === 'nosql' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              NoSQL Collection
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-slate-200">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search table or collection path..."
              className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-md bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 w-64"
            />
          </div>

          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            aria-label="Filter by module"
            className="px-3 py-1.5 text-xs border border-slate-300 rounded-md bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="ALL">All 11 Modules</option>
            {SYSTEM_MODULES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>

          <span className="text-xs text-slate-500 font-mono tabular-nums ml-auto">
            Showing {filteredTables.length} of {DATABASE_TABLES.length} structures
          </span>
        </div>
      </div>

      {/* Directory Grid + Detail View */}
      {filteredTables.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-10 text-center space-y-2">
          <div className="text-sm font-medium text-slate-900">No matching tables or collections</div>
          <p className="text-xs text-slate-500">Clear your module filter or search term to view all 28 structures.</p>
          <button
            type="button"
            onClick={() => {
              setModuleFilter('ALL');
              setSearchQuery('');
            }}
            className="mt-2 px-3 py-1.5 text-xs font-medium text-blue-700 hover:underline"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Left Master List */}
          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
              Table / Collection Registry
            </div>
            <div className="divide-y divide-slate-100 max-h-[680px] overflow-y-auto">
              {filteredTables.map((t) => {
                const isSelected = t.id === activeTable.id;
                const mod = SYSTEM_MODULES.find((m) => m.id === t.moduleId);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTableId(t.id)}
                    className={`w-full text-left px-4 py-3 transition-colors ${
                      isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`font-mono text-xs font-semibold ${
                          isSelected ? 'text-blue-700' : 'text-slate-900'
                        }`}
                      >
                        {t.name}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                        {t.columns.length} fields
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 truncate font-mono">
                      {t.collectionPath}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      {mod?.name} · {t.collectionModel}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Structure Specification */}
          <div className="lg:col-span-8 space-y-4">
            {/* Summary Strip */}
            <div className="bg-white border border-slate-200 rounded-lg p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-mono text-lg font-semibold text-slate-900">{activeTable.name}</h2>
                <span className="text-xs text-slate-500">
                  {activeTable.domain} · Partition Key:{' '}
                  <span className="font-mono text-slate-800">{activeTable.partitionKey}</span>
                </span>
              </div>
              <p className="text-sm text-slate-600 mt-2">{activeTable.description}</p>
            </div>

            {/* Relational SQL Table Structure */}
            {(structureMode === 'both' || structureMode === 'relational') && (
              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-900">
                    Relational Table Structure (PostgreSQL)
                  </span>
                  <span className="text-xs font-mono text-slate-500 tabular-nums">
                    {activeTable.columns.length} columns · {activeTable.indexes.length} indexes
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                        <th className="py-2.5 px-5">Field</th>
                        <th className="py-2.5 px-4">Type</th>
                        <th className="py-2.5 px-4">Nullable</th>
                        <th className="py-2.5 px-4">Key / FK</th>
                        <th className="py-2.5 px-5">Purpose</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {activeTable.columns.map((c) => (
                        <tr key={c.name} className="hover:bg-slate-50/70">
                          <td className="py-2.5 px-5 font-mono font-medium text-slate-900 whitespace-nowrap">
                            {c.name}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-blue-700 whitespace-nowrap">
                            {c.dataType}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-slate-500 whitespace-nowrap">
                            {c.nullable ? 'YES' : 'NO'}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-slate-700 whitespace-nowrap">
                            {c.key ? c.key : '—'}
                            {c.references ? ` (${c.references})` : ''}
                          </td>
                          <td className="py-2.5 px-5 text-slate-600">{c.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Document / NoSQL Collection Mapping */}
            {(structureMode === 'both' || structureMode === 'nosql') && (
              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-900">
                    Document Collection Structure (Firestore / MongoDB)
                  </span>
                  <span className="text-xs font-mono text-slate-600">
                    {activeTable.collectionModel} · {activeTable.collectionPath}
                  </span>
                </div>
                <div className="p-5 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pb-3 border-b border-slate-100">
                    <div>
                      <div className="text-slate-500">Collection Path</div>
                      <div className="font-mono text-slate-900 mt-0.5 break-all">
                        {activeTable.collectionPath}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">Storage Pattern</div>
                      <div className="font-mono text-slate-900 mt-0.5">{activeTable.collectionModel}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Shard / Tenant Key</div>
                      <div className="font-mono text-slate-900 mt-0.5">{activeTable.partitionKey}</div>
                    </div>
                  </div>

                  <div className="text-xs font-medium text-slate-700">Sample JSON Document</div>
                  <pre className="p-4 bg-slate-950 text-slate-100 rounded-md text-xs font-mono overflow-x-auto leading-relaxed">
                    <code>{JSON.stringify(activeTable.sampleDocument, null, 2)}</code>
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
