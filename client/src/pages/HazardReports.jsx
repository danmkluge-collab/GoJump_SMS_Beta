import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import {
  formatDate, SEVERITIES,
  LIFECYCLE_STAGES, STAGE_LABELS, LIFECYCLE_COLORS, LIFECYCLE_BORDER,
} from '../utils/helpers';
import PageHeader from '../components/common/PageHeader';
import Modal from '../components/common/Modal';
import LocationSelect from '../components/common/LocationSelect';
import HazardDetail from './HazardDetail';
import toast from 'react-hot-toast';
import {
  FunnelIcon, ExclamationTriangleIcon, ClockIcon,
  ChevronDownIcon, ChevronUpIcon,
} from '@heroicons/react/24/outline';

const RISK_PILL = {
  Critical: 'bg-red-100 text-red-700 font-bold',
  High:     'bg-orange-100 text-orange-700 font-semibold',
  Medium:   'bg-yellow-100 text-yellow-700',
  Low:      'bg-green-100 text-green-700',
};

function RiskPill({ rating, label }) {
  if (!rating) return <span className="text-xs text-gray-400 italic">{label || 'Pending'}</span>;
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${RISK_PILL[rating] || 'bg-gray-100 text-gray-600'}`}>{rating}</span>;
}

function StageBadge({ status }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${LIFECYCLE_COLORS[status] || 'bg-gray-100 text-gray-600'}`}>
      {STAGE_LABELS[status] || status}
    </span>
  );
}

export default function HazardReports() {
  const { isAdmin } = useAuth();
  const [reports, setReports] = useState([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [users, setUsers]     = useState([]);
  const [detailId, setDetailId] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState({
    locationId: '', status: '', severity: '', overdue: false,
    assignedTo: '', from: '', to: '', search: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.locationId) params.append('locationId', filters.locationId);
      if (filters.status)     params.append('status',     filters.status);
      if (filters.severity)   params.append('severity',   filters.severity);
      if (filters.overdue)    params.append('overdue',    'true');
      if (filters.assignedTo) params.append('assignedTo', filters.assignedTo);
      if (filters.from)       params.append('from', filters.from);
      if (filters.to)         params.append('to',   filters.to);
      const [rRes, uRes] = await Promise.all([
        api.get(`/hazard-reports?${params}`),
        api.get('/users'),
      ]);
      setReports(rRes.data.data);
      setTotal(rRes.data.total);
      setUsers(uRes.data);
    } catch { toast.error('Failed to load reports'); }
    finally { setLoading(false); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [
    filters.locationId, filters.status, filters.severity,
    filters.overdue, filters.assignedTo, filters.from, filters.to,
  ]);

  const displayed = filters.search
    ? reports.filter((r) =>
        r.description?.toLowerCase().includes(filters.search.toLowerCase()) ||
        r.type?.toLowerCase().includes(filters.search.toLowerCase()) ||
        r.reporterName?.toLowerCase().includes(filters.search.toLowerCase())
      )
    : reports;

  const activeFilterCount = [
    filters.status, filters.severity, filters.overdue,
    filters.assignedTo, filters.from, filters.to,
  ].filter(Boolean).length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Hazard Register"
        subtitle={`${total} total · FAA §5.7, §5.71–5.73, §5.91–5.95 — SRM Lifecycle`}
      />

      {/* Search + filter toggle */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text" placeholder="Search description, type, reporter…"
          value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          className="input flex-1 min-w-48"
        />
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors
            ${showFilters || activeFilterCount > 0
              ? 'bg-blue-50 border-blue-300 text-blue-700'
              : 'bg-white border-gray-300 text-gray-600 hover:border-gray-400'}`}
        >
          <FunnelIcon className="h-4 w-4" />
          Filters
          {activeFilterCount > 0 && (
            <span className="bg-blue-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs">{activeFilterCount}</span>
          )}
          {showFilters ? <ChevronUpIcon className="h-3.5 w-3.5" /> : <ChevronDownIcon className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="card grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {isAdmin && (
            <div className="col-span-2 sm:col-span-1">
              <label className="label">Location</label>
              <LocationSelect value={filters.locationId} onChange={(v) => setFilters({ ...filters, locationId: v || '' })} />
            </div>
          )}
          <div>
            <label className="label">Lifecycle Stage</label>
            <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="input">
              <option value="">All Stages</option>
              {LIFECYCLE_STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Severity</label>
            <select value={filters.severity} onChange={(e) => setFilters({ ...filters, severity: e.target.value })} className="input">
              <option value="">All</option>
              {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Assigned To</label>
            <select value={filters.assignedTo} onChange={(e) => setFilters({ ...filters, assignedTo: e.target.value })} className="input">
              <option value="">Anyone</option>
              {users.filter((u) => ['s_ta','admin','staff'].includes(u.role)).map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">From Date</label>
            <input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} className="input" />
          </div>
          <div>
            <label className="label">To Date</label>
            <input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} className="input" />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm font-medium">
              <input type="checkbox" checked={filters.overdue} onChange={(e) => setFilters({ ...filters, overdue: e.target.checked })} className="h-4 w-4 text-red-600 rounded" />
              <ExclamationTriangleIcon className="h-4 w-4" /> Overdue Only
            </label>
          </div>
          <div className="flex items-end">
            <button onClick={() => setFilters({ locationId:'', status:'', severity:'', overdue:false, assignedTo:'', from:'', to:'', search:'' })} className="btn-secondary text-sm w-full">
              Clear Filters
            </button>
          </div>
        </div>
      )}

      {/* Report list */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin h-6 w-6 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="space-y-2">
          {displayed.length === 0 && (
            <div className="card text-center text-gray-400 py-10">No hazard reports found</div>
          )}
          {displayed.map((r) => {
            const daysOpen = Math.floor((Date.now() - new Date(r.createdAt)) / 86400000);
            const isOverdue = r.actionDueDate && new Date(r.actionDueDate) < new Date() &&
                              !['Controls_Applied','Verification','Closed'].includes(r.status);
            return (
              <div key={r.id} className={`card border-l-4 ${LIFECYCLE_BORDER[r.status] || 'border-l-gray-300'} hover:shadow-md transition-shadow`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Row 1: stage + severity + location + days open */}
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <StageBadge status={r.status} />
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
                        ${r.severity === 'Critical' ? 'bg-red-100 text-red-700' :
                          r.severity === 'High'     ? 'bg-orange-100 text-orange-700' :
                          r.severity === 'Medium'   ? 'bg-yellow-100 text-yellow-700' :
                                                      'bg-green-100 text-green-700'}`}>
                        {r.severity}
                      </span>
                      {r.location && <span className="text-xs text-gray-500">{r.location.name}</span>}
                      <span className={`flex items-center gap-1 text-xs ${daysOpen > 30 ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
                        <ClockIcon className="h-3 w-3" /> {daysOpen}d open
                      </span>
                      {isOverdue && (
                        <span className="flex items-center gap-1 text-xs text-red-600 font-medium bg-red-50 px-2 py-0.5 rounded-full">
                          <ExclamationTriangleIcon className="h-3 w-3" /> OVERDUE
                        </span>
                      )}
                      {r.confidentialReport && (
                        <span className="text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                          🔒 Confidential
                        </span>
                      )}
                    </div>

                    {/* Row 2: type + description */}
                    <p className="text-sm font-medium text-gray-800">{r.type?.replace(/_/g, ' ')}
                      {r.description && <span className="font-normal text-gray-600"> — {r.description.slice(0, 100)}{r.description.length > 100 ? '…' : ''}</span>}
                    </p>

                    {/* Row 3: risk ratings + action owner */}
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <span>Initial:</span><RiskPill rating={r.initialRiskRating} />
                      </div>
                      <div className="flex items-center gap-1">
                        <span>Residual:</span><RiskPill rating={r.residualRiskRating} />
                      </div>
                      {r.actionAssignedTo && (
                        <div className="flex items-center gap-1">
                          <span>Owner: {r.actionAssignedTo.name}</span>
                        </div>
                      )}
                      {r.actionDueDate && (
                        <span className={new Date(r.actionDueDate) < new Date() && r.status !== 'Closed' ? 'text-red-500 font-medium' : ''}>
                          Due: {formatDate(r.actionDueDate)}
                        </span>
                      )}
                      <span>Submitted: {formatDate(r.createdAt)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setDetailId(r.id)}
                    className="btn-secondary text-sm flex-shrink-0"
                  >
                    View / Update
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Hazard detail modal */}
      <Modal open={!!detailId} onClose={() => { setDetailId(null); load(); }} title="Hazard Report — SRM Lifecycle" size="full">
        {detailId && <HazardDetail reportId={detailId} onClose={() => { setDetailId(null); load(); }} />}
      </Modal>
    </div>
  );
}
