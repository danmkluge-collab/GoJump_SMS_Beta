import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../utils/helpers';
import PageHeader from '../components/common/PageHeader';
import Modal from '../components/common/Modal';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  CheckCircleIcon,
  MegaphoneIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';

const BULLETIN_TYPES = [
  { value: 'safety_alert', label: 'Safety Alert', color: 'bg-red-100 text-red-700' },
  { value: 'lessons_learned', label: 'Lessons Learned', color: 'bg-blue-100 text-blue-700' },
  { value: 'regulatory_update', label: 'Regulatory Update', color: 'bg-purple-100 text-purple-700' },
  { value: 'procedure_change', label: 'Procedure Change', color: 'bg-orange-100 text-orange-700' },
];

const EMPTY_FORM = {
  title: '',
  type: 'safety_alert',
  summary: '',
  content: '',
};

function TypeBadge({ type }) {
  const match = BULLETIN_TYPES.find((t) => t.value === type);
  if (!match) return null;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${match.color}`}>
      {match.label}
    </span>
  );
}

function BulletinCard({ bulletin, onClick }) {
  const isUnacknowledged = bulletin.acknowledgedCount < bulletin.totalRecipients;
  const summary = bulletin.summary?.length > 120
    ? bulletin.summary.slice(0, 120) + '…'
    : bulletin.summary;

  return (
    <div
      onClick={onClick}
      className={`card cursor-pointer hover:shadow-md transition-shadow border-l-4
        ${isUnacknowledged ? 'border-l-blue-500' : 'border-l-gray-200'}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            {bulletin.bulletinNumber && (
              <span className="text-xs font-mono text-gray-400">{bulletin.bulletinNumber}</span>
            )}
            <TypeBadge type={bulletin.type} />
            {bulletin.status === 'Draft' && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                Draft
              </span>
            )}
          </div>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">{bulletin.title}</h3>
          {summary && <p className="text-sm text-gray-500 leading-relaxed">{summary}</p>}
          <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-gray-400">
            {bulletin.publishedAt && (
              <span>Published {formatDate(bulletin.publishedAt)}</span>
            )}
            {bulletin.acknowledgedCount !== undefined && (
              <span className={`flex items-center gap-1 ${isUnacknowledged ? 'text-blue-600 font-medium' : 'text-green-600'}`}>
                <CheckCircleIcon className="h-3.5 w-3.5" />
                Acknowledged {bulletin.acknowledgedCount}/{bulletin.totalRecipients}
              </span>
            )}
          </div>
        </div>
        <DocumentTextIcon className="h-5 w-5 text-gray-300 flex-shrink-0 mt-1" />
      </div>
    </div>
  );
}

function BulletinDetail({ bulletin, currentUser, isAdmin, isSTA, onClose, onReload }) {
  const [loading, setLoading] = useState(false);

  const hasAcknowledged = bulletin.acknowledgedBy?.some((a) => a.userId === currentUser?.id);
  const canPublish = (isAdmin || isSTA) && bulletin.status === 'Draft';

  const handleAcknowledge = async () => {
    setLoading(true);
    try {
      await api.post(`/safety-bulletins/${bulletin.id}/acknowledge`);
      toast.success('Bulletin acknowledged');
      onReload();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to acknowledge');
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!window.confirm('Publish this bulletin? It will be visible to all personnel.')) return;
    setLoading(true);
    try {
      await api.put(`/safety-bulletins/${bulletin.id}/publish`);
      toast.success('Bulletin published');
      onReload();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to publish');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header meta */}
      <div className="flex flex-wrap items-center gap-3">
        {bulletin.bulletinNumber && (
          <span className="text-sm font-mono text-gray-500">{bulletin.bulletinNumber}</span>
        )}
        <TypeBadge type={bulletin.type} />
        {bulletin.status === 'Draft' && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
            Draft
          </span>
        )}
        {bulletin.publishedAt && (
          <span className="text-sm text-gray-400">Published {formatDate(bulletin.publishedAt)}</span>
        )}
      </div>

      <h2 className="text-xl font-bold text-gray-900">{bulletin.title}</h2>

      {bulletin.summary && (
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <p className="text-sm font-semibold text-gray-700 mb-1">Summary</p>
          <p className="text-sm text-gray-600 leading-relaxed">{bulletin.summary}</p>
        </div>
      )}

      {bulletin.content && (
        <div className="prose prose-sm max-w-none text-gray-700">
          <p className="text-sm font-semibold text-gray-700 mb-2">Full Details</p>
          <div className="text-sm leading-relaxed whitespace-pre-wrap">{bulletin.content}</div>
        </div>
      )}

      {bulletin.regulatoryRefs && (
        <div className="text-sm">
          <p className="font-semibold text-gray-700 mb-1">Regulatory References</p>
          <p className="text-gray-600">{bulletin.regulatoryRefs}</p>
        </div>
      )}

      {/* Acknowledgement status */}
      {bulletin.acknowledgedCount !== undefined && bulletin.status !== 'Draft' && (
        <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 rounded-lg p-3 border border-gray-200">
          <CheckCircleIcon className="h-4 w-4 text-green-500" />
          <span>
            <span className="font-medium">{bulletin.acknowledgedCount}</span> of{' '}
            <span className="font-medium">{bulletin.totalRecipients}</span> personnel have acknowledged this bulletin.
          </span>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-100">
        {canPublish && (
          <button
            onClick={handlePublish}
            disabled={loading}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <MegaphoneIcon className="h-4 w-4" />
            Publish Bulletin
          </button>
        )}
        {!hasAcknowledged && bulletin.status !== 'Draft' && (
          <button
            onClick={handleAcknowledge}
            disabled={loading}
            className="btn-primary flex items-center gap-2 text-sm bg-green-600 hover:bg-green-700 focus:ring-green-500"
          >
            <CheckCircleIcon className="h-4 w-4" />
            Acknowledge
          </button>
        )}
        {hasAcknowledged && (
          <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
            <CheckCircleIcon className="h-4 w-4" />
            You have acknowledged this bulletin
          </span>
        )}
        <button onClick={onClose} className="btn-secondary text-sm ml-auto">
          Close
        </button>
      </div>
    </div>
  );
}

export default function SafetyBulletins() {
  const { user, isAdmin, isSTA } = useAuth();
  const [bulletins, setBulletins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/safety-bulletins');
      setBulletins(res.data);
    } catch {
      toast.error('Failed to load safety bulletins');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/safety-bulletins', form);
      toast.success('Bulletin saved as draft');
      setShowForm(false);
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save bulletin');
    }
  };

  const openDetail = async (bulletin) => {
    // Refresh the single bulletin for latest ack status
    try {
      const res = await api.get(`/safety-bulletins/${bulletin.id}`);
      setSelected(res.data);
    } catch {
      setSelected(bulletin);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Safety Bulletins"
        subtitle="FAA §5.93 — Safety communication, lessons learned and regulatory updates for all personnel"
        actions={
          (isAdmin || isSTA) && (
            <button
              onClick={() => { setForm(EMPTY_FORM); setShowForm(true); }}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              <PlusIcon className="h-4 w-4" />
              New Bulletin
            </button>
          )
        }
      />

      {/* Bulletin list */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin h-6 w-6 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      ) : bulletins.length === 0 ? (
        <div className="card text-center text-gray-400 py-12">
          <MegaphoneIcon className="h-10 w-10 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">No safety bulletins yet</p>
          {(isAdmin || isSTA) && (
            <p className="text-sm mt-1">Click "New Bulletin" to publish the first safety communication.</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {bulletins.map((bulletin) => (
            <BulletinCard
              key={bulletin.id}
              bulletin={bulletin}
              onClick={() => openDetail(bulletin)}
            />
          ))}
        </div>
      )}

      {/* Detail modal */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Safety Bulletin"
        size="xl"
      >
        {selected && (
          <BulletinDetail
            bulletin={selected}
            currentUser={user}
            isAdmin={isAdmin}
            isSTA={isSTA}
            onClose={() => setSelected(null)}
            onReload={load}
          />
        )}
      </Modal>

      {/* Create bulletin modal */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="New Safety Bulletin"
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="input"
              placeholder="e.g. Equipment Inspection Procedure Update"
              required
            />
          </div>

          <div>
            <label className="label">Bulletin Type *</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="input"
            >
              {BULLETIN_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Summary *</label>
            <textarea
              rows={3}
              value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
              className="input"
              placeholder="Brief summary shown in the list view (max ~120 characters recommended)…"
              required
            />
          </div>

          <div>
            <label className="label">Full Content *</label>
            <textarea
              rows={8}
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              className="input"
              placeholder="Full bulletin details, background, actions required, references…"
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary flex items-center gap-2">
              <DocumentTextIcon className="h-4 w-4" />
              Save as Draft
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
