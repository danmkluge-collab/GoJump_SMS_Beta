import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../utils/helpers';
import PageHeader from '../components/common/PageHeader';
import Modal from '../components/common/Modal';
import LocationSelect from '../components/common/LocationSelect';
import toast from 'react-hot-toast';
import { PlusIcon, CheckCircleIcon, XCircleIcon, ClockIcon, WrenchScrewdriverIcon } from '@heroicons/react/24/outline';

const CHANGE_TYPES = [
  'Procedure Change', 'Equipment Change', 'Personnel Change',
  'Training Change', 'Facility Change', 'Regulatory Change', 'Other',
];

const STATUS_CONFIG = {
  Submitted:    { color: 'bg-gray-100 text-gray-700',    icon: ClockIcon,             label: 'Submitted' },
  SRM_Required: { color: 'bg-yellow-100 text-yellow-700',icon: ClockIcon,             label: 'SRM Review Required' },
  SRM_Complete: { color: 'bg-blue-100 text-blue-700',    icon: CheckCircleIcon,       label: 'SRM Review Complete' },
  Approved:     { color: 'bg-green-100 text-green-700',  icon: CheckCircleIcon,       label: 'Approved' },
  Rejected:     { color: 'bg-red-100 text-red-700',      icon: XCircleIcon,           label: 'Rejected' },
  Implemented:  { color: 'bg-indigo-100 text-indigo-700',icon: WrenchScrewdriverIcon, label: 'Implemented' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { color: 'bg-gray-100 text-gray-600', label: status };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
      {Icon && <Icon className="h-3 w-3" />}
      {cfg.label}
    </span>
  );
}

export default function ChangeManagement() {
  const { user, isAdmin, isSTA } = useAuth();
  const canEdit = isAdmin || isSTA;

  const [requests, setRequests] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [locationId, setLocationId] = useState('');

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    changeType: '', description: '', proposedDate: '', notes: '', linkedHazardIds: '',
    locationId: '',
  });

  // Detail / edit modal
  const [selected, setSelected] = useState(null);
  const [editForm, setEditForm] = useState({ status: '', notes: '', approvedById: '', approvedAt: '', implementedAt: '' });

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (locationId) params.append('locationId', locationId);
      if (filterStatus) params.append('status', filterStatus);
      const [rRes, uRes] = await Promise.all([
        api.get(`/change-requests?${params}`),
        api.get('/users'),
      ]);
      setRequests(rRes.data);
      setUsers(uRes.data);
    } catch { toast.error('Failed to load change requests'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [locationId, filterStatus]);

  const handleCreate = async () => {
    if (!form.changeType) { toast.error('Change type is required'); return; }
    if (!form.description.trim()) { toast.error('Description is required'); return; }
    if (isAdmin && !form.locationId) { toast.error('Please select a location'); return; }
    try {
      const payload = {
        changeType:      form.changeType,
        description:     form.description,
        notes:           form.notes || undefined,
        proposedDate:    form.proposedDate || undefined,
        linkedHazardIds: form.linkedHazardIds
          ? form.linkedHazardIds.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
      };
      if (isAdmin && form.locationId) payload.locationId = form.locationId;
      await api.post('/change-requests', payload);
      toast.success('Change request submitted');
      setShowCreate(false);
      setForm({ changeType: '', description: '', proposedDate: '', notes: '', linkedHazardIds: '', locationId: '' });
      load();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to create'); }
  };

  const openDetail = (req) => {
    setSelected(req);
    setEditForm({
      status:       req.status,
      notes:        req.notes || '',
      approvedById: req.approvedById || '',
      approvedAt:   req.approvedAt   ? req.approvedAt.slice(0, 10) : '',
      implementedAt: req.implementedAt ? req.implementedAt.slice(0, 10) : '',
    });
  };

  const handleUpdate = async () => {
    try {
      await api.put(`/change-requests/${selected.id}`, editForm);
      toast.success('Change request updated');
      setSelected(null);
      load();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to update'); }
  };

  const BORDER = {
    Submitted:    'border-l-gray-400',
    SRM_Required: 'border-l-yellow-400',
    SRM_Complete: 'border-l-blue-400',
    Approved:     'border-l-green-400',
    Rejected:     'border-l-red-400',
    Implemented:  'border-l-indigo-400',
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Change Management"
        subtitle="FAA §5.51 — Management of Change (MoC)"
        actions={
          <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
            <PlusIcon className="h-4 w-4" />Request Change
          </button>
        }
      />

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
        <strong>§5.51 Management of Change:</strong> All significant changes to operations, procedures, equipment, or personnel that may affect safety must be identified, assessed for safety impact, and formally approved before implementation. Changes to existing risk controls require re-evaluation of associated hazards.
      </div>

      <div className="flex flex-wrap gap-3">
        {isAdmin && <LocationSelect value={locationId} onChange={(v) => setLocationId(v || '')} />}
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input w-48">
          <option value="">All Statuses</option>
          {Object.keys(STATUS_CONFIG).map((s) => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin h-6 w-6 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="space-y-3">
          {requests.length === 0 && (
            <div className="card text-center text-gray-400 py-8">No change requests found</div>
          )}
          {requests.map((req) => (
            <div key={req.id} className={`card border-l-4 ${BORDER[req.status] || 'border-l-gray-300'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3 mb-1">
                    <StatusBadge status={req.status} />
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full font-medium">
                      {req.changeType}
                    </span>
                    {req.location && <span className="text-sm text-gray-500">{req.location.name}</span>}
                  </div>
                  <p className="text-sm text-gray-800 mt-1">{req.description}</p>
                  <div className="mt-1.5 flex flex-wrap gap-4 text-xs text-gray-400">
                    <span>Submitted: {formatDate(req.createdAt)}</span>
                    {req.proposedDate && <span>Proposed date: {formatDate(req.proposedDate)}</span>}
                    {req.approvedAt  && <span>Approved: {formatDate(req.approvedAt)}</span>}
                    {req.implementedAt && <span>Implemented: {formatDate(req.implementedAt)}</span>}
                  </div>
                  {req.notes && (
                    <p className="mt-1.5 text-xs text-gray-500 bg-gray-50 rounded p-2">{req.notes}</p>
                  )}
                  {Array.isArray(req.linkedHazardIds) && req.linkedHazardIds.length > 0 && (
                    <p className="mt-1 text-xs text-blue-600">
                      Linked hazards: {req.linkedHazardIds.length}
                    </p>
                  )}
                </div>
                {canEdit && (
                  <button onClick={() => openDetail(req)} className="btn-secondary text-sm flex-shrink-0">
                    Review
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Submit Change Request" size="lg">
        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
            Per §5.51, all changes that could affect safety performance require formal review and approval before implementation.
          </div>
          {isAdmin && (
            <div>
              <label className="label">Location <span className="text-red-500">*</span></label>
              <LocationSelect value={form.locationId} onChange={(v) => setForm({ ...form, locationId: v || '' })} />
            </div>
          )}
          <div>
            <label className="label">Change Type <span className="text-red-500">*</span></label>
            <select value={form.changeType} onChange={(e) => setForm({ ...form, changeType: e.target.value })} className="input">
              <option value="">— Select type —</option>
              {CHANGE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Description of Change <span className="text-red-500">*</span></label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={4} className="input resize-none"
              placeholder="Describe the proposed change and its safety implications..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Proposed Implementation Date</label>
              <input type="date" value={form.proposedDate} onChange={(e) => setForm({ ...form, proposedDate: e.target.value })} className="input" />
            </div>
            <div>
              <label className="label">Linked Hazard IDs</label>
              <input
                type="text" value={form.linkedHazardIds}
                onChange={(e) => setForm({ ...form, linkedHazardIds: e.target.value })}
                className="input" placeholder="Comma-separated hazard IDs..."
              />
            </div>
          </div>
          <div>
            <label className="label">Additional Notes / Safety Impact Assessment</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3} className="input resize-none"
              placeholder="Describe how this change affects safety, existing hazard controls, and risk assessments..."
            />
          </div>
          <div className="flex gap-3">
            <button onClick={handleCreate} className="btn-primary flex-1">Submit Request</button>
            <button onClick={() => setShowCreate(false)} className="btn-secondary flex-1">Cancel</button>
          </div>
        </div>
      </Modal>

      {/* Review / edit modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Review Change Request" size="lg">
        {selected && (
          <div className="space-y-5">
            {/* Read-only details */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="label">Change Type</span><p>{selected.changeType}</p></div>
                <div><span className="label">Status</span><StatusBadge status={selected.status} /></div>
                <div><span className="label">Submitted</span><p>{formatDate(selected.createdAt)}</p></div>
                {selected.proposedDate && <div><span className="label">Proposed Date</span><p>{formatDate(selected.proposedDate)}</p></div>}
              </div>
              <div><span className="label">Description</span><p className="mt-1 whitespace-pre-wrap">{selected.description}</p></div>
            </div>

            {/* Editable fields */}
            <div className="space-y-4">
              <div>
                <label className="label">Decision</label>
                <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className="input">
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Review Notes / Justification</label>
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  rows={4} className="input resize-none"
                  placeholder="Document your safety impact assessment, approval rationale, or rejection reason..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Approved By</label>
                  <select value={editForm.approvedById} onChange={(e) => setEditForm({ ...editForm, approvedById: e.target.value })} className="input">
                    <option value="">— Select —</option>
                    {users.filter((u) => u.role === 'admin' || u.role === 's_ta').map((u) => (
                      <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Approval Date</label>
                  <input type="date" value={editForm.approvedAt} onChange={(e) => setEditForm({ ...editForm, approvedAt: e.target.value })} className="input" />
                </div>
                {editForm.status === 'Implemented' && (
                  <div>
                    <label className="label">Implementation Date</label>
                    <input type="date" value={editForm.implementedAt} onChange={(e) => setEditForm({ ...editForm, implementedAt: e.target.value })} className="input" />
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={handleUpdate} className="btn-primary flex-1">Save Decision</button>
              <button onClick={() => setSelected(null)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
