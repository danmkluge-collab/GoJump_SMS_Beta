import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/common/PageHeader';
import { formatDate } from '../utils/helpers';
import {
  ShieldCheckIcon, ChartBarIcon, MegaphoneIcon, DocumentTextIcon,
  ExclamationTriangleIcon, UserGroupIcon, BuildingOfficeIcon,
  CheckCircleIcon, AcademicCapIcon, ClipboardDocumentCheckIcon,
} from '@heroicons/react/24/outline';

// ── Regulatory compliance sections ────────────────────────────────────────────
const SMS_PILLARS = [
  {
    id: 'sp',
    title: 'Safety Policy',
    regs: '§5.21–5.27',
    icon: DocumentTextIcon,
    color: 'blue',
    description: 'Defines the organizational commitment to safety, the accountable executive, and the safety management policy. Establishes the framework for all SMS activities.',
    elements: [
      'Safety policy statement signed by Accountable Executive',
      'Safety objectives and performance targets',
      'Employee safety reporting (non-punitive culture)',
      'Safety roles and responsibilities — Accountability Matrix',
      'Emergency Response Plan (ERP)',
    ],
  },
  {
    id: 'srm',
    title: 'Safety Risk Management',
    regs: '§5.51–5.57',
    icon: ShieldCheckIcon,
    color: 'orange',
    description: 'Systematic process to identify hazards, assess risk, and implement mitigation strategies to bring risk to an acceptable level.',
    elements: [
      'Hazard identification and reporting system',
      'Risk assessment using likelihood × consequence matrix',
      'ALARP principle — risk as low as reasonably practicable',
      'Corrective action tracking and assignment',
      'Management of Change (MoC) — §5.51',
      'Risk acceptance authority per §5.55',
    ],
  },
  {
    id: 'sa',
    title: 'Safety Assurance',
    regs: '§5.71–5.75',
    icon: ClipboardDocumentCheckIcon,
    color: 'purple',
    description: 'Continuous monitoring and evaluation of SMS effectiveness to ensure safety performance meets or exceeds established objectives.',
    elements: [
      'Safety performance monitoring — KPIs and SPIs',
      'Internal audit programme (§5.71)',
      'Investigation of accidents and incidents (§5.73)',
      'Trend analysis — 90-day rolling hazard review (§5.91)',
      'Corrective action verification (§5.93)',
      'Continuous improvement process',
    ],
  },
  {
    id: 'spr',
    title: 'Safety Promotion',
    regs: '§5.91–5.97',
    icon: MegaphoneIcon,
    color: 'green',
    description: 'Training, communication, and organizational culture initiatives that create and sustain a positive safety culture throughout the organization.',
    elements: [
      'Safety training programme — initial and recurrent',
      'Safety bulletins and communications',
      'Just Culture policy — protected hazard reporting',
      'Safety committee meetings',
      'Safety performance data sharing across locations',
    ],
  },
];

const COLOR_MAP = {
  blue:   { bg: 'bg-blue-50',   border: 'border-blue-200',   icon: 'text-blue-600',   badge: 'bg-blue-100 text-blue-700'   },
  orange: { bg: 'bg-orange-50', border: 'border-orange-200', icon: 'text-orange-600', badge: 'bg-orange-100 text-orange-700' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', icon: 'text-purple-600', badge: 'bg-purple-100 text-purple-700' },
  green:  { bg: 'bg-green-50',  border: 'border-green-200',  icon: 'text-green-600',  badge: 'bg-green-100 text-green-700'  },
};

// ── Quick-stat card ───────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color = 'gray' }) {
  const colors = {
    gray:   'bg-gray-50 border-gray-200 text-gray-700',
    blue:   'bg-blue-50 border-blue-200 text-blue-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    red:    'bg-red-50 border-red-200 text-red-700',
    green:  'bg-green-50 border-green-200 text-green-700',
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <div className="text-2xl font-bold">{value ?? '—'}</div>
      <div className="text-sm font-medium mt-0.5">{label}</div>
      {sub && <div className="text-xs opacity-70 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function SMSOverview() {
  const { user, isAdmin } = useAuth();
  const [stats, setStats] = useState(null);
  const [aeInfo, setAeInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [dashRes] = await Promise.all([
          api.get('/dashboard'),
        ]);
        setStats(dashRes.data);

        // Try to fetch AE info for user's location
        if (user?.locationId) {
          try {
            const aeRes = await api.get(`/locations/${user.locationId}/accountable-executive`);
            setAeInfo(aeRes.data);
          } catch { /* no AE designated */ }
        }
      } catch { /* non-critical */ }
      finally { setLoading(false); }
    };
    loadData();
  }, [user]);

  return (
    <div className="space-y-8 max-w-5xl">
      <PageHeader
        title="SMS System Overview"
        subtitle="14 CFR Part 5 — Safety Management System Description"
      />

      {/* Organization header */}
      <div className="card">
        <div className="flex items-start gap-4">
          <div className="bg-blue-100 rounded-xl p-3 flex-shrink-0">
            <ShieldCheckIcon className="h-8 w-8 text-blue-700" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900">GoJump America Safety Management System</h2>
            <p className="text-gray-500 text-sm mt-0.5">14 CFR Part 5 Compliant SMS — Skydiving Operations</p>
            {user?.location && (
              <div className="flex items-center gap-2 mt-2">
                <BuildingOfficeIcon className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-600">{user.location.name}</span>
              </div>
            )}
          </div>
          <div className="text-right text-xs text-gray-400">
            <p>Last reviewed</p>
            <p className="font-medium">{formatDate(new Date().toISOString())}</p>
          </div>
        </div>
      </div>

      {/* Safety stats */}
      {!loading && stats && (
        <div>
          <h3 className="text-base font-semibold text-gray-900 mb-3">Safety Performance Snapshot</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <StatCard label="Open Hazards" value={stats.openHazardReports ?? stats.openHazards} color="orange" />
            <StatCard label="Open Incidents" value={stats.openIncidents} color="red" />
            <StatCard label="Overdue Actions" value={stats.overdueActions} color={stats.overdueActions > 0 ? 'red' : 'green'} />
            <StatCard label="KPIs Tracked" value={stats.totalKpis ?? stats.kpiCount} color="blue" />
            <StatCard label="Closed (90d)" value={stats.closedLast90} sub="Hazards + Incidents" color="green" />
          </div>
        </div>
      )}

      {/* Accountable Executive */}
      {aeInfo?.user && (
        <div className="card border-l-4 border-l-blue-500">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Accountable Executive — §5.25</p>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {aeInfo.user.name?.[0]?.toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-gray-900">{aeInfo.user.name}</p>
              <p className="text-xs text-gray-400">{aeInfo.user.email}</p>
              {aeInfo.user.aeAuthorityStatement && (
                <p className="text-xs text-gray-600 mt-1">{aeInfo.user.aeAuthorityStatement}</p>
              )}
              {aeInfo.aeDesignationDate && (
                <p className="text-xs text-gray-400">Designated: {formatDate(aeInfo.aeDesignationDate)}</p>
              )}
            </div>
            <div className="ml-auto">
              <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700 font-medium flex items-center gap-1">
                <CheckCircleIcon className="h-3 w-3" /> Designated
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 4 Pillars */}
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-4">Four Pillars of the SMS (14 CFR Part 5)</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {SMS_PILLARS.map((pillar) => {
            const c = COLOR_MAP[pillar.color];
            const Icon = pillar.icon;
            return (
              <div key={pillar.id} className={`rounded-xl border ${c.border} ${c.bg} p-5`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 rounded-lg bg-white/60 ${c.icon}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 text-sm">{pillar.title}</h4>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-mono font-medium ${c.badge}`}>{pillar.regs}</span>
                  </div>
                </div>
                <p className="text-sm text-gray-700 mb-3">{pillar.description}</p>
                <ul className="space-y-1.5">
                  {pillar.elements.map((el, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                      <CheckCircleIcon className={`h-3.5 w-3.5 flex-shrink-0 mt-0.5 ${c.icon}`} />
                      {el}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {/* Regulatory references */}
      <div className="card">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Regulatory Reference Index</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
          {[
            ['§5.1',  'Applicability'],
            ['§5.3',  'General Requirements'],
            ['§5.5',  'Safety Risk Management — general'],
            ['§5.7',  'Hazard Identification'],
            ['§5.9',  'Safety Assurance'],
            ['§5.11', 'Safety Promotion'],
            ['§5.21', 'Safety Policy'],
            ['§5.23', 'Safety Accountability'],
            ['§5.25', 'Designation of AE'],
            ['§5.27', 'Coordination of Emergency Response'],
            ['§5.51', 'Management of Change'],
            ['§5.53', 'Continuous Improvement'],
            ['§5.55', 'Risk Acceptance Authority'],
            ['§5.57', 'Analysis of Data'],
            ['§5.71', 'Safety Performance Monitoring'],
            ['§5.73', 'Analysis of Safety Data'],
            ['§5.75', 'System Assessment'],
            ['§5.91', 'Safety Promotion Requirements'],
            ['§5.93', 'Safety Communication'],
            ['§5.95', 'Competencies and Training'],
            ['§5.97', 'Safety Culture'],
          ].map(([ref, desc]) => (
            <div key={ref} className="flex items-start gap-2 py-1 border-b border-gray-100">
              <span className="font-mono text-xs text-blue-700 font-bold w-12 flex-shrink-0 mt-0.5">{ref}</span>
              <span className="text-gray-600 text-xs">{desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Process flow */}
      <div className="card">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Hazard Report Lifecycle (SRM Process)</h3>
        <div className="flex items-center flex-wrap gap-2">
          {[
            { label: 'Submitted', color: 'bg-gray-100 text-gray-700' },
            { label: 'Acknowledged', color: 'bg-blue-100 text-blue-700' },
            { label: 'Investigation', color: 'bg-yellow-100 text-yellow-800' },
            { label: 'Risk Assessed', color: 'bg-orange-100 text-orange-700' },
            { label: 'Controls Applied', color: 'bg-indigo-100 text-indigo-700' },
            { label: 'Verification', color: 'bg-purple-100 text-purple-700' },
            { label: 'Closed', color: 'bg-green-100 text-green-700' },
          ].map((s, i, arr) => (
            <React.Fragment key={s.label}>
              <span className={`px-3 py-1.5 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>
              {i < arr.length - 1 && <span className="text-gray-400 text-sm">→</span>}
            </React.Fragment>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-500">
          <p>• Each stage has documented validation requirements per §5.91</p>
          <p>• High/Critical residual risk requires AE acceptance per §5.55</p>
          <p>• Reporter receives automated updates at key milestones</p>
          <p>• Verification failure triggers re-investigation per §5.93</p>
        </div>
      </div>

      {/* Links to system modules */}
      <div className="card">
        <h3 className="text-base font-semibold text-gray-900 mb-4">SMS Modules</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: 'Hazard Reports',   path: '/hazard-reports',   icon: ExclamationTriangleIcon, ref: '§5.5, §5.7' },
            { label: 'Risk Register',    path: '/risk-register',    icon: ShieldCheckIcon,         ref: '§5.51, §5.55' },
            { label: 'Incidents',        path: '/incidents',        icon: ClipboardDocumentCheckIcon, ref: '§5.73' },
            { label: 'Internal Audits',  path: '/internal-audit',   icon: ClipboardDocumentCheckIcon, ref: '§5.71' },
            { label: 'KPIs',             path: '/kpis',             icon: ChartBarIcon,            ref: '§5.9' },
            { label: 'Safety Bulletins', path: '/safety-bulletins', icon: MegaphoneIcon,           ref: '§5.93' },
            { label: 'Training Records', path: '/training',         icon: AcademicCapIcon,         ref: '§5.95' },
            { label: 'Change Requests',  path: '/change-requests',  icon: DocumentTextIcon,        ref: '§5.51' },
            { label: 'Accountability',   path: '/accountability',   icon: UserGroupIcon,           ref: '§5.23' },
          ].map((m) => {
            const Icon = m.icon;
            return (
              <a
                key={m.path}
                href={m.path}
                className="flex items-center gap-2 p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors group"
              >
                <Icon className="h-4 w-4 text-gray-400 group-hover:text-blue-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-700 group-hover:text-blue-700">{m.label}</p>
                  <p className="text-xs text-gray-400">{m.ref}</p>
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}
