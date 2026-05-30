import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/common/PageHeader';
import Modal from '../components/common/Modal';
import toast from 'react-hot-toast';
import { PlusIcon, PencilIcon, PrinterIcon, InformationCircleIcon } from '@heroicons/react/24/outline';

const SMS_ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 's_ta', label: 'S&TA' },
  { value: 'staff', label: 'Staff' },
  { value: 'other', label: 'Other' },
];

const ROLE_BADGE = {
  admin: 'bg-blue-100 text-blue-700',
  s_ta: 'bg-purple-100 text-purple-700',
  staff: 'bg-green-100 text-green-700',
  other: 'bg-gray-100 text-gray-600',
};

const EMPTY_FORM = { position: '', smsRole: 'staff', responsibilities: '', authority: '' };

function RoleBadge({ role }) {
  const match = SMS_ROLES.find((r) => r.value === role);
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[role] || 'bg-gray-100 text-gray-600'}`}>
      {match?.label || role}
    </span>
  );
}

export default function AccountabilityMatrix() {
  const { isAdmin } = useAuth();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editEntry, setEditEntry] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/accountability');
      setEntries(res.data);
    } catch {
      toast.error('Failed to load accountability matrix');
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditEntry(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (entry) => {
    setEditEntry(entry);
    setForm({
      position: entry.position || '',
      smsRole: entry.smsRole || 'staff',
      responsibilities: entry.responsibilities || '',
      authority: entry.authority || '',
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editEntry) {
        await api.put(`/accountability/${editEntry.id}`, form);
        toast.success('Entry updated');
      } else {
        await api.post('/accountability', form);
        toast.success('Entry added');
      }
      setShowForm(false);
      setEditEntry(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save');
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Safety Accountability Matrix"
        subtitle="FAA §5.23 — Documented safety responsibilities and authority for every position"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <PrinterIcon className="h-4 w-4" />
              Export / Print
            </button>
            {isAdmin && (
              <button
                onClick={openCreate}
                className="btn-primary flex items-center gap-2 text-sm"
              >
                <PlusIcon className="h-4 w-4" />
                Add Position
              </button>
            )}
          </div>
        }
      />

      {/* FAA note */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 print:border print:border-blue-300">
        <InformationCircleIcon className="h-5 w-5 flex-shrink-0 mt-0.5 text-blue-500" />
        <p>
          <span className="font-semibold">FAA §5.23 Compliance:</span> This matrix documents safety responsibilities
          and authority for every position in the organization. It is produced on request during FAA inspection and
          must be kept current whenever personnel or organizational structure changes.
        </p>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin h-6 w-6 border-4 border-blue-600 border-t-transparent rounded-full" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Position', 'SMS Role', 'Responsibilities', 'Authority', ...(isAdmin ? ['Actions'] : [])].map((h) => (
                  <th
                    key={h}
                    className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 5 : 4} className="text-center text-gray-400 py-10">
                    No entries yet. {isAdmin && 'Click "Add Position" to get started.'}
                  </td>
                </tr>
              )}
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{entry.position}</td>
                  <td className="px-4 py-3">
                    <RoleBadge role={entry.smsRole} />
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-sm">
                    <p className="whitespace-pre-wrap">{entry.responsibilities}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs">
                    <p className="whitespace-pre-wrap">{entry.authority}</p>
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openEdit(entry)}
                        className="text-blue-600 hover:underline text-xs flex items-center gap-1"
                      >
                        <PencilIcon className="h-3 w-3" />
                        Edit
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add / Edit modal */}
      <Modal
        open={showForm}
        onClose={() => { setShowForm(false); setEditEntry(null); }}
        title={editEntry ? 'Edit Position' : 'Add Position'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Position *</label>
            <input
              type="text"
              value={form.position}
              onChange={(e) => setForm({ ...form, position: e.target.value })}
              className="input"
              placeholder="e.g. Safety Manager, Jump Pilot, Packer"
              required
            />
          </div>

          <div>
            <label className="label">SMS Role *</label>
            <select
              value={form.smsRole}
              onChange={(e) => setForm({ ...form, smsRole: e.target.value })}
              className="input"
            >
              {SMS_ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Responsibilities *</label>
            <textarea
              rows={4}
              value={form.responsibilities}
              onChange={(e) => setForm({ ...form, responsibilities: e.target.value })}
              className="input"
              placeholder="List specific safety responsibilities for this position…"
              required
            />
          </div>

          <div>
            <label className="label">Authority</label>
            <textarea
              rows={2}
              value={form.authority}
              onChange={(e) => setForm({ ...form, authority: e.target.value })}
              className="input"
              placeholder="e.g. May ground operations, approve jump runs…"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => { setShowForm(false); setEditEntry(null); }}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              {editEntry ? 'Update Entry' : 'Add Entry'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
