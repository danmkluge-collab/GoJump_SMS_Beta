import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { formatDate, KPI_STATUS_COLORS } from '../utils/helpers';
import PageHeader from '../components/common/PageHeader';
import Modal from '../components/common/Modal';
import LocationSelect from '../components/common/LocationSelect';
import toast from 'react-hot-toast';
import { PlusIcon, PencilIcon } from '@heroicons/react/24/outline';

const FREQUENCIES = ['Monthly', 'Quarterly', 'Annually'];

export default function KPIs() {
  const { isSTA, isAdmin } = useAuth();
  const [kpis, setKpis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [updating, setUpdating] = useState(null);
  const [locationId, setLocationId] = useState('');
  const [form, setForm] = useState({ name: '', frequency: 'Monthly', targetValue: '', measureMethod: '', regulatoryRefs: [] });
  const [updateValue, setUpdateValue] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const params = locationId ? `?locationId=${locationId}` : '';
      const r = await api.get(`/kpis${params}`);
      setKpis(r.data);
    } catch { toast.error('Failed to load KPIs'); }
    finally { setLoading(false); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [locationId]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/kpis', { ...form, locationId });
      toast.success('KPI created');
      setShowForm(false);
      setForm({ name: '', frequency: 'Monthly', targetValue: '', measureMethod: '', regulatoryRefs: [] });
      load();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  const handleUpdate = async (id) => {
    try {
      await api.put(`/kpis/${id}`, { currentValue: updateValue });
      toast.success('KPI value updated');
      setUpdating(null);
      load();
    } catch { toast.error('Failed to update'); }
  };

  const statusColors = {
    On_Target:  'border-l-green-500',
    At_Risk:    'border-l-yellow-500',
    Off_Target: 'border-l-red-500',
    null:       'border-l-gray-300',
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Key Performance Indicators"
        subtitle="FAA §5.75 — Safety performance monitoring"
        actions={
          isSTA && (
            <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2 text-sm">
              <PlusIcon className="h-4 w-4" /> Add KPI
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {kpis.length === 0 && <div className="col-span-2 card text-center text-gray-400 py-8">No KPIs configured</div>}
          {kpis.map((kpi) => {
            const history = Array.isArray(kpi.history) ? kpi.history : (() => { try { return JSON.parse(kpi.history || '[]'); } catch { return []; } })();
            const chartData = history.slice(-12).map((h) => ({ date: formatDate(h.date), value: h.value }));
            const pct = kpi.currentValue != null && kpi.targetValue
              ? Math.round((kpi.currentValue / kpi.targetValue) * 100)
              : null;

            return (
              <div key={kpi.id} className={`card border-l-4 ${statusColors[kpi.status] || 'border-l-gray-300'}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{kpi.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-400">{kpi.frequency} · {kpi.location?.name}</span>
                      {kpi.status && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${KPI_STATUS_COLORS[kpi.status]}`}>
                          {kpi.status.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                  </div>
                  {isSTA && (
                    <button onClick={() => setUpdating(kpi)} className="btn-secondary text-xs flex items-center gap-1">
                      <PencilIcon className="h-3.5 w-3.5" /> Update
                    </button>
                  )}
                </div>

                <div className="flex items-end gap-4 mb-4">
                  <div>
                    <p className="text-xs text-gray-400">Current</p>
                    <p className="text-3xl font-bold text-gray-900">{kpi.currentValue ?? '—'}</p>
                  </div>
                  <div className="text-gray-300">/</div>
                  <div>
                    <p className="text-xs text-gray-400">Target</p>
                    <p className="text-xl font-semibold text-gray-500">{kpi.targetValue}</p>
                  </div>
                  {pct != null && (
                    <div className="ml-auto text-right">
                      <p className="text-xs text-gray-400">vs target</p>
                      <p className={`text-lg font-bold ${pct <= 100 ? 'text-green-600' : 'text-red-600'}`}>{pct}%</p>
                    </div>
                  )}
                </div>

                {/* Progress bar */}
                {pct != null && (
                  <div className="h-2 bg-gray-100 rounded-full mb-4">
                    <div
                      className={`h-2 rounded-full transition-all ${pct <= 100 ? 'bg-green-500' : pct <= 120 ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                )}

                {/* Trend chart */}
                {chartData.length > 1 && (
                  <ResponsiveContainer width="100%" height={80}>
                    <LineChart data={chartData}>
                      <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={false} />
                      <XAxis dataKey="date" hide />
                      <YAxis hide />
                      <Tooltip />
                    </LineChart>
                  </ResponsiveContainer>
                )}

                {kpi.measureMethod && (
                  <p className="text-xs text-gray-400 mt-2">Method: {kpi.measureMethod}</p>
                )}
                {kpi.regulatoryRefs?.length > 0 && (
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {kpi.regulatoryRefs.map((r) => <span key={r} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">{r}</span>)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create KPI modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Add KPI">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="label">KPI Name *</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" required placeholder="e.g. Reserve Deployments per 1,000 Jumps" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Frequency</label>
              <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} className="input">
                {FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Target Value *</label>
              <input type="number" step="0.01" value={form.targetValue} onChange={(e) => setForm({ ...form, targetValue: e.target.value })} className="input" required />
            </div>
          </div>
          <div>
            <label className="label">Measurement Method</label>
            <input type="text" value={form.measureMethod} onChange={(e) => setForm({ ...form, measureMethod: e.target.value })} className="input" placeholder="How is this measured?" />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Create KPI</button>
          </div>
        </form>
      </Modal>

      {/* Update value modal */}
      <Modal open={!!updating} onClose={() => setUpdating(null)} title={`Update: ${updating?.name}`} size="sm">
        <div className="space-y-4">
          <div>
            <label className="label">Current Value</label>
            <input
              type="number"
              step="0.01"
              value={updateValue}
              onChange={(e) => setUpdateValue(e.target.value)}
              className="input"
              placeholder={`Target: ${updating?.targetValue}`}
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setUpdating(null)} className="btn-secondary">Cancel</button>
            <button onClick={() => handleUpdate(updating?.id)} className="btn-primary">Save Value</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
