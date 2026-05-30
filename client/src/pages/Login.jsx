import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldCheckIcon } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-white shadow-xl mb-4">
            <ShieldCheckIcon className="h-9 w-9 text-blue-700" />
          </div>
          <h1 className="text-3xl font-bold text-white">GoJump America</h1>
          <p className="text-blue-200 mt-1">Safety Management System</p>
          <p className="text-blue-300 text-xs mt-0.5">FAA 14 CFR Part 5 Compliant</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Sign in to your account</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email address</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="input"
                placeholder="you@gojumpamerica.com"
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="input"
                placeholder="••••••••"
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center flex items-center gap-2 py-2.5">
              {loading ? (
                <><span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> Signing in...</>
              ) : 'Sign in'}
            </button>
          </form>

          {/* Quick fill for demo */}
          <div className="mt-6 pt-6 border-t border-gray-100">
            <p className="text-xs text-gray-500 font-medium mb-2">Demo credentials (password: GoJump2024!):</p>
            <div className="space-y-1">
              {[
                { label: 'Admin', email: 'admin@gojumpamerica.com' },
                { label: 'S&TA (Oceanside)', email: 'sta.oceanside@gojump.com' },
                { label: 'Staff (Hawaii)', email: 'staff.hawaii@gojump.com' },
              ].map(({ label, email }) => (
                <button
                  key={email}
                  type="button"
                  onClick={() => setForm({ email, password: 'GoJump2024!' })}
                  className="block w-full text-left text-xs text-blue-600 hover:text-blue-800 hover:underline py-0.5"
                >
                  {label}: {email}
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-blue-300 text-xs mt-6">
          Report a hazard anonymously via the QR code at your dropzone
        </p>
      </div>
    </div>
  );
}
