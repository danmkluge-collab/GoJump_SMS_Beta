import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { formatDate, LIKELIHOODS, CONSEQUENCES, REGULATORY_REFS, calculateRisk } from '../utils/helpers';
import { RiskBadge } from '../components/common/StatusBadge';
import PageHeader from '../components/common/PageHeader';
import Modal from '../components/common/Modal';
import LocationSelect from '../components/common/LocationSelect';
import toast from 'react-hot-toast';
import { PlusIcon, TableCellsIcon } from '@heroicons/react/24/outline';

const RISK_ACTION = {
  Critical: 'Immediate action required — cease operations if necessary',
  High:     'Immediate action required — assign responsible person within 24 hours',
  Medium:   'Action required within 30 days',
  Low:      'Monitor — review at next safety committee meeting',
};

function RiskMatrixDisplay() {
  const likelihoods = ['Frequent', 'Occasional', 'Remote', 'Improbable'];
  const consequences = ['Negligible', 'Minor', 'Major', 'Catastrophic'];
  const colors = { Critical: 'bg-red-500', High: 'bg-orange-400', Medium: 'bg-yellow-400', Low: 'bg-green-400' };

  return (
    <div className="overflow-x-auto">
      <table className="text-xs w-full border border-gray-200 rounded-lg overflow-hidden">
        <thead>
          <tr>
            <th className="bg-gray-100 p-2 text-left">Likelihood \ Consequence</th>
            {consequences.map((c) => <th key={c} className="bg-gray-100 p-2 text-center font-semibold">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {likelihoods.map((l) => (
            <tr key={l}>
              <td className="bg-gray-50 p-2 font-semibold border-r border-gray-200">{l}</td>
              {consequences.map((c) => {
                const risk = calculateRisk(l, c);
                return (
                  <td key={c} className={`p-2 text-center font-bold text-white ${colors[risk]}`}>{risk}</td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RiskForm({ initial, onSubmit, onClose, users }) {
  const [form, setForm] = useState(initial || {
    description: '', likelihood: '', consequence: '', controls: '',
    responsibleUserId: '', revisedLikelihood: '', revisedConsequence: '',
    dueDate: '', regulatoryRefs: [], notes: '',
    alarpJustification: '', riskAcceptedById: '', riskAcceptedAt: '', riskAcceptanceNotes: '',
  });
  const [loading, setLoading] = useState(false);

  const computedRisk = form.likelihood && form.consequence ? calculateRisk(form.likelihood, form.consequence) : '';
  const revisedRisk = form.revisedLikelihood && form.revisedConsequence
    ? calculateRisk(form.revisedLikelihood, form.revisedConsequence) : '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try { await onSubmit(form); }
    finally { setLoading(false); }
  };

  const toggleRef = (ref) => {
    const refs = form.regulatoryRefs || [];
    setForm({ ...form, regulatoryRefs: refs.includes(ref) ? refs.filter((r) => r !== ref) : [...refs, ref] });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Hazard Description *</label>
        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={3} className="input resize-none" required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Likelihood *</label>
          <select value={form.likelihood} onChange={(e) => setForm({ ...form, likelihood: e.target.value })} className="input" required>
            <option value="">Select...</option>
            {LIKELIHOODS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Consequence *</label>
          <select value={form.consequence} onChange={(e) => setForm({ ...form, consequence: e.target.value })} className="input" required>
            <option value="">Select...</option>
            {CONSEQUENCES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      {computedRisk && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-gray-50">
          <span className="text-sm font-medium text-gray-700">Computed Risk Rating:</span>
          <RiskBadge rating={computedRisk} />
          <span className="text-xs text-gray-500">— {RISK_ACTION[computedRisk]}</span>
        </div>
      )}
      <div>
        <label className="label">Control Measures</label>
        <textarea value={form.controls} onChange={(e) => setForm({ ...form, controls: e.target.value })}
          rows={3} className="input resize-none" placeholder="Describe controls to eliminate, substitute, or mitigate risk..." />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Responsible Person</label>
          <select value={form.responsibleUserId} onChange={(e) => setForm({ ...form, responsibleUserId: e.target.value })} className="input">
            <option value="">Unassigned</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Due Date</label>
          <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="input" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Revised Likelihood (after controls)</label>
          <select value={form.revisedLikelihood} onChange={(e) => setForm({ ...form, revisedLikelihood: e.target.value })} className="input">
            <option value="">—</option>
            {LIKELIHOODS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Revised Consequence</label>
          <select value={form.revisedConsequence} onChange={(e) => setForm({ ...form, revisedConsequence: e.target.value })} className="input">
            <option value="">—</option>
            {CONSEQUENCES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      {revisedRisk && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50">
          <span className="text-sm font-medium text-gray-700">Residual Risk After Controls:</span>
          <RiskBadge rating={revisedRisk} />
        </div>
      )}

      {/* §5.55 — ALARP & Risk Acceptance (required for High/Critical residual risk) */}
      {(revisedRisk === 'High' || revisedRisk === 'Critical') && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 space-y-4">
          <div>
            <p className="text-xs font-bold text-orange-800 uppercase tracking-wide mb-1">§5.55 — ALARP Justification Required</p>
            <p className="text-xs text-orange-700">Residual risk is {revisedRisk}. Document why further risk reduction is not reasonably practicable, and record the accepting authority.</p>
          </div>
          <div>
            <label className="label">ALARP Justification <span className="text-red-500">*</span></label>
            <textarea
              value={form.alarpJustification}
              onChange={(e) => setForm({ ...form, alarpJustification: e.target.value })}
              rows={3} className="input resize-none"
              placeholder="Explain why all reasonably practicable control measures have been applied and further reduction is not feasible..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">
                Risk Accepted By
                {revisedRisk === 'Critical' && <span className="ml-1 text-xs text-red-600">(AE Required)</span>}
                {revisedRisk === 'High' && <span className="ml-1 text-xs text-orange-600">(Admin/AE Required)</span>}
              </label>
              <select
                value={form.riskAcceptedById}
                onChange={(e) => setForm({ ...form, riskAcceptedById: e.target.value })}
                className="input"
              >
                <option value="">— Select acceptor —</option>
                {users
                  .filter((u) => u.role === 'admin' || u.role === 's_ta')
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role}{u.isAccountableExecutive ? ' · AE' : ''})
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="label">Acceptance Date</label>
              <input
                type="date" value={form.riskAcceptedAt}
                onChange={(e) => setForm({ ...form, riskAcceptedAt: e.target.value })}
                className="input"
              />
            </div>
            <div className="col-span-2">
              <label className="label">Risk Acceptance Notes</label>
              <textarea
                value={form.riskAcceptanceNotes}
                onChange={(e) => setForm({ ...form, riskAcceptanceNotes: e.target.value })}
                rows={2} className="input resize-none"
                placeholder="Additional justification or conditions for acceptance..."
              />
            </div>
          </div>
        </div>
      )}

      <div>
        <label className="label">Regulatory References</label>
        <div className="flex flex-wrap gap-1.5">
          {REGULATORY_REFS.map((ref) => (
            <button key={ref} type="button"
              onClick={() => toggleRef(ref)}
              className={`px-2 py-0.5 rounded text-xs border transition-colors ${form.regulatoryRefs?.includes(ref) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}
            >{ref}</button>
          ))}
        </div>
      </div>
      <div>
        <label className="label">Notes</label>
        <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
          rows={2} className="input resize-none" />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Saving...' : (initial ? 'Update' : 'Add to Risk Register')}
        </button>
      </div>
    </form>
  );
}

export default function RiskRegister() {
  const { isSTA, isAdmin } = useAuth();
  const [items, setItems] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showMatrix, setShowMatrix] = useState(false);
  const [locationId, setLocationId] = useState('');
  const [filterRisk, setFilterRisk] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (locationId) params.append('locationId', locationId);
      if (filterRisk) params.append('riskRating', filterRisk);
      const [itemsRes, usersRes] = await Promise.all([
        api.get(`/risk-register?${params}`),
        api.get('/users'),
      ]);
      setItems(itemsRes.data);
      setUsers(usersRes.data);
    } catch { toast.error('Failed to load risk register'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [locationId, filterRisk]);

  const handleCreate = async (form) => {
    try {
      await api.post('/risk-register', { ...form, locationId });
      toast.success('Risk item added');
      setShowForm(false);
      load();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to add'); }
  };

  const handleUpdate = async (form) => {
    try {
      await api.put(`/risk-register/${editing.id}`, form);
      toast.success('Risk item updated');
      setEditing(null);
      load();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to update'); }
  };

  const riskBorder = { Critical: 'border-l-red-500', High: 'border-l-orange-500', Medium: 'border-l-yellow-500', Low: 'border-l-green-500' };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Risk Register"
        subtitle="FAA §5.5, §5.7, §5.91, §5.95"
        actions={
          <>
            <button onClick={() => setShowMatrix(true)} className="btn-secondary flex items-center gap-2 text-sm">
              <TableCellsIcon className="h-4 w-4" /> Risk Matrix
            </button>
            {isSTA && (
              <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2 text-sm">
                <PlusIcon className="h-4 w-4" /> Add Hazard
              </button>
            )}
          </>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {isAdmin && <LocationSelect value={locationId} onChange={(v) => setLocationId(v || '')} />}
        <select value={filterRisk} onChange={(e) => setFilterRisk(e.target.value)} className="input w-40">
          <option value="">All Risk Ratings</option>
          {['Critical', 'High', 'Medium', 'Low'].map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin h-6 w-6 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="space-y-3">
          {items.length === 0 && <div className="card text-center text-gray-400 py-8">No risk register items found</div>}
          {items.map((item) => (
            <div key={item.id} className={`card border-l-4 ${riskBorder[item.riskRating] || 'border-l-gray-300'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-mono text-sm font-bold text-gray-500">{item.hazardIdLabel}</span>
                    <RiskBadge rating={item.riskRating} />
                    {item.revisedRating && item.revisedRating !== item.riskRating && (
                      <>
                        <span className="text-gray-400 text-xs">→ after controls:</span>
                        <RiskBadge rating={item.revisedRating} />
                      </>
                    )}
                    {item.location && <span className="text-xs text-gray-400">{item.location.name}</span>}
                  </div>
                  <p className="font-medium text-gray-900">{item.description}</p>
                  <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-500">
                    <span>Likelihood: <strong>{item.likelihood}</strong></span>
                    <span>Consequence: <strong>{item.consequence}</strong></span>
                    {item.responsibleUser && <span>Assigned to: <strong>{item.responsibleUser.name}</strong></span>}
                    {item.dueDate && <span>Due: <strong>{formatDate(item.dueDate)}</strong></span>}
                  </div>
                  {item.controls && (
                    <div className="mt-2 text-xs bg-green-50 text-green-800 rounded p-2">
                      <strong>Controls:</strong> {item.controls}
                    </div>
                  )}
                  {item.alarpJustification && (
                    <div className="mt-2 text-xs bg-orange-50 text-orange-800 rounded p-2">
                      <strong>ALARP:</strong> {item.alarpJustification.substring(0, 120)}{item.alarpJustification.length > 120 ? '…' : ''}
                    </div>
                  )}
                  {item.riskAcceptedBy && (
                    <div className="mt-1 text-xs text-gray-400 flex items-center gap-1">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-purple-50 text-purple-700">
                        §5.55 Accepted by {item.riskAcceptedBy.name}
                        {item.riskAcceptedAt && ` — ${formatDate(item.riskAcceptedAt)}`}
                      </span>
                    </div>
                  )}
                  {item.regulatoryRefs?.length > 0 && (
                    <div className="mt-2 flex gap-1 flex-wrap">
                      {item.regulatoryRefs.map((r) => (
                        <span key={r} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">{r}</span>
                      ))}
                    </div>
                  )}
                  <div className="mt-1.5 text-xs text-gray-400">
                    Action required: {RISK_ACTION[item.riskRating]}
                  </div>
                </div>
                {isSTA && (
                  <button onClick={() => setEditing(item)} className="btn-secondary text-sm flex-shrink-0">Edit</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Add Risk Register Item" size="lg">
        <RiskForm onSubmit={handleCreate} onClose={() => setShowForm(false)} users={users} />
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Risk Register Item" size="lg">
        <RiskForm initial={editing} onSubmit={handleUpdate} onClose={() => setEditing(null)} users={users} />
      </Modal>

      {/* Risk matrix modal */}
      <Modal open={showMatrix} onClose={() => setShowMatrix(false)} title="Risk Matrix — FAA Part 5" size="lg">
        <RiskMatrixDisplay />
        <div className="mt-4 space-y-2 text-sm">
          {Object.entries(RISK_ACTION).map(([rating, action]) => (
            <div key={rating} className="flex items-center gap-2">
              <RiskBadge rating={rating} />
              <span className="text-gray-600">{action}</span>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
