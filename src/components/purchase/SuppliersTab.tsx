import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Edit3,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { ActiveRolePersona } from '../../data/shiftTypes';
import { SupplierCategory, SupplierRecord, SupplierStatus } from '../../data/purchaseTypes';
import { formatCurrency } from '../../utils/shiftMath';

interface SuppliersTabProps {
  suppliers: SupplierRecord[];
  rolePersona: ActiveRolePersona;
  onCreateSupplier: (supplier: Omit<SupplierRecord, 'id' | 'stationId'>) => Promise<void> | void;
  onUpdateSupplier: (id: string, patch: Partial<SupplierRecord>) => Promise<void> | void;
}

const CATEGORY_LABELS: Record<SupplierCategory, string> = {
  OMC_FUEL: 'OMC Fuel Depot',
  LUBRICANT: 'Lubricants',
  ADDITIVE: 'DEF & Additives',
  EQUIPMENT: 'Station Equipment',
};

export const SuppliersTab: React.FC<SuppliersTabProps> = ({
  suppliers,
  rolePersona,
  onCreateSupplier,
  onUpdateSupplier,
}) => {
  const canManageSuppliers = rolePersona === 'OWNER';
  const [search, setSearch] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | SupplierCategory>('ALL');
  const [showForm, setShowForm] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  // Form fields
  const [supplierCode, setSupplierCode] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [category, setCategory] = useState<SupplierCategory>('OMC_FUEL');
  const [gstNumber, setGstNumber] = useState<string>('');
  const [contactPerson, setContactPerson] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [depotLocation, setDepotLocation] = useState<string>('');
  const [paymentTermsDays, setPaymentTermsDays] = useState<string>('7');
  const [creditLimit, setCreditLimit] = useState<string>('2500000');
  const [status, setStatus] = useState<SupplierStatus>('ACTIVE');

  const filteredSuppliers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return suppliers.filter((s) => {
      if (categoryFilter !== 'ALL' && s.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.supplierCode.toLowerCase().includes(q) ||
        s.gstNumber.toLowerCase().includes(q) ||
        s.contactPerson.toLowerCase().includes(q)
      );
    });
  }, [suppliers, search, categoryFilter]);

  const openCreateForm = () => {
    setEditingId(null);
    setSupplierCode(`VND-${String(suppliers.length + 1).padStart(3, '0')}`);
    setName('');
    setCategory('OMC_FUEL');
    setGstNumber('');
    setContactPerson('');
    setPhone('');
    setEmail('');
    setDepotLocation('');
    setPaymentTermsDays('7');
    setCreditLimit('2500000');
    setStatus('ACTIVE');
    setFormError(null);
    setShowForm(true);
  };

  const openEditForm = (s: SupplierRecord) => {
    setEditingId(s.id);
    setSupplierCode(s.supplierCode);
    setName(s.name);
    setCategory(s.category);
    setGstNumber(s.gstNumber);
    setContactPerson(s.contactPerson);
    setPhone(s.phone);
    setEmail(s.email);
    setDepotLocation(s.depotLocation);
    setPaymentTermsDays(String(s.paymentTermsDays));
    setCreditLimit(String(s.creditLimit));
    setStatus(s.status);
    setFormError(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!canManageSuppliers) {
      setFormError('Only the Station Owner can add or modify approved supplier terms.');
      return;
    }

    const codeTrim = supplierCode.trim().slice(0, 24);
    const nameTrim = name.trim().slice(0, 140);
    const gstTrim = gstNumber.trim().toUpperCase().slice(0, 32);
    const contactTrim = contactPerson.trim().slice(0, 100);
    const phoneTrim = phone.trim().slice(0, 24);
    const terms = Number(paymentTermsDays);
    const limit = Number(creditLimit);

    if (codeTrim.length < 2 || nameTrim.length < 2 || gstTrim.length < 5 || contactTrim.length < 2 || phoneTrim.length < 4) {
      setFormError('Supplier code, name, GST number (5+ chars), contact person, and phone are required.');
      return;
    }
    if (!Number.isFinite(terms) || terms < 0 || !Number.isFinite(limit) || limit < 0) {
      setFormError('Payment terms days and credit limit must be valid non-negative numbers.');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await onUpdateSupplier(editingId, {
          name: nameTrim,
          category,
          gstNumber: gstTrim,
          contactPerson: contactTrim,
          phone: phoneTrim,
          email: email.trim().slice(0, 160),
          depotLocation: depotLocation.trim().slice(0, 160),
          paymentTermsDays: terms,
          creditLimit: limit,
          status,
        });
      } else {
        await onCreateSupplier({
          supplierCode: codeTrim,
          name: nameTrim,
          category,
          gstNumber: gstTrim,
          contactPerson: contactTrim,
          phone: phoneTrim,
          email: email.trim().slice(0, 160),
          depotLocation: depotLocation.trim().slice(0, 160),
          paymentTermsDays: terms,
          creditLimit: limit,
          outstandingBalance: 0,
          status,
        });
      }
      setShowForm(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save supplier.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search supplier, code, GSTIN..."
              className="pl-8 pr-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 rounded-xl w-64 focus:outline-none focus:border-blue-600"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as 'ALL' | SupplierCategory)}
            className="px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:border-blue-600"
          >
            <option value="ALL">All Categories</option>
            <option value="OMC_FUEL">OMC Fuel Depot</option>
            <option value="LUBRICANT">Lubricants</option>
            <option value="ADDITIVE">DEF & Additives</option>
            <option value="EQUIPMENT">Equipment</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          {!canManageSuppliers && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Supplier terms are Owner-controlled
            </span>
          )}
          {canManageSuppliers && (
            <button
              type="button"
              onClick={openCreateForm}
              className="min-h-[38px] inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Supplier</span>
            </button>
          )}
        </div>
      </div>

      {/* Add / Edit Drawer Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>{editingId ? 'Edit Supplier Terms' : 'Register New Fuel / Lubricant Supplier'}</span>
            </div>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white"
              aria-label="Close supplier form"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {formError && (
            <div className="flex items-center gap-2 text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Supplier Code
              </label>
              <input
                type="text"
                value={supplierCode}
                onChange={(e) => setSupplierCode(e.target.value)}
                maxLength={24}
                disabled={Boolean(editingId)}
                required
                className="w-full px-3 py-2 text-xs font-mono border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white rounded-lg disabled:bg-slate-100 dark:disabled:bg-slate-800/60"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Registered Supplier / Depot Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={140}
                required
                placeholder="e.g., PSO Karachi Bulk Terminal"
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white placeholder:text-slate-400 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Supply Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as SupplierCategory)}
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              >
                <option value="OMC_FUEL">OMC Fuel Depot</option>
                <option value="LUBRICANT">Lubricants</option>
                <option value="ADDITIVE">DEF & Additives</option>
                <option value="EQUIPMENT">Station Equipment</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Tax / NTN / GSTIN
              </label>
              <input
                type="text"
                value={gstNumber}
                onChange={(e) => setGstNumber(e.target.value)}
                maxLength={32}
                required
                placeholder="29AAACH1111F1Z2"
                className="w-full px-3 py-2 text-xs font-mono border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Depot / Key Contact
              </label>
              <input
                type="text"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                maxLength={100}
                required
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Contact Phone
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={24}
                required
                className="w-full px-3 py-2 text-xs font-mono border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Dispatch Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={160}
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white rounded-lg"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Terminal / Depot Address
              </label>
              <input
                type="text"
                value={depotLocation}
                onChange={(e) => setDepotLocation(e.target.value)}
                maxLength={160}
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Payment Terms (Days)
              </label>
              <input
                type="number"
                min={0}
                value={paymentTermsDays}
                onChange={(e) => setPaymentTermsDays(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs font-mono border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Credit Limit (Rs.)
              </label>
              <input
                type="number"
                min={0}
                step="1000"
                value={creditLimit}
                onChange={(e) => setCreditLimit(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs font-mono border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Account Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as SupplierStatus)}
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="ON_HOLD">ON_HOLD</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-3.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50"
            >
              {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Supplier'}
            </button>
          </div>
        </form>
      )}

      {/* Supplier Directory Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4">Supplier</th>
                <th className="py-3 px-4">Category & Tax ID</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4 text-right">Terms</th>
                <th className="py-3 px-4 text-right">Credit Limit</th>
                <th className="py-3 px-4 text-right">Outstanding</th>
                <th className="py-3 px-4">Status</th>
                {canManageSuppliers && <th className="py-3 px-4 text-right">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              {filteredSuppliers.map((s) => {
                const utilizationPct = s.creditLimit > 0 ? Math.min(100, Math.round((s.outstandingBalance / s.creditLimit) * 100)) : 0;
                return (
                  <tr key={s.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 align-top">
                      <div className="font-semibold text-slate-900 dark:text-white">{s.name}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                        {s.supplierCode} · {s.depotLocation || 'Standard Dispatch'}
                      </div>
                    </td>
                    <td className="py-3 px-4 align-top">
                      <div className="text-slate-800 dark:text-slate-200 font-medium">{CATEGORY_LABELS[s.category]}</div>
                      <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">{s.gstNumber}</div>
                    </td>
                    <td className="py-3 px-4 align-top">
                      <div className="text-slate-800 dark:text-slate-200">{s.contactPerson}</div>
                      <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">{s.phone}</div>
                    </td>
                    <td className="py-3 px-4 align-top text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      Net {s.paymentTermsDays}d
                    </td>
                    <td className="py-3 px-4 align-top text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {formatCurrency(s.creditLimit)}
                    </td>
                    <td className="py-3 px-4 align-top text-right">
                      <div className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                        {formatCurrency(s.outstandingBalance)}
                      </div>
                      <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 mt-0.5">
                        {utilizationPct}% limit used
                      </div>
                    </td>
                    <td className="py-3 px-4 align-top">
                      {s.status === 'ACTIVE' ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Active</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-medium">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>{s.status === 'ON_HOLD' ? 'On Hold' : 'Inactive'}</span>
                        </span>
                      )}
                    </td>
                    {canManageSuppliers && (
                      <td className="py-3 px-4 align-top text-right">
                        <button
                          type="button"
                          onClick={() => openEditForm(s)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 dark:text-blue-400 hover:underline whitespace-nowrap"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {filteredSuppliers.length === 0 && (
                <tr>
                  <td colSpan={canManageSuppliers ? 8 : 7} className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                    No suppliers match the current search or category filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
