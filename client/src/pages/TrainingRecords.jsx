import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../utils/helpers';
import PageHeader from '../components/common/PageHeader';
import Modal from '../components/common/Modal';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';

const TRAINING_TYPES = [
  { value: 'sms_initial', label: 'SMS Initial Training' },
  { value: 'sms_recurrent', label: 'SMS Recurrent Training' },
  { value: 'erp', label: 'Emergency Response Procedures' },
  { value: 'hazard_reporting', label: 'Hazard Reporting System' },
  { value: 'risk_assessment', label: 'Risk Assessment' },
  { value: 'just_culture', label: 'Just Culture' },
  { value: 'other', label: 'Other' },
];

const ROLE_BADGE = {
  admin: 'bg-blue-100 text-blue-700',
  s_ta: 'bg-purple-100 text-purple-700',
  staff: 'bg-green-100 text-green-700',
  employee: 'bg-gray-100 text-gray-600',
};

const EMPTY_FORM = {
  userId: '',
  trainingType: 'sms_initial',
  completedAt: '',
  expiresAt: '',
  deliveredBy: '',
  notes: '',
};

function RoleBadge({ role }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[role] || 'bg-gray-100 text-gray-600'}`}>
      {role?.replace('_', ' ')}
    </span>
  );
}

// Returns the most recent record for a given user+type pair
function getRecord(records, userId, type) {
  return records
    .filter((r) => r.userId === userId && r.trainingType === type)
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))[0] || null;
}

function TrainingCell({ record }) {
  if (!record) {
    return <span className="text-gray-300 text-lg" title="No record">—</span>;
  }

  const now = Date.now();
  const expiry = record.expiresAt ? new Date(record.expiresAt).getTime() : null;
  const daysUntilExpiry = expiry ? Math.ceil((expiry - now) / 86400000) : null;

  if (expiry && expiry < now) {
    return (
      <div className="flex flex-col items-center gap-0.5">
        <XCircleIcon className="h-5 w-5 text-red-500" />
        <span className="text-red-600 text-[10px] font-medium bg-red-50 px-1 rounded">Expired</span>
        <span className="text-[10px] text-gray-400">{formatDate(record.completedAt)}</span>
      </div>
    );
  }

  if (daysUntilExpiry !== null && daysUntilExpiry <= 30) {
    return (
      <div className="flex flex-col items-center gap-0.5">
        <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />
        <span className="text-yellow-700 text-[10px] font-medium bg-yellow-50 px-1 rounded">Expiring</span>
        <span className="text-[10px] text-gray-400">{formatDate(record.completedAt)}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-0.5">
      <CheckCircleIcon className="h-5 w-5 text-green-500" />
      <span className="text-[10px] text-gray-500">{formatDate(record.completedAt)}</span>
    </div>
  );
}

export default function TrainingRecords() {
  const { isAdmin, isSTA } = useAuth();
  const [records, setRecords] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = async () => {
    setLoading(true);
    try {
      const [rRes, uRes] = await Promise.all([
        api.get('/training'),
        api.get('/users'),
      ]);
      setRecords(rRes.data);
      setUsers(uRes.data.filter((u) => u.isActive));
    } catch {
      toast.error('Failed to load training records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/training', form);
      toast.success('Training record added');
      setShowForm(false);
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save');
    }
  };

  // Summary stats
  const staffUsers = users.filter((u) => ['admin', 's_ta', 'staff'].includes(u.role));
  const completedInitial = staffUsers.filter((u) => getRecord(records, u.id, 'sms_initial')).length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="SMS Training Records"
        subtitle="FAA §5.91 — Training requirements for all personnel with safety roles"
        actions={
          (isAdmin || isSTA) && (
            <button
              onClick={() => { setForm(EMPTY_FORM); setShowForm(true); }}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              <PlusIcon className="h-4 w-4" />
              Add Training Record
            </button>
          )
        }
      />

      {/* Summary banner */}
      {!loading && (
        <div className={`flex items-center gap-3 p-4 rounded-lg border text-sm font-medium
          ${completedInitial === staffUsers.length
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-yellow-50 border-yellow-200 text-yellow-800'}`}
        >
          {completedInitial === staffUsers.length
            ? <CheckCircleIcon className="h-5 w-5 text-green-500 flex-shrink-0" />
            : <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500 flex-shrink-0" />
          }
          <span>
            {completedInitial} of {staffUsers.length} staff have completed{' '}
            <span className="font-bold">SMS Initial Training</span>.
            {completedInitial < staffUsers.length && (
              <span className="ml-1 font-normal">
                {staffUsers.length - completedInitial} personnel highlighted below need initial training.
              </span>
            )}
          </span>
        </div>
      )}

      {/* Matrix table */}
      <div className="card p-0 overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin h-6 w-6 border-4 border-blue-600 border-t-transparent rounded-full" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 sticky left-0 bg-gray-50 z-10 min-w-[160px]">
                  Personnel
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-3 min-w-[80px]">
                  Role
                </th>
                {TRAINING_TYPES.map((t) => (
                  <th
                    key={t.value}
                    className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-3 min-w-[100px]"
                  >
                    <span className="block leading-tight">{t.label}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {staffUsers.length === 0 && (
                <tr>
                  <td colSpan={2 + TRAINING_TYPES.length} className="text-center text-gray-400 py-10">
                    No staff users found.
                  </td>
                </tr>
              )}
              {staffUsers.map((u) => {
                const missingInitial = !getRecord(records, u.id, 'sms_initial');
                return (
                  <tr
                    key={u.id}
                    className={`hover:bg-gray-50 ${missingInitial ? 'bg-red-50 border-l-4 border-l-red-400' : ''}`}
                  >
                    <td className={`px-4 py-3 font-medium sticky left-0 z-10 ${missingInitial ? 'bg-red-50' : 'bg-white'}`}>
                      <div className="flex items-center gap-2">
                        {missingInitial && (
                          <ExclamationTriangleIcon className="h-4 w-4 text-red-400 flex-shrink-0" title="Missing SMS Initial Training" />
                        )}
                        <span className={missingInitial ? 'text-red-700' : 'text-gray-900'}>{u.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <RoleBadge role={u.role} />
                    </td>
                    {TRAINING_TYPES.map((t) => (
                      <td key={t.value} className="px-3 py-3 text-center">
                        <TrainingCell record={getRecord(records, u.id, t.value)} />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-500 px-1">
        <span className="flex items-center gap-1"><CheckCircleIcon className="h-4 w-4 text-green-500" /> Complete</span>
        <span className="flex items-center gap-1"><ExclamationTriangleIcon className="h-4 w-4 text-yellow-500" /> Expiring within 30 days</span>
        <span className="flex items-center gap-1"><XCircleIcon className="h-4 w-4 text-red-500" /> Expired</span>
        <span className="flex items-center gap-1"><span className="text-gray-300 text-base font-bold">—</span> No record</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-red-400 rounded-sm" /> Missing SMS Initial Training</span>
      </div>

      {/* Add Training Record Modal */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Add Training Record"
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Personnel *</label>
            <select
              value={form.userId}
              onChange={(e) => setForm({ ...form, userId: e.target.value })}
              className="input"
              required
            >
              <option value="">Select person…</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name} ({u.role.replace('_', ' ')})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Training Type *</label>
            <select
              value={form.trainingType}
              onChange={(e) => setForm({ ...form, trainingType: e.target.value })}
              className="input"
              required
            >
              {TRAINING_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Completion Date *</label>
              <input
                type="date"
                value={form.completedAt}
                onChange={(e) => setForm({ ...form, completedAt: e.target.value })}
                className="input"
                required
              />
            </div>
            <div>
              <label className="label">Expiry Date <span className="text-gray-400 font-normal">(optional)</span></label>
              <input
                type="date"
                value={form.expiresAt}
                onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="label">Delivered By</label>
            <input
              type="text"
              value={form.deliveredBy}
              onChange={(e) => setForm({ ...form, deliveredBy: e.target.value })}
              className="input"
              placeholder="Instructor name or organization"
            />
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="input"
              placeholder="Additional notes, certificate number, etc."
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Save Record
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
