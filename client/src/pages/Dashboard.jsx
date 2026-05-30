import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { STAGE_LABELS, LIFECYCLE_COLORS } from '../utils/helpers';
import {
  ExclamationTriangleIcon, CheckCircleIcon, ClockIcon, ShieldExclamationIcon,
  ArrowTrendingUpIcon, ArrowTrendingDownIcon, BellAlertIcon, DocumentArrowDownIcon,
} from '@heroicons/react/24/outline';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { formatDate, formatDateTime } from '../utils/helpers';
import LocationSelect from '../components/common/LocationSelect';
import toast from 'react-hot-toast';

const COLORS = ['#3b82f6', '#f59e0b', '#ef4444', '#10b981', '#8b5cf6', '#f97316'];

function KpiCard({ title, value, sub, trend, icon: Icon, color = 'blue', alert }) {
  const colorMap = {
    blue:   { bg: 'bg-blue-50',   text: 'text-blue-700',   icon: 'text-blue-500'   },
    yellow: { bg: 'bg-yellow-50', text: 'text-yellow-700', icon: 'text-yellow-500' },
    red:    { bg: 'bg-red-50',    text: 'text-red-700',    icon: 'text-red-500'    },
    green:  { bg: 'bg-green-50',  text: 'text-green-700',  icon: 'text-green-500'  },
  };
  const c = colorMap[color];
  return (
    <div className={`card border-l-4 ${alert ? 'border-l-red-500' : 'border-l-' + color + '-500'}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className={`text-3xl font-bold mt-1 ${alert ? 'text-red-600' : c.text}`}>{value ?? '—'}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
          {trend !== undefined && trend !== null && (
            <div className="flex items-center gap-1 mt-1">
              {trend > 0
                ? <ArrowTrendingUpIcon className="h-4 w-4 text-red-500" />
                : <ArrowTrendingDownIcon className="h-4 w-4 text-green-500" />
              }
              <span className={`text-xs font-medium ${trend > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {Math.abs(trend)}% vs last month
              </span>
            </div>
          )}
        </div>
        <div className={`${c.bg} p-3 rounded-xl`}>
          <Icon className={`h-6 w-6 ${c.icon}`} />
        </div>
      </div>
    </div>
  );
}

// ── SRM Summary widget ────────────────────────────────────────────────────────
const STAGE_BAR_COLORS = {
  Submitted: '#9ca3af', Acknowledged: '#3b82f6', Under_Investigation: '#f59e0b',
  Risk_Assessed: '#f97316', Controls_Applied: '#6366f1', Verification: '#a855f7', Closed: '#10b981',
};

function SrmWidget({ locationId }) {
  const [srm, setSrm] = useState(null);
  useEffect(() => {
    const params = locationId ? `?locationId=${locationId}` : '';
    api.get(`/dashboard/srm-summary${params}`).then((r) => setSrm(r.data)).catch(() => {});
  }, [locationId]);
  if (!srm) return <div className="card animate-pulse h-48" />;

  const chartData = srm.byStage.map((s) => ({ name: STAGE_LABELS[s.stage] || s.stage, count: s.count, stage: s.stage }));
  return (
    <div className="card">
      <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-blue-500 inline-block" />
        SRM Lifecycle Summary — Hazard Register
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className={`rounded-lg p-3 text-center ${srm.overdueActions > 0 ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}>
          <p className={`text-2xl font-bold ${srm.overdueActions > 0 ? 'text-red-600' : 'text-gray-700'}`}>{srm.overdueActions}</p>
          <p className="text-xs text-gray-500 mt-0.5">Overdue Actions</p>
        </div>
        <div className={`rounded-lg p-3 text-center ${srm.failedVerification > 0 ? 'bg-orange-50 border border-orange-200' : 'bg-gray-50'}`}>
          <p className={`text-2xl font-bold ${srm.failedVerification > 0 ? 'text-orange-600' : 'text-gray-700'}`}>{srm.failedVerification}</p>
          <p className="text-xs text-gray-500 mt-0.5">Failed Verification</p>
        </div>
        <div className="rounded-lg p-3 text-center bg-green-50">
          <p className="text-2xl font-bold text-green-600">{srm.riskReduction.reducedCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">High/Critical → Reduced</p>
        </div>
        <div className="rounded-lg p-3 text-center bg-blue-50">
          <p className="text-2xl font-bold text-blue-600">{srm.avgDaysOpen}</p>
          <p className="text-xs text-gray-500 mt-0.5">Avg Days Open</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={chartData} margin={{ top: 0, right: 8, bottom: 40, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" name="Reports" radius={[4, 4, 0, 0]}>
            {chartData.map((entry) => (
              <Cell key={entry.stage} fill={STAGE_BAR_COLORS[entry.stage] || '#9ca3af'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-2 text-right">
        <Link to="/hazard-reports" className="text-xs text-blue-600 hover:underline">View full hazard register →</Link>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user, isAdmin, isSTA } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [locationId, setLocationId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const params = locationId ? `?locationId=${locationId}` : '';
      const r = await api.get(`/dashboard/overview${params}`);
      setData(r.data);
    } catch { toast.error('Failed to load dashboard'); }
    finally { setLoading(false); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [locationId]);

  const handleExport = async (format) => {
    try {
      const params = `?format=${format}${locationId ? `&locationId=${locationId}` : ''}`;
      const r = await api.get(`/dashboard/export${params}`, { responseType: 'blob' });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gojump-sms-export.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Export failed'); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
    </div>
  );

  const { kpis, erpOverdue, trendChart, typeBreakdown, severityBreakdown, flaggedTrends, recentReports } = data || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Safety Dashboard</h1>
          <p className="text-sm text-gray-500">
            {user?.location?.name || 'All Locations'} · FAA 14 CFR Part 5 §5.7, §5.9
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && <LocationSelect value={locationId} onChange={setLocationId} className="w-48" />}
          <div className="flex gap-2">
            <button onClick={() => handleExport('csv')} className="btn-secondary flex items-center gap-2 text-sm">
              <DocumentArrowDownIcon className="h-4 w-4" /> CSV
            </button>
          </div>
        </div>
      </div>

      {/* ERP Alert */}
      {erpOverdue && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-4">
          <BellAlertIcon className="h-8 w-8 text-red-500 flex-shrink-0" />
          <div>
            <p className="font-semibold text-red-800">Emergency Response Plan Exercise Overdue</p>
            <p className="text-sm text-red-600">FAA §5.17 requires ERP drills every 6 months. Schedule an exercise immediately.</p>
          </div>
          <Link to="/erp" className="ml-auto btn-danger text-sm">View ERP</Link>
        </div>
      )}

      {/* Flagged Trends */}
      {flaggedTrends?.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <p className="font-semibold text-orange-800 flex items-center gap-2">
            <ArrowTrendingUpIcon className="h-5 w-5" />
            Recurring Hazard Trend Alert (90-day window)
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            {flaggedTrends.map((t) => (
              <span key={t.type} className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm font-medium">
                {t.type.replace(/_/g, ' ')} — {t.count} reports
              </span>
            ))}
          </div>
          <p className="text-xs text-orange-600 mt-2">S&TA review required per FAA §5.91, §5.95</p>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          title="Open Hazard Reports"
          value={kpis?.openHazards}
          icon={ExclamationTriangleIcon}
          color={kpis?.openHazards > 5 ? 'red' : 'yellow'}
          alert={kpis?.openHazards > 10}
        />
        <KpiCard
          title="Resolved This Month"
          value={kpis?.resolvedThisMonth}
          icon={CheckCircleIcon}
          color="green"
        />
        <KpiCard
          title="Open Incidents"
          value={kpis?.openIncidents}
          sub={`${kpis?.overdueActions || 0} overdue`}
          icon={ClockIcon}
          color={kpis?.overdueActions > 0 ? 'red' : 'blue'}
          alert={kpis?.overdueActions > 0}
        />
        <KpiCard
          title="Critical/High Risk Items"
          value={kpis?.criticalHighOpen}
          icon={ShieldExclamationIcon}
          color={kpis?.criticalHighOpen > 0 ? 'red' : 'green'}
          alert={kpis?.criticalHighOpen > 0}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          title="Reports This Month"
          value={kpis?.totalReportsThisMonth}
          trend={kpis?.reportsChangePct}
          icon={ArrowTrendingUpIcon}
          color="blue"
        />
        <KpiCard
          title="Avg Days to Close"
          value={kpis?.avgDaysToClose != null ? `${kpis.avgDaysToClose}d` : 'N/A'}
          sub="Target: < 14 days"
          icon={ClockIcon}
          color={kpis?.avgDaysToClose > 14 ? 'red' : 'green'}
        />
        <KpiCard
          title="Closed Incidents (Month)"
          value={kpis?.closedIncidentsThisMonth}
          icon={CheckCircleIcon}
          color="green"
        />
        <KpiCard
          title="Overdue Actions"
          value={kpis?.overdueActions}
          icon={BellAlertIcon}
          color={kpis?.overdueActions > 0 ? 'red' : 'green'}
          alert={kpis?.overdueActions > 0}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trend chart */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Reports — Last 30 Days</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trendChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip labelFormatter={(v) => `Date: ${v}`} />
              <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={false} name="Reports" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Hazard type breakdown */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Hazard Types (90 days)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={typeBreakdown} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="type" tick={{ fontSize: 11 }} width={100}
                tickFormatter={(v) => v.replace(/_/g, ' ')} />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Reports" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Severity pie + Recent reports */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Severity Distribution</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={severityBreakdown} dataKey="count" nameKey="severity" cx="50%" cy="50%" outerRadius={80} label={({ severity, percent }) => `${severity} ${(percent * 100).toFixed(0)}%`}>
                {severityBreakdown?.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Recent reports */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Recent Reports</h3>
            <Link to="/hazard-reports" className="text-sm text-blue-600 hover:underline">View all</Link>
          </div>
          <div className="space-y-3">
            {recentReports?.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No reports yet</p>}
            {recentReports?.map((r) => (
              <div key={r.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                <div className={`mt-0.5 h-2.5 w-2.5 rounded-full flex-shrink-0 ${r.severity === 'Critical' ? 'bg-red-500' : r.severity === 'High' ? 'bg-orange-500' : r.severity === 'Medium' ? 'bg-yellow-500' : 'bg-green-500'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{r.type.replace(/_/g, ' ')} — {r.severity}</p>
                  <p className="text-xs text-gray-500 truncate">{r.description}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{r.location?.name} · {formatDate(r.createdAt)}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${LIFECYCLE_COLORS[r.status] || 'bg-gray-100 text-gray-700'}`}>
                  {STAGE_LABELS[r.status] || r.status.replace(/_/g, ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SRM Lifecycle Widget — S&TA and admin only */}
      {(isSTA || isAdmin) && <SrmWidget locationId={locationId} />}

      <p className="text-xs text-gray-400 text-center">
        GoJump America SMS · FAA 14 CFR Part 5 §5.7, §5.9, §5.75 · Data refreshes on page load
      </p>
    </div>
  );
}
