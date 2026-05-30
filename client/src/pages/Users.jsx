import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { formatDate } from '../utils/helpers';
import PageHeader from '../components/common/PageHeader';
import Modal from '../components/common/Modal';
import toast from 'react-hot-toast';
import { PlusIcon, PencilIcon } from '@heroicons/react/24/outline';

const ROLES = ['admin', 'staff', 's_ta'];

const ROLE_COLORS = {
  admin: 'bg-purple-100 text-purple-800',
  s_ta: 'bg-blue-100 text-blue-800',
  staff: 'bg-green-100 text-green-800',
  employee: 'bg-gray-100 text-gray-800',
};

// Defined outside Users so React never remounts it on parent re-renders
function UserForm({ form, setForm, locations, onSubmit, onCancel, isEdit }) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div><label className="label">Full Name *</label><input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" required /></div>
      <div><label className="label">Email *</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" required /></div>
      <div><label className="label">{isEdit ? 'New Password (leave blank to keep)' : 'Password *'}</label><input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="input" required={!isEdit} /></div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Role *</label>
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="input">
            {ROLES.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Location</label>
          <select value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })} className="input">
            <option value="">All Locations (Admin)</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
      </div>
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
        <button type="submit" className="btn-primary">{isEdit ? 'Update User' : 'Create User'}</button>
      </div>
    </form>
  );
}

export default function Users() {
  const [users, setUsers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'staff', locationId: '' });

  const load = async () => {
    setLoading(true);
    try {
      const [uRes, lRes] = await Promise.all([api.get('/users'), api.get('/locations')]);
      setUsers(uRes.data);
      setLocations(lRes.data);
    } catch { toast.error('Failed to load users'); }
    finally { setLoading(false); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/users', form);
      toast.success('User created');
      setShowForm(false);
      setForm({ name: '', email: '', password: '', role: 'staff', locationId: '' });
      load();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/users/${editing.id}`, form);
      toast.success('User updated');
      setEditing(null);
      load();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  const openEdit = (user) => {
    setEditing(user);
    setForm({ name: user.name, email: user.email, password: '', role: user.role, locationId: user.locationId || '' });
  };

  const deactivate = async (id) => {
    if (!window.confirm('Deactivate this user?')) return;
    try {
      await api.delete(`/users/${id}`);
      toast.success('User deactivated');
      load();
    } catch { toast.error('Failed'); }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        subtitle="Manage staff, S&TA, and admin accounts"
        actions={
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2 text-sm">
            <PlusIcon className="h-4 w-4" /> Add User
          </button>
        }
      />

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin h-6 w-6 border-4 border-blue-600 border-t-transparent rounded-full" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Name', 'Email', 'Role', 'Location', 'Status', 'Created', 'Actions'].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} className={`hover:bg-gray-50 ${!u.isActive ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 font-medium">{u.name}</td>
                  <td className="px-4 py-3 text-gray-500">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[u.role]}`}>
                      {u.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{u.location?.name || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {u.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(u.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(u)} className="text-blue-600 hover:underline text-xs flex items-center gap-1">
                        <PencilIcon className="h-3 w-3" /> Edit
                      </button>
                      {u.isActive && (
                        <>
                          <span className="text-gray-300">|</span>
                          <button onClick={() => deactivate(u.id)} className="text-red-500 hover:underline text-xs">Deactivate</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Create User" size="md">
        <UserForm
          form={form} setForm={setForm} locations={locations}
          onSubmit={handleCreate} onCancel={() => setShowForm(false)} isEdit={false}
        />
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit User" size="md">
        <UserForm
          form={form} setForm={setForm} locations={locations}
          onSubmit={handleUpdate} onCancel={() => setEditing(null)} isEdit={true}
        />
      </Modal>
    </div>
  );
}
