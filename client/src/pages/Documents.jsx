import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../utils/helpers';
import PageHeader from '../components/common/PageHeader';
import Modal from '../components/common/Modal';
import LocationSelect from '../components/common/LocationSelect';
import toast from 'react-hot-toast';
import { PlusIcon, DocumentArrowUpIcon, DocumentTextIcon } from '@heroicons/react/24/outline';

const DOC_TYPES = ['Safety Policy', 'Emergency Response Plan', 'Operating Procedure', 'Training Record', 'Checklist', 'Audit Report', 'Other'];
const STATUSES = ['Draft', 'Pending_Approval', 'Approved', 'Superseded'];

const STATUS_COLORS = {
  Draft:            'bg-gray-100 text-gray-700',
  Pending_Approval: 'bg-yellow-100 text-yellow-700',
  Approved:         'bg-green-100 text-green-700',
  Superseded:       'bg-red-100 text-red-700',
};

export default function Documents() {
  const { isSTA, isAdmin } = useAuth();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [locationId, setLocationId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [form, setForm] = useState({ title: '', type: '', version: '1.0', effectiveDate: '', locationId: '', file: null });
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (locationId) params.append('locationId', locationId);
      if (filterStatus) params.append('status', filterStatus);
      const r = await api.get(`/documents?${params}`);
      setDocs(r.data);
    } catch { toast.error('Failed to load documents'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [locationId, filterStatus]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setUploading(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v && k !== 'file') fd.append(k, v); });
      if (form.file) fd.append('file', form.file);
      await api.post('/documents', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Document created');
      setShowForm(false);
      setForm({ title: '', type: '', version: '1.0', effectiveDate: '', locationId: '', file: null });
      load();
    } catch (e) { toast.error(e.response?.data?.error || 'Upload failed'); }
    finally { setUploading(false); }
  };

  const changeStatus = async (id, status) => {
    try {
      await api.put(`/documents/${id}/status`, { status });
      toast.success('Status updated');
      load();
    } catch { toast.error('Failed to update status'); }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Safety Documents"
        subtitle="FAA §5.3, §5.95, §5.97 — Policy documents with version control and approval workflow"
        actions={
          isSTA && (
            <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2 text-sm">
              <PlusIcon className="h-4 w-4" /> Upload Document
            </button>
          )
        }
      />

      <div className="flex flex-wrap gap-3">
        {isAdmin && <LocationSelect value={locationId} onChange={(v) => setLocationId(v || '')} />}
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input w-48">
          <option value="">All Statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin h-6 w-6 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          {docs.length === 0 ? (
            <div className="text-center py-12 text-gray-400">No documents found</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Title', 'Type', 'Version', 'Status', 'Location', 'Effective Date', 'Approved By', 'Actions'].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {docs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <DocumentTextIcon className="h-4 w-4 text-gray-400" />
                        <span className="font-medium">{doc.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{doc.type}</td>
                    <td className="px-4 py-3 font-mono text-sm">{doc.version}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[doc.status]}`}>
                        {doc.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{doc.location?.name || 'All Locations'}</td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(doc.effectiveDate)}</td>
                    <td className="px-4 py-3 text-gray-500">{doc.approvedBy?.name || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {doc.fileUrl && (
                          <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs">Download</a>
                        )}
                        {isSTA && doc.status === 'Draft' && (
                          <button onClick={() => changeStatus(doc.id, 'Pending_Approval')} className="text-yellow-600 hover:underline text-xs">Submit</button>
                        )}
                        {isSTA && doc.status === 'Pending_Approval' && (
                          <button onClick={() => changeStatus(doc.id, 'Approved')} className="text-green-600 hover:underline text-xs">Approve</button>
                        )}
                        {doc.versions?.length > 0 && (
                          <span className="text-xs text-gray-400">{doc.versions.length} versions</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Upload modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Upload Safety Document">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="label">Document Title *</label>
            <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Document Type *</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="input" required>
                <option value="">Select...</option>
                {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Version</label>
              <input type="text" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} className="input" placeholder="1.0" />
            </div>
          </div>
          <div>
            <label className="label">Effective Date</label>
            <input type="date" value={form.effectiveDate} onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })} className="input" />
          </div>
          <div>
            <label className="label">File (PDF)</label>
            <input type="file" accept=".pdf,application/pdf"
              onChange={(e) => setForm({ ...form, file: e.target.files[0] })}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={uploading} className="btn-primary flex items-center gap-2">
              <DocumentArrowUpIcon className="h-4 w-4" />
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
