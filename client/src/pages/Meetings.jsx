import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../utils/helpers';
import PageHeader from '../components/common/PageHeader';
import Modal from '../components/common/Modal';
import LocationSelect from '../components/common/LocationSelect';
import toast from 'react-hot-toast';
import { PlusIcon, UserGroupIcon, CheckCircleIcon, ClockIcon } from '@heroicons/react/24/outline';

export default function Meetings() {
  const { isSTA, isAdmin } = useAuth();
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);
  const [locationId, setLocationId] = useState('');
  const [form, setForm] = useState({ locationId: '', date: '', attendeesText: '', agenda: '', notes: '', actionItems: [] });
  const [newAction, setNewAction] = useState({ description: '', assignedTo: '', dueDate: '', status: 'Open' });

  const load = async () => {
    setLoading(true);
    try {
      const params = locationId ? `?locationId=${locationId}` : '';
      const r = await api.get(`/meetings${params}`);
      setMeetings(r.data);
    } catch { toast.error('Failed to load meetings'); }
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
      await api.post('/meetings', {
        locationId: form.locationId || undefined,
        date: form.date,
        attendees: form.attendeesText.split(',').map((s) => s.trim()).filter(Boolean),
        agenda: form.agenda,
        notes: form.notes,
        actionItems: form.actionItems,
      });
      toast.success('Meeting logged');
      setShowForm(false);
      setForm({ locationId: '', date: '', attendeesText: '', agenda: '', notes: '', actionItems: [] });
      load();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  const addAction = () => {
    if (!newAction.description) return;
    setForm({ ...form, actionItems: [...form.actionItems, { ...newAction, id: Date.now() }] });
    setNewAction({ description: '', assignedTo: '', dueDate: '', status: 'Open' });
  };

  const closeActionItem = async (itemIndex) => {
    const items = Array.isArray(selected.actionItems) ? selected.actionItems : (() => { try { return JSON.parse(selected.actionItems || '[]'); } catch { return []; } })();
    const updated = items.map((item, i) =>
      i === itemIndex ? { ...item, status: 'Closed', closedAt: new Date().toISOString() } : item
    );
    try {
      const r = await api.put(`/meetings/${selected.id}`, { actionItems: updated });
      setSelected(r.data);
      load();
      toast.success('Action item closed');
    } catch { toast.error('Failed to close action item'); }
  };

  const reopenActionItem = async (itemIndex) => {
    const items = Array.isArray(selected.actionItems) ? selected.actionItems : (() => { try { return JSON.parse(selected.actionItems || '[]'); } catch { return []; } })();
    const updated = items.map((item, i) =>
      i === itemIndex ? { ...item, status: 'Open', closedAt: null } : item
    );
    try {
      const r = await api.put(`/meetings/${selected.id}`, { actionItems: updated });
      setSelected(r.data);
      load();
      toast.success('Action item reopened');
    } catch { toast.error('Failed to reopen action item'); }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Safety Committee Meetings"
        subtitle="FAA §5.7, §5.9 — Meeting logs and action item tracking"
        actions={
          isSTA && (
            <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2 text-sm">
              <PlusIcon className="h-4 w-4" /> Log Meeting
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
        <div className="space-y-4">
          {meetings.length === 0 && <div className="card text-center text-gray-400 py-8">No meetings logged</div>}
          {meetings.map((m) => {
            const items = Array.isArray(m.actionItems) ? m.actionItems : (() => { try { return JSON.parse(m.actionItems || '[]'); } catch { return []; } })();
            const openItems = items.filter((i) => i.status !== 'Closed').length;
            return (
              <div key={m.id} className="card cursor-pointer hover:border-blue-200 transition-colors" onClick={() => setSelected(m)}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <UserGroupIcon className="h-5 w-5 text-blue-500" />
                      <span className="font-semibold text-gray-900">Safety Committee Meeting — {formatDate(m.date)}</span>
                      {openItems > 0 && (
                        <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                          {openItems} open action{openItems > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{m.location?.name}</p>
                    {m.attendees?.length > 0 && (
                      <p className="text-xs text-gray-400 mt-1">Attendees: {m.attendees.join(', ')}</p>
                    )}
                  </div>
                </div>
                {m.agenda && <p className="text-sm text-gray-700 mt-2 line-clamp-2">{m.agenda}</p>}
              </div>
            );
          })}
        </div>
      )}

      {/* Detail modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Meeting Detail" size="lg">
        {selected && (() => {
          const items = Array.isArray(selected.actionItems) ? selected.actionItems : (() => { try { return JSON.parse(selected.actionItems || '[]'); } catch { return []; } })();
          const openCount   = items.filter((i) => i.status !== 'Closed').length;
          const closedCount = items.filter((i) => i.status === 'Closed').length;
          return (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="label">Date</span>{formatDate(selected.date)}</div>
                <div><span className="label">Location</span>{selected.location?.name}</div>
                <div className="col-span-2"><span className="label">Attendees</span>{selected.attendees?.join(', ')}</div>
              </div>
              {selected.agenda && (
                <div><span className="label">Agenda</span><p className="text-sm mt-1 bg-gray-50 rounded p-3">{selected.agenda}</p></div>
              )}
              {selected.notes && (
                <div><span className="label">Meeting Notes</span><p className="text-sm mt-1 bg-gray-50 rounded p-3">{selected.notes}</p></div>
              )}

              {/* Action items */}
              {items.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="label mb-0">Action Items</span>
                    <div className="flex gap-2 text-xs">
                      {openCount > 0 && <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">{openCount} open</span>}
                      {closedCount > 0 && <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">{closedCount} closed</span>}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {items.map((item, i) => {
                      const isClosed = item.status === 'Closed';
                      const isOverdue = item.dueDate && !isClosed && new Date(item.dueDate) < new Date();
                      return (
                        <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${isClosed ? 'bg-green-50 border-green-200' : isOverdue ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                          {/* Status icon */}
                          <div className="mt-0.5 flex-shrink-0">
                            {isClosed
                              ? <CheckCircleIcon className="h-5 w-5 text-green-500" />
                              : <ClockIcon className={`h-5 w-5 ${isOverdue ? 'text-red-400' : 'text-orange-400'}`} />
                            }
                          </div>
                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${isClosed ? 'line-through text-gray-400' : 'text-gray-800'}`}>{item.description}</p>
                            <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
                              {item.assignedTo && <span>👤 {item.assignedTo}</span>}
                              {item.dueDate && (
                                <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                                  📅 Due {formatDate(item.dueDate)}{isOverdue ? ' — OVERDUE' : ''}
                                </span>
                              )}
                              {item.closedAt && <span>✓ Closed {formatDate(item.closedAt)}</span>}
                            </div>
                          </div>
                          {/* Action button — STA/admin only */}
                          {(isSTA || isAdmin) && (
                            isClosed ? (
                              <button
                                onClick={() => reopenActionItem(i)}
                                className="flex-shrink-0 text-xs px-2 py-1 rounded border border-gray-300 text-gray-500 hover:border-orange-400 hover:text-orange-600 transition-colors"
                              >
                                Reopen
                              </button>
                            ) : (
                              <button
                                onClick={() => closeActionItem(i)}
                                className="flex-shrink-0 text-xs px-2 py-1 rounded border border-green-300 text-green-700 bg-white hover:bg-green-50 font-medium transition-colors"
                              >
                                ✓ Close
                              </button>
                            )
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {openCount === 0 && items.length > 0 && (
                    <p className="text-sm text-green-600 font-medium mt-2 flex items-center gap-1">
                      <CheckCircleIcon className="h-4 w-4" /> All action items complete
                    </p>
                  )}
                </div>
              )}
              {items.length === 0 && (
                <p className="text-sm text-gray-400 italic">No action items for this meeting.</p>
              )}
            </div>
          );
        })()}
      </Modal>

      {/* Create meeting modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Log Safety Committee Meeting" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          {isAdmin && (
            <div>
              <label className="label">Location *</label>
              <LocationSelect value={form.locationId} onChange={(v) => setForm({ ...form, locationId: v || '' })} />
            </div>
          )}
          <div>
            <label className="label">Meeting Date *</label>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="input" required />
          </div>
          <div>
            <label className="label">Attendees (comma-separated) *</label>
            <input type="text" value={form.attendeesText} onChange={(e) => setForm({ ...form, attendeesText: e.target.value })}
              className="input" placeholder="Alex Chen, Jordan Lee, Chris GoJump" required />
          </div>
          <div>
            <label className="label">Agenda Items</label>
            <textarea value={form.agenda} onChange={(e) => setForm({ ...form, agenda: e.target.value })} rows={3} className="input resize-none" />
          </div>
          <div>
            <label className="label">Meeting Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className="input resize-none" />
          </div>

          {/* Action items */}
          <div>
            <label className="label">Action Items</label>
            <div className="space-y-2 mb-2">
              {form.actionItems.map((item, i) => (
                <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 rounded text-sm">
                  <span className="flex-1">{item.description} — {item.assignedTo} (due {formatDate(item.dueDate)})</span>
                  <button type="button" onClick={() => setForm({ ...form, actionItems: form.actionItems.filter((_, j) => j !== i) })}
                    className="text-red-400 hover:text-red-600 text-xs">Remove</button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input type="text" value={newAction.description} onChange={(e) => setNewAction({ ...newAction, description: e.target.value })}
                placeholder="Action description" className="input flex-1" />
              <input type="text" value={newAction.assignedTo} onChange={(e) => setNewAction({ ...newAction, assignedTo: e.target.value })}
                placeholder="Assigned to" className="input w-32" />
              <input type="date" value={newAction.dueDate} onChange={(e) => setNewAction({ ...newAction, dueDate: e.target.value })}
                className="input w-36" />
              <button type="button" onClick={addAction} className="btn-secondary text-sm">Add</button>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Log Meeting</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
