import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { formatDate, daysAgo } from '../utils/helpers';
import PageHeader from '../components/common/PageHeader';
import Modal from '../components/common/Modal';
import LocationSelect from '../components/common/LocationSelect';
import toast from 'react-hot-toast';
import { PlusIcon, PhoneIcon, BellAlertIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

export default function ERP() {
  const { isSTA, isAdmin, user } = useAuth();
  const [exercises, setExercises] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [erpStatus, setErpStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [locationId, setLocationId] = useState('');
  const [showExerciseForm, setShowExerciseForm] = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);
  const [exerciseForm, setExerciseForm] = useState({ date: '', type: '', participantsText: '', notes: '' });
  const [contactForm, setContactForm] = useState({ role: '', name: '', phone: '', email: '', priority: '0' });

  const effectiveLocId = isAdmin ? locationId : user?.locationId;

  const load = async () => {
    setLoading(true);
    try {
      const params = effectiveLocId ? `?locationId=${effectiveLocId}` : '';
      const [exRes, coRes] = await Promise.all([
        api.get(`/erp/exercises${params}`),
        api.get(`/erp/contacts${params}`),
      ]);
      setExercises(exRes.data);
      setContacts(coRes.data);
      if (effectiveLocId) {
        const stRes = await api.get(`/erp/status?locationId=${effectiveLocId}`);
        setErpStatus(stRes.data);
      }
    } catch { toast.error('Failed to load ERP data'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [locationId]);

  const handleLogExercise = async (e) => {
    e.preventDefault();
    try {
      await api.post('/erp/exercises', {
        locationId: effectiveLocId,
        date: exerciseForm.date,
        type: exerciseForm.type,
        participants: exerciseForm.participantsText.split(',').map((s) => s.trim()).filter(Boolean),
        notes: exerciseForm.notes,
      });
      toast.success('ERP exercise logged');
      setShowExerciseForm(false);
      setExerciseForm({ date: '', type: '', participantsText: '', notes: '' });
      load();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  const handleAddContact = async (e) => {
    e.preventDefault();
    try {
      await api.post('/erp/contacts', { ...contactForm, locationId: effectiveLocId });
      toast.success('Contact added');
      setShowContactForm(false);
      setContactForm({ role: '', name: '', phone: '', email: '', priority: '0' });
      load();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  const deleteContact = async (id) => {
    if (!window.confirm('Remove this contact?')) return;
    try {
      await api.delete(`/erp/contacts/${id}`);
      toast.success('Contact removed');
      load();
    } catch { toast.error('Failed to remove'); }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Emergency Response Plan"
        subtitle="FAA §5.17, §5.91 — ERP contacts, exercises, and drill tracking"
        actions={
          isSTA && (
            <button onClick={() => setShowExerciseForm(true)} className="btn-primary flex items-center gap-2 text-sm">
              <PlusIcon className="h-4 w-4" /> Log ERP Exercise
            </button>
          )
        }
      />

      {isAdmin && <LocationSelect value={locationId} onChange={(v) => setLocationId(v || '')} />}

      {/* ERP Status alert */}
      {erpStatus && (
        <div className={`rounded-xl p-4 border flex items-center gap-4 ${erpStatus.overdue ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
          {erpStatus.overdue ? (
            <BellAlertIcon className="h-8 w-8 text-red-500 flex-shrink-0" />
          ) : (
            <PhoneIcon className="h-8 w-8 text-green-500 flex-shrink-0" />
          )}
          <div>
            <p className={`font-semibold ${erpStatus.overdue ? 'text-red-800' : 'text-green-800'}`}>
              {erpStatus.overdue ? 'ERP Exercise OVERDUE' : 'ERP Exercise Current'}
            </p>
            <p className={`text-sm ${erpStatus.overdue ? 'text-red-600' : 'text-green-600'}`}>
              {erpStatus.lastExercise
                ? `Last exercise: ${formatDate(erpStatus.lastExercise.date)} (${erpStatus.daysSinceLast} days ago)`
                : 'No exercises recorded. FAA §5.17 requires ERP drills every 6 months.'}
            </p>
          </div>
          {erpStatus.overdue && isSTA && (
            <button onClick={() => setShowExerciseForm(true)} className="ml-auto btn-danger text-sm">Log Exercise Now</button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Emergency contacts */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <PhoneIcon className="h-5 w-5 text-blue-500" /> Emergency Contacts
            </h3>
            {isSTA && (
              <button onClick={() => setShowContactForm(true)} className="btn-secondary text-xs flex items-center gap-1">
                <PlusIcon className="h-3 w-3" /> Add Contact
              </button>
            )}
          </div>
          {contacts.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No contacts configured</p>
          ) : (
            <div className="space-y-3">
              {contacts.map((c, i) => (
                <div key={c.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
                  <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{c.name}</p>
                    <p className="text-xs text-gray-500">{c.role}</p>
                    {c.phone && <p className="text-xs text-blue-600 font-mono">{c.phone}</p>}
                    {c.email && <p className="text-xs text-gray-400">{c.email}</p>}
                  </div>
                  {isSTA && (
                    <button onClick={() => deleteContact(c.id)} className="text-red-400 hover:text-red-600 text-xs">Remove</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Exercise log */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <ExclamationTriangleIcon className="h-5 w-5 text-orange-500" /> ERP Exercise Log
          </h3>
          <div className="text-xs text-gray-400 mb-3">FAA §5.17 — Required every 6 months</div>
          {exercises.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No exercises recorded</p>
          ) : (
            <div className="space-y-3">
              {exercises.map((ex) => (
                <div key={ex.id} className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{ex.type}</span>
                    <span className="text-xs text-gray-400">{formatDate(ex.date)}</span>
                  </div>
                  {ex.location && <p className="text-xs text-gray-500">{ex.location.name}</p>}
                  {ex.participants?.length > 0 && (
                    <p className="text-xs text-gray-400 mt-1">Participants: {ex.participants.join(', ')}</p>
                  )}
                  {ex.notes && <p className="text-xs text-gray-600 mt-1">{ex.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Log Exercise Modal */}
      <Modal open={showExerciseForm} onClose={() => setShowExerciseForm(false)} title="Log ERP Exercise">
        <form onSubmit={handleLogExercise} className="space-y-4">
          <div>
            <label className="label">Exercise Date *</label>
            <input type="date" value={exerciseForm.date} onChange={(e) => setExerciseForm({ ...exerciseForm, date: e.target.value })} className="input" required />
          </div>
          <div>
            <label className="label">Exercise Type *</label>
            <select value={exerciseForm.type} onChange={(e) => setExerciseForm({ ...exerciseForm, type: e.target.value })} className="input" required>
              <option value="">Select...</option>
              {['Full Drill', 'Tabletop Exercise', 'Communications Check', 'Partial Drill', 'Annual Full-Scale Exercise'].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Participants (comma-separated)</label>
            <input type="text" value={exerciseForm.participantsText}
              onChange={(e) => setExerciseForm({ ...exerciseForm, participantsText: e.target.value })}
              className="input" placeholder="Alex Chen, Capt. Davis, Jordan Lee" />
          </div>
          <div>
            <label className="label">Notes / Observations</label>
            <textarea value={exerciseForm.notes} onChange={(e) => setExerciseForm({ ...exerciseForm, notes: e.target.value })}
              rows={3} className="input resize-none" />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowExerciseForm(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Log Exercise</button>
          </div>
        </form>
      </Modal>

      {/* Add Contact Modal */}
      <Modal open={showContactForm} onClose={() => setShowContactForm(false)} title="Add Emergency Contact" size="sm">
        <form onSubmit={handleAddContact} className="space-y-4">
          <div>
            <label className="label">Role *</label>
            <input type="text" value={contactForm.role} onChange={(e) => setContactForm({ ...contactForm, role: e.target.value })}
              className="input" placeholder="e.g. Safety & Training Advisor" required />
          </div>
          <div>
            <label className="label">Name *</label>
            <input type="text" value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
              className="input" required />
          </div>
          <div>
            <label className="label">Phone</label>
            <input type="tel" value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
              className="input" />
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
              className="input" />
          </div>
          <div>
            <label className="label">Priority (lower = first)</label>
            <input type="number" value={contactForm.priority} onChange={(e) => setContactForm({ ...contactForm, priority: e.target.value })}
              className="input" min="0" />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowContactForm(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Add Contact</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
