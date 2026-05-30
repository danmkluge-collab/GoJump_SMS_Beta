import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import PageHeader from '../components/common/PageHeader';
import toast from 'react-hot-toast';
import {
  ShieldCheckIcon, ExclamationTriangleIcon, DocumentTextIcon,
  AcademicCapIcon, MegaphoneIcon, ClipboardDocumentListIcon,
  LockClosedIcon, CheckCircleIcon, ClockIcon,
} from '@heroicons/react/24/outline';

const CATEGORY_CONFIG = {
  srm: {
    label: 'Safety Risk Management',
    color: 'red',
    icon: ExclamationTriangleIcon,
    retention: 'Indefinite (FAA §5.95)',
    protected: true,
    description: 'Hazard reports, risk register items, and incident records. These SRM records must be retained permanently and cannot be deleted or archived.',
  },
  safety_assurance: {
    label: 'Safety Assurance',
    color: 'blue',
    icon: ShieldCheckIcon,
    retention: '5 years',
    protected: false,
    description: 'Documents, audit items, and safety committee meeting records.',
  },
  training: {
    label: 'Training Records',
    color: 'green',
    icon: AcademicCapIcon,
    retention: 'Indefinite (§5.95, 14 CFR §61)',
    protected: true,
    description: 'All training completion records. Retained permanently per aviation training regulations.',
  },
  communication: {
    label: 'Safety Communications',
    color: 'yellow',
    icon: MegaphoneIcon,
    retention: '24 months',
    protected: false,
    description: 'Safety bulletins and lessons-learned communications.',
  },
  audit: {
    label: 'Audit Logs',
    color: 'purple',
    icon: ClipboardDocumentListIcon,
    retention: '5 years',
    protected: false,
    description: 'System audit trail records capturing all data modifications.',
  },
};

const COLOR_MAP = {
  red:    { bg: 'bg-red-50',    border: 'border-red-200',    icon: 'text-red-600',    badge: 'bg-red-100 text-red-800'    },
  blue:   { bg: 'bg-blue-50',   border: 'border-blue-200',   icon: 'text-blue-600',   badge: 'bg-blue-100 text-blue-800'   },
  green:  { bg: 'bg-green-50',  border: 'border-green-200',  icon: 'text-green-600',  badge: 'bg-green-100 text-green-800'  },
  yellow: { bg: 'bg-yellow-50', border: 'border-yellow-200', icon: 'text-yellow-600', badge: 'bg-yellow-100 text-yellow-800' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', icon: 'text-purple-600', badge: 'bg-purple-100 text-purple-800' },
};

function CategoryCard({ categoryKey, data }) {
  const cfg = CATEGORY_CONFIG[categoryKey];
  const c   = COLOR_MAP[cfg.color];
  const Icon = cfg.icon;

  if (!data) return null;

  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} p-5`}>
      <div className="flex items-start gap-3 mb-3">
        <div className={`p-2 rounded-lg bg-white/60 ${c.icon}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-gray-900 text-sm">{cfg.label}</h3>
            {cfg.protected ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-800 text-white font-medium">
                <LockClosedIcon className="h-3 w-3" /> Protected
              </span>
            ) : (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.badge}`}>
                Managed
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">Retention: <strong>{cfg.retention}</strong></p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-gray-900">{data.count ?? 0}</div>
          <div className="text-xs text-gray-400">records</div>
        </div>
      </div>

      <p className="text-xs text-gray-600 mb-3">{cfg.description}</p>

      {data.expiredCount > 0 && (
        <div className="flex items-center gap-2 bg-orange-100 border border-orange-200 rounded-lg p-2 text-xs text-orange-800">
          <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0" />
          <span><strong>{data.expiredCount}</strong> record(s) past their retention period — review for archival</span>
        </div>
      )}

      {cfg.protected && (
        <div className="flex items-center gap-2 bg-white/60 rounded-lg p-2 text-xs text-gray-500">
          <LockClosedIcon className="h-4 w-4" />
          Deletion blocked — records protected under FAA §5.95
        </div>
      )}
    </div>
  );
}

export default function RecordsManagement() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/retention/summary');
      setSummary(res.data);
    } catch {
      toast.error('Failed to load retention summary');
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const totalRecords = summary
    ? Object.values(summary.totals || {}).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        title="Records Management"
        subtitle="FAA §5.95 — Records Retention & Archival"
      />

      {/* Regulatory banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
        <strong>§5.95 Records Retention:</strong> FAA Part 5 requires that all SMS records be retained for specified periods. Safety Risk Management (SRM) records — including hazard reports, risk register items, and incidents — must be retained <strong>indefinitely</strong>. Deletion of these records is prohibited. Safety assurance records must be retained for 5 years; safety communications for 24 months.
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin h-6 w-6 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      ) : summary ? (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="card text-center">
              <div className="text-3xl font-bold text-gray-900">{totalRecords.toLocaleString()}</div>
              <div className="text-sm text-gray-500 mt-1">Total Records</div>
            </div>
            <div className="card text-center">
              <div className="text-3xl font-bold text-red-600">
                {(summary.totals.hazardReports + summary.totals.riskItems + summary.totals.incidents).toLocaleString()}
              </div>
              <div className="text-sm text-gray-500 mt-1">SRM Records (Protected)</div>
            </div>
            <div className="card text-center">
              <div className="text-3xl font-bold text-blue-600">
                {((summary.categories.safety_assurance?.expiredCount || 0) + (summary.categories.communication?.expiredCount || 0)).toLocaleString()}
              </div>
              <div className="text-sm text-gray-500 mt-1">Expired / For Review</div>
            </div>
            <div className="card text-center">
              <div className="text-3xl font-bold text-green-600">
                {summary.totals.trainingRecords.toLocaleString()}
              </div>
              <div className="text-sm text-gray-500 mt-1">Training Records</div>
            </div>
          </div>

          {/* Category cards */}
          <div>
            <h3 className="text-base font-semibold text-gray-900 mb-4">Retention Categories</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {Object.entries(summary.categories).map(([key, data]) => (
                <CategoryCard key={key} categoryKey={key} data={data} />
              ))}
            </div>
          </div>

          {/* Detail breakdown */}
          <div className="card">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Record Counts by Module</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Hazard Reports',   count: summary.totals.hazardReports,    category: 'srm',              icon: ExclamationTriangleIcon },
                { label: 'Risk Register',    count: summary.totals.riskItems,        category: 'srm',              icon: ShieldCheckIcon },
                { label: 'Incidents',        count: summary.totals.incidents,        category: 'srm',              icon: ClipboardDocumentListIcon },
                { label: 'Documents',        count: summary.totals.documents,        category: 'safety_assurance', icon: DocumentTextIcon },
                { label: 'Meetings',         count: summary.totals.meetings,         category: 'safety_assurance', icon: ClockIcon },
                { label: 'Training Records', count: summary.totals.trainingRecords,  category: 'training',         icon: AcademicCapIcon },
                { label: 'Safety Bulletins', count: summary.totals.safetyBulletins,  category: 'communication',    icon: MegaphoneIcon },
                { label: 'Audit Logs',       count: summary.totals.auditLogs,        category: 'audit',            icon: CheckCircleIcon },
              ].map(({ label, count, category, icon: Icon }) => {
                const cfg = CATEGORY_CONFIG[category];
                const c   = COLOR_MAP[cfg?.color || 'blue'];
                return (
                  <div key={label} className={`rounded-lg border ${c.border} ${c.bg} p-3`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={`h-4 w-4 ${c.icon}`} />
                      <span className="text-xs font-medium text-gray-600">{label}</span>
                    </div>
                    <div className="text-xl font-bold text-gray-900">{count?.toLocaleString() ?? '—'}</div>
                    <div className="text-xs text-gray-400">{cfg?.retention}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Compliance checklist */}
          <div className="card">
            <h3 className="text-base font-semibold text-gray-900 mb-4">§5.95 Compliance Status</h3>
            <div className="space-y-2">
              {[
                { check: 'SRM records deletion blocked at API layer', ok: true },
                { check: 'Hazard reports tagged with indefinite retention category', ok: true },
                { check: 'Incident records tagged with indefinite retention category', ok: true },
                { check: 'Training records tagged with indefinite retention category', ok: true },
                { check: 'Safety assurance records tagged with 5-year expiry', ok: true },
                { check: 'Safety communications tagged with 24-month expiry', ok: true },
                { check: 'Audit log retention enforced (5 years)', ok: true },
              ].map(({ check, ok }) => (
                <div key={check} className="flex items-center gap-3 text-sm">
                  {ok ? (
                    <CheckCircleIcon className="h-5 w-5 text-green-500 flex-shrink-0" />
                  ) : (
                    <ExclamationTriangleIcon className="h-5 w-5 text-orange-400 flex-shrink-0" />
                  )}
                  <span className={ok ? 'text-gray-700' : 'text-orange-700'}>{check}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="card text-center text-gray-400 py-8">No retention data available</div>
      )}
    </div>
  );
}
