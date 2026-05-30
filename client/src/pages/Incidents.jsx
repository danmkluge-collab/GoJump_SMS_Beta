import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../utils/helpers';
import { IncidentStatusBadge } from '../components/common/StatusBadge';
import PageHeader from '../components/common/PageHeader';
import Modal from '../components/common/Modal';
import LocationSelect from '../components/common/LocationSelect';
import IncidentDetail from './IncidentDetail';
import toast from 'react-hot-toast';
import { PlusIcon } from '@heroicons/react/24/outline';

const STATUSES = ['Submitted', 'Acknowledged', 'Investigation', 'Corrective_Action', 'Closed'];

const STATUS_BORDER = {
  Submitted:         'border-l-gray-400',
  Acknowledged:      'border-l-blue-400',
  Investigation:     'border-l-yellow-400',
  Corrective_Action: 'border-l-orange-400',
  Closed:            'border-l-green-400',
};

export default function Incidents() {
  const { isSTA, isAdmin } = useAuth();
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [locationId, setLocationId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Detail modal
  const [detailId, setDetailId] = useState(null);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [hazardReports, setHazardReports] = useState([]);
  const [users, setUsers] = useState([]);
  const [createForm, setCreateForm] = useState({
    hazardReportId: '',
    assignedToId: '',
    locationId: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (locationId) params.append('locationId', locationId);
      if (filterStatus) params.append('status', filterStatus);
      const res = await api.get(`/incidents?${params}`);
      setIncidents(res.data);
    } catch { toast.error('Failed to load incidents'); }
    finally { setLoading(false); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [locationId, filterStatus]);

  const openCreate = async () => {
    try {
      const [hRes, uRes] = await Promise.all([
        api.get('/hazard-reports?limit=200'),
        api.get('/users'),
      ]);
      setHazardReports(Array.isArray(hRes.data) ? hRes.data : hRes.data?.data || []);
      setUsers(uRes.data);
    } catch { toast.error('Failed to load data'); }
    setShowCreate(true);
  };

  const handleCreate = async () => {
    try {
      const payload = {
        hazardReportId: createForm.hazardReportId || undefined,
        assignedToId:   createForm.assignedToId   || undefined,
      };
      if (isAdmin && createForm.locationId) payload.locationId = createForm.locationId;
      await api.post('/incidents', payload);
      toast.success('Incident created');
      setShowCreate(false);
      setCreateForm({ hazardReportId: '', assignedToId: '', locationId: '' });
      load();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to create'); }
  };

  const closeDetail = () => {
    setDetailId(null);
    load(); // refresh list after editing
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Incident Tracking"
        subtitle="FAA §5.7, §5.9, §5.71, §5.73, §5.91–5.95"
        actions={
          isSTA || isAdmin
            ? <button onClick={openCreate} className="btn-primary flex items-center gap-2"><PlusIcon className="h-4 w-4" />New Incident</button>
            : null
        }
      />

      <div className="flex flex-wrap gap-3">
        {isAdmin && <LocationSelect value={locationId} onChange={(v) => setLocationId(v || '')} />}
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input w-52">
          <option value="">All Statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin h-6 w-6 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="space-y-3">
          {incidents.length === 0 && (
            <div className="card text-center text-gray-400 py-8">No incidents found</div>
          )}
          {incidents.map((inc) => (
            <div key={inc.id} className={`card border-l-4 ${STATUS_BORDER[inc.status] || 'border-l-gray-300'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <IncidentStatusBadge status={inc.status} />
                    {inc.location && <span className="text-sm text-gray-500">{inc.location.name}</span>}
                    {inc.assignedTo && (
                      <span className="text-xs text-gray-400">Assigned: {inc.assignedTo.name}</span>
                    )}
                    {inc.initialRiskRating && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium
                        ${inc.initialRiskRating === 'Critical' ? 'bg-red-100 text-red-700'
                          : inc.initialRiskRating === 'High'   ? 'bg-orange-100 text-orange-700'
                          : inc.initialRiskRating === 'Medium' ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-green-100 text-green-700'}`}>
                        Risk: {inc.initialRiskRating}
                      </span>
                    )}
                  </div>
                  {inc.hazardReport && (
                    <div className="text-sm">
                      <span className="text-gray-500">Source: </span>
                      <span className="text-gray-800">
                        {inc.hazardReport.type?.replace(/_/g, ' ')} — {inc.hazardReport.description?.slice(0, 90)}{inc.hazardReport.description?.length > 90 ? '…' : ''}
                      </span>
                    </div>
                  )}
                  <div className="mt-1 flex flex-wrap gap-4 text-xs text-gray-400">
                    <span>Created: {formatDate(inc.createdAt)}</span>
                    {inc.followUpDate && (
                      <span className={new Date(inc.followUpDate) < new Date() && inc.status !== 'Closed' ? 'text-red-500 font-medium' : ''}>
                        Follow-up: {formatDate(inc.followUpDate)}
                        {new Date(inc.followUpDate) < new Date() && inc.status !== 'Closed' && ' ⚠ OVERDUE'}
                      </span>
                    )}
                    {inc.closedAt && <span>Closed: {formatDate(inc.closedAt)}</span>}
                    {inc.verificationStatus && inc.verificationStatus !== 'Pending' && (
                      <span>Verification: {inc.verificationStatus.replace(/_/g, ' ')}</span>
                    )}
                  </div>
                  {inc.controlMeasures && (
                    <p className="mt-1.5 text-xs bg-blue-50 text-blue-700 rounded p-2">
                      <strong>Controls:</strong> {inc.controlMeasures.slice(0, 100)}{inc.controlMeasures.length > 100 ? '…' : ''}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setDetailId(inc.id)}
                  className="btn-secondary text-sm flex-shrink-0"
                >
                  Open Detail
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Full-screen detail modal */}
      <Modal
        open={!!detailId}
        onClose={closeDetail}
        title="Incident SRM Detail"
        size="full"
      >
        {detailId && (
          <IncidentDetail incidentId={detailId} onClose={closeDetail} />
        )}
      </Modal>

      {/* Create incident modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create New Incident" size="md">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            An incident is created from a hazard report that has escalated to a reportable safety event. Select the source hazard report below (optional).
          </p>
          {isAdmin && (
            <div>
              <label className="label">Location</label>
              <LocationSelect value={createForm.locationId} onChange={(v) => setCreateForm({ ...createForm, locationId: v || '' })} />
            </div>
          )}
          <div>
            <label className="label">Source Hazard Report (optional)</label>
            <select
              value={createForm.hazardReportId}
              onChange={(e) => setCreateForm({ ...createForm, hazardReportId: e.target.value })}
              className="input"
            >
              <option value="">— No linked report —</option>
              {hazardReports.map((r) => (
                <option key={r.id} value={r.id}>
                  [{r.severity}] {r.type?.replace(/_/g, ' ')} — {r.description?.slice(0, 60)}…
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Assign To (optional)</label>
            <select
              value={createForm.assignedToId}
              onChange={(e) => setCreateForm({ ...createForm, assignedToId: e.target.value })}
              className="input"
            >
              <option value="">— Unassigned —</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
            </select>
          </div>
          <div className="flex gap-3">
            <button onClick={handleCreate} className="btn-primary flex-1">Create Incident</button>
            <button onClick={() => setShowCreate(false)} className="btn-secondary flex-1">Cancel</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
