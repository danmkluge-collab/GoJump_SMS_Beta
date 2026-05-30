import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { formatDateTime } from '../utils/helpers';
import PageHeader from '../components/common/PageHeader';
import LocationSelect from '../components/common/LocationSelect';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { BookOpenIcon } from '@heroicons/react/24/outline';

const ACTION_COLORS = {
  CREATE: 'bg-green-100 text-green-700',
  UPDATE: 'bg-blue-100 text-blue-700',
  DELETE: 'bg-red-100 text-red-700',
  STATUS_CHANGE: 'bg-yellow-100 text-yellow-700',
};

export default function AuditLog() {
  const { isAdmin } = useAuth();
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [locationId, setLocationId] = useState('');
  const [tableName, setTableName] = useState('');
  const [page, setPage] = useState(1);
  const LIMIT = 50;

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: LIMIT });
      if (locationId) params.append('locationId', locationId);
      if (tableName) params.append('tableName', tableName);
      const r = await api.get(`/audit-log?${params}`);
      setLogs(r.data.data);
      setTotal(r.data.total);
    } catch { toast.error('Failed to load audit log'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [locationId, tableName, page]);

  const TABLES = ['hazard_reports', 'risk_register', 'incidents', 'documents', 'kpis', 'meetings', 'erp_exercises', 'audit_items'];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        subtitle={`${total} total entries · FAA §5.7, §5.9, §5.95, §5.97 — Read-only, tamper-evident`}
      />

      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 flex items-center gap-2 text-sm text-yellow-800">
        <BookOpenIcon className="h-4 w-4" />
        This audit log is read-only and immutable. All system actions are recorded with timestamp, user, role, and affected record.
      </div>

      <div className="flex flex-wrap gap-3">
        {isAdmin && <LocationSelect value={locationId} onChange={(v) => setLocationId(v || '')} />}
        <select value={tableName} onChange={(e) => setTableName(e.target.value)} className="input w-48">
          <option value="">All Tables</option>
          {TABLES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin h-6 w-6 border-4 border-blue-600 border-t-transparent rounded-full" />
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Timestamp', 'User', 'Role', 'Action', 'Table', 'Record ID'].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No audit entries found</td></tr>
                )}
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap text-xs">{formatDateTime(log.createdAt)}</td>
                    <td className="px-4 py-2.5">
                      <div>
                        <p className="font-medium">{log.user?.name || 'System'}</p>
                        <p className="text-xs text-gray-400">{log.user?.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 capitalize text-sm">{log.userRole?.replace('_', ' ') || '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-700'}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{log.tableName}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-400 max-w-24 truncate">{log.recordId?.slice(0, 8)}...</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {total > LIMIT && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                <p className="text-sm text-gray-500">Page {page} of {Math.ceil(total / LIMIT)} ({total} entries)</p>
                <div className="flex gap-2">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-sm">Previous</button>
                  <button onClick={() => setPage((p) => p + 1)} disabled={page >= Math.ceil(total / LIMIT)} className="btn-secondary text-sm">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
