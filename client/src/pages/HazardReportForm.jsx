import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShieldCheckIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import api from '../utils/api';
import { HAZARD_TYPES, SEVERITIES } from '../utils/helpers';
import toast from 'react-hot-toast';

export default function HazardReportForm() {
  const [params] = useSearchParams();
  const locationSlug = params.get('location');

  const [location, setLocation] = useState(null);
  const [locError, setLocError] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [photo, setPhoto] = useState(null);

  const [form, setForm] = useState({
    reporterName: '',
    isAnonymous: false,
    type: '',
    description: '',
    severity: '',
    observedAt: new Date().toISOString().slice(0, 16),
  });

  useEffect(() => {
    if (!locationSlug) { setLocError(true); return; }
    api.get(`/locations/slug/${locationSlug}`)
      .then((r) => setLocation(r.data))
      .catch(() => setLocError(true));
  }, [locationSlug]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.type || !form.description || !form.severity) {
      toast.error('Please fill in all required fields');
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('locationId', location.id);
      fd.append('type', form.type);
      fd.append('description', form.description);
      fd.append('severity', form.severity);
      fd.append('isAnonymous', form.isAnonymous);
      fd.append('confidentialReport', form.confidentialReport || false);
      if (!form.isAnonymous && form.reporterName) fd.append('reporterName', form.reporterName);
      if (photo) fd.append('photo', photo);

      await api.post('/hazard-reports', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setSubmitted(true);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Submission failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (locError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <ExclamationTriangleIcon className="h-16 w-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Location Not Found</h2>
          <p className="text-gray-500">Please scan the QR code posted at your dropzone location to submit a report.</p>
        </div>
      </div>
    );
  }

  if (!location) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Report Submitted</h2>
          <p className="text-gray-600 mb-4">
            Thank you for your report. Your submission has been received and will be reviewed by the Safety & Training Advisor.
          </p>
          <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-800 text-left mb-6">
            <p className="font-semibold mb-1">Just Culture Policy</p>
            <p>No disciplinary action will result from this good-faith report. GoJump America is committed to a safe reporting environment for all personnel.</p>
          </div>
          <button onClick={() => { setSubmitted(false); setForm({ reporterName: '', isAnonymous: false, type: '', description: '', severity: '', observedAt: new Date().toISOString().slice(0, 16) }); setPhoto(null); }} className="btn-primary">
            Submit Another Report
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-white shadow-lg mb-3">
            <ShieldCheckIcon className="h-8 w-8 text-blue-700" />
          </div>
          <h1 className="text-2xl font-bold text-white">Hazard & Incident Report</h1>
          <p className="text-blue-200">{location.name}</p>
        </div>

        {/* Just Culture banner */}
        <div className="bg-blue-800/60 border border-blue-600 rounded-xl p-4 mb-6 text-blue-100 text-sm">
          <strong className="block mb-1">Just Culture Policy</strong>
          Reporting is protected under GoJump America's Just Culture policy. No disciplinary action will result from good-faith reporting. Anonymous submission is available.
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Anonymous toggle */}
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              <input
                type="checkbox"
                id="anonymous"
                checked={form.isAnonymous}
                onChange={(e) => setForm({ ...form, isAnonymous: e.target.checked, reporterName: e.target.checked ? '' : form.reporterName })}
                className="h-4 w-4 text-blue-600 rounded"
              />
              <label htmlFor="anonymous" className="text-sm font-medium text-gray-700">
                Submit anonymously — your identity will not be recorded
              </label>
            </div>

            {/* Confidential report — §5.71(a)(7) */}
            <div className="flex items-start gap-3 p-3 rounded-lg border border-blue-200 bg-blue-50">
              <input
                type="checkbox"
                id="confidential"
                checked={form.confidentialReport || false}
                onChange={(e) => setForm({ ...form, confidentialReport: e.target.checked })}
                className="h-4 w-4 text-blue-600 rounded mt-0.5"
              />
              <div>
                <label htmlFor="confidential" className="text-sm font-medium text-blue-800 cursor-pointer">
                  🔒 Mark as Confidential
                </label>
                <p className="text-xs text-blue-600 mt-0.5">
                  Confidential reports are seen only by the Safety &amp; Training Advisor. Staff will see only a de-identified summary. Your original description is protected. (§5.71(a)(7))
                </p>
              </div>
            </div>

            {/* Reporter name */}
            {!form.isAnonymous && (
              <div>
                <label className="label">Your Name <span className="text-gray-400 font-normal">(optional)</span></label>
                <input
                  type="text"
                  value={form.reporterName}
                  onChange={(e) => setForm({ ...form, reporterName: e.target.value })}
                  className="input"
                  placeholder="Full name"
                />
              </div>
            )}

            {/* Date/time */}
            <div>
              <label className="label">Date & Time of Observation <span className="text-red-500">*</span></label>
              <input
                type="datetime-local"
                value={form.observedAt}
                onChange={(e) => setForm({ ...form, observedAt: e.target.value })}
                className="input"
                required
              />
            </div>

            {/* Hazard type */}
            <div>
              <label className="label">Hazard Type <span className="text-red-500">*</span></label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="input"
                required
              >
                <option value="">— Select type —</option>
                {HAZARD_TYPES.map((t) => (
                  <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="label">Description <span className="text-red-500">*</span></label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={4}
                className="input resize-none"
                placeholder="Describe what you observed. Include location on the DZ, aircraft tail number (if applicable), and any contributing factors."
                required
              />
            </div>

            {/* Severity */}
            <div>
              <label className="label">Severity Estimate <span className="text-red-500">*</span></label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {SEVERITIES.map((s) => {
                  const colors = {
                    Low: 'border-green-300 bg-green-50 text-green-800 hover:bg-green-100',
                    Medium: 'border-yellow-300 bg-yellow-50 text-yellow-800 hover:bg-yellow-100',
                    High: 'border-orange-300 bg-orange-50 text-orange-800 hover:bg-orange-100',
                    Critical: 'border-red-300 bg-red-50 text-red-800 hover:bg-red-100',
                  };
                  const selected = {
                    Low: 'border-green-500 bg-green-100 ring-2 ring-green-500',
                    Medium: 'border-yellow-500 bg-yellow-100 ring-2 ring-yellow-500',
                    High: 'border-orange-500 bg-orange-100 ring-2 ring-orange-500',
                    Critical: 'border-red-500 bg-red-100 ring-2 ring-red-500',
                  };
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setForm({ ...form, severity: s })}
                      className={`py-3 rounded-lg border-2 font-medium text-sm transition-all ${form.severity === s ? selected[s] : colors[s]}`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Low = minor concern · Medium = safety impact possible · High = likely safety impact · Critical = immediate danger
              </p>
            </div>

            {/* Photo */}
            <div>
              <label className="label">Photo <span className="text-gray-400 font-normal">(optional)</span></label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setPhoto(e.target.files[0])}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {photo && <p className="text-xs text-gray-500 mt-1">Selected: {photo.name}</p>}
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  Submitting...
                </span>
              ) : 'Submit Hazard Report'}
            </button>
          </form>
        </div>

        <p className="text-center text-blue-300 text-xs mt-4">
          Reports are reviewed by the Safety & Training Advisor within 24 hours.
        </p>
      </div>
    </div>
  );
}
