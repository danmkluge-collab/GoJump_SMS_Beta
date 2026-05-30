import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { formatDate, REGULATORY_REFS } from '../utils/helpers';
import PageHeader from '../components/common/PageHeader';
import Modal from '../components/common/Modal';
import LocationSelect from '../components/common/LocationSelect';
import toast from 'react-hot-toast';
import { PlusIcon, ClipboardDocumentCheckIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

const STATUS_COLORS = {
  Scheduled:    'bg-gray-100 text-gray-700',
  In_Progress:  'bg-yellow-100 text-yellow-700',
  Completed:    'bg-green-100 text-green-700',
};

const FAA_CHECKLIST = [
  { id: 1, section: '§5.1', item: 'SMS applicability — operation qualifies under Part 5' },
  { id: 2, section: '§5.3', item: 'Safety policy is documented and signed by accountable executive' },
  { id: 3, section: '§5.5', item: 'Hazard identification process is in place' },
  { id: 4, section: '§5.7', item: 'Risk assessment and control process documented' },
  { id: 5, section: '§5.9', item: 'Safety assurance — performance monitoring in place' },
  { id: 6, section: '§5.17', item: 'Emergency response plan is current (reviewed within 12 months)' },
  { id: 7, section: '§5.91', item: 'Hazard reporting system is available and publicized' },
  { id: 8, section: '§5.93', item: 'Anonymous reporting mechanism is in place' },
  { id: 9, section: '§5.95', item: 'Safety risk register is maintained and current' },
  { id: 10, section: '§5.97', item: 'SMS records are maintained for minimum 5 years' },
  { id: 11, section: '§5.75', item: 'Safety performance indicators are defined and tracked' },
];

export default function InternalAudit() {
  const { isSTA, isAdmin } = useAuth();
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);
  const [locationId, setLocationId] = useState('');
  const [form, setForm] = useState({ locationId: '', title: '', description: '', scheduledDate: '', frequency: '', checklistItems: FAA_CHECKLIST.map((i) => ({ ...i, checked: false, notes: '' })), regulatoryRefs: [] });

  const load = async () => {
    setLoading(true);
    try {
      const params = locationId ? `?locationId=${locationId}` : '';
      const r = await api.get(`/audit-items${params}`);
      setAudits(r.data);
    } catch { toast.error('Failed to load audits'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [locationId]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (isAdmin && !form.locationId) {
      toast.error('Please select a location');
      return;
    }
    try {
      await api.post('/audit-items', { ...form, checklistItems: form.checklistItems });
      toast.success('Audit scheduled');
      setShowForm(false);
      setForm({ locationId: '', title: '', description: '', scheduledDate: '', frequency: '', checklistItems: FAA_CHECKLIST.map((i) => ({ ...i, checked: false, notes: '' })), regulatoryRefs: [] });
      load();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  const updateStatus = async (id, status) => {
    try {
      await api.put(`/audit-items/${id}`, { status, completedDate: status === 'Completed' ? new Date().toISOString() : null });
      toast.success('Audit status updated');
      load();
    } catch { toast.error('Failed'); }
  };

  const toggleChecklist = (itemId) => {
    setForm({
      ...form,
      checklistItems: form.checklistItems.map((i) => i.id === itemId ? { ...i, checked: !i.checked } : i),
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Internal Audits"
        subtitle="FAA §5.7, §5.9 — Schedule and track Part 5 compliance audits"
        actions={
          isSTA && (
            <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2 text-sm">
              <PlusIcon className="h-4 w-4" /> Schedule Audit
            </button>
          )
        }
      />

      {isAdmin && <LocationSelect value={locationId} onChange={(v) => setLocationId(v || '')} />}

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin h-6 w-6 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="space-y-3">
          {audits.length === 0 && <div className="card text-center text-gray-400 py-8">No audits scheduled</div>}
          {audits.map((audit) => {
            const items = Array.isArray(audit.checklistItems) ? audit.checklistItems : (() => { try { return JSON.parse(audit.checklistItems || '[]'); } catch { return []; } })();
            const checkedCount = items.filter((i) => i.checked).length;
            return (
              <div key={audit.id} className="card cursor-pointer hover:border-blue-200 transition-colors" onClick={() => setSelected(audit)}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <ClipboardDocumentCheckIcon className="h-5 w-5 text-blue-500" />
                      <span className="font-semibold text-gray-900">{audit.title}</span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[audit.status]}`}>
                        {audit.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">{audit.location?.name}</p>
                    <div className="flex gap-4 text-xs text-gray-400 mt-1">
                      {audit.scheduledDate && <span>Scheduled: {formatDate(audit.scheduledDate)}</span>}
                      {audit.completedDate && <span>Completed: {formatDate(audit.completedDate)}</span>}
                      {items.length > 0 && <span>Checklist: {checkedCount}/{items.length}</span>}
                      {audit.frequency && <span>Frequency: {audit.frequency}</span>}
                    </div>
                    {items.length > 0 && (
                      <div className="mt-2 h-1.5 bg-gray-100 rounded-full">
                        <div className="h-1.5 bg-blue-500 rounded-full transition-all" style={{ width: `${(checkedCount / items.length) * 100}%` }} />
                      </div>
                    )}
                  </div>
                  {isSTA && audit.status !== 'Completed' && (
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      {audit.status === 'Scheduled' && (
                        <button onClick={() => updateStatus(audit.id, 'In_Progress')} className="btn-secondary text-xs">Start</button>
                      )}
                      {audit.status === 'In_Progress' && (
                        <button onClick={() => updateStatus(audit.id, 'Completed')} className="btn-primary text-xs flex items-center gap-1">
                          <CheckCircleIcon className="h-3.5 w-3.5" /> Complete
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Audit detail */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Audit Detail" size="xl">
        {selected && (() => {
          const items = Array.isArray(selected.checklistItems) ? selected.checklistItems : (() => { try { return JSON.parse(selected.checklistItems || '[]'); } catch { return []; } })();
          return (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="label">Status</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[selected.status]}`}>
                    {selected.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <div><span className="label">Location</span>{selected.location?.name}</div>
                {selected.scheduledDate && <div><span className="label">Scheduled</span>{formatDate(selected.scheduledDate)}</div>}
                {selected.completedDate && <div><span className="label">Completed</span>{formatDate(selected.completedDate)}</div>}
              </div>
              {selected.description && <p className="text-sm text-gray-600">{selected.description}</p>}
              {items.length > 0 && (
                <div>
                  <span className="label">Checklist Items</span>
                  <div className="space-y-2 mt-2">
                    {items.map((item, i) => (
                      <div key={i} className="flex items-start gap-3 p-2 rounded bg-gray-50">
                        <span className={`mt-0.5 h-4 w-4 rounded flex-shrink-0 flex items-center justify-center ${item.checked ? 'bg-green-500' : 'bg-gray-200'}`}>
                          {item.checked && <CheckCircleIcon className="h-3 w-3 text-white" />}
                        </span>
                        <div className="flex-1">
                          <p className="text-sm">{item.item}</p>
                          {item.section && <p className="text-xs text-blue-600">{item.section}</p>}
                          {item.notes && <p className="text-xs text-gray-400 mt-0.5">{item.notes}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selected.findings && (
                <div><span className="label">Findings</span><p className="text-sm mt-1 bg-yellow-50 rounded p-3">{selected.findings}</p></div>
              )}
            </div>
          );
        })()}
      </Modal>

      {/* Create audit modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Schedule Internal Audit" size="xl">
        <form onSubmit={handleCreate} className="space-y-4">
          {isAdmin && (
            <div>
              <label className="label">Location *</label>
              <LocationSelect value={form.locationId} onChange={(v) => setForm({ ...form, locationId: v || '' })} />
            </div>
          )}
          <div>
            <label className="label">Audit Title *</label>
            <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input" required
              placeholder="e.g. Semi-Annual FAA Part 5 SMS Compliance Audit" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Scheduled Date</label>
              <input type="date" value={form.scheduledDate} onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })} className="input" />
            </div>
            <div>
              <label className="label">Frequency</label>
              <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} className="input">
                <option value="">Select...</option>
                {['6-Month', 'Annual', 'Quarterly', 'One-time'].map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">FAA Part 5 Checklist</label>
            <div className="space-y-2 border border-gray-200 rounded-lg p-3 max-h-64 overflow-y-auto">
              {form.checklistItems.map((item) => (
                <label key={item.id} className="flex items-start gap-3 cursor-pointer hover:bg-gray-50 rounded p-1">
                  <input type="checkbox" checked={item.checked} onChange={() => toggleChecklist(item.id)} className="mt-0.5 h-4 w-4 text-blue-600 rounded" />
                  <div>
                    <span className="text-sm">{item.item}</span>
                    <span className="ml-2 text-xs text-blue-600">{item.section}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Schedule Audit</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
