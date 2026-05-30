import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import {
  formatDateTime, calculateRisk,
  LIKELIHOODS, CONSEQUENCES,
  LIFECYCLE_STAGES, STAGE_LABELS, ADVANCE_LABELS, LIFECYCLE_COLORS,
  STAGE_REG_REFS, REG_REF_SUMMARIES,
  CONTRIBUTING_FACTORS_OPTIONS, CONTROL_TYPES, VERIFICATION_STATUSES,
} from '../utils/helpers';
import {
  CheckCircleIcon, ExclamationTriangleIcon, InformationCircleIcon,
  PaperAirplaneIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

// ── Risk badge ──────────────────────────────────────────────────────────────
const RISK_CELL_COLORS = {
  Critical: 'bg-red-500 text-white',
  High:     'bg-orange-400 text-white',
  Medium:   'bg-yellow-400 text-gray-900',
  Low:      'bg-green-500 text-white',
};

// ── Reg-ref tags with tooltip ─────────────────────────────────────────────────
function RegRefTags({ refs = [] }) {
  const [tip, setTip] = useState(null);
  return (
    <div className="flex flex-wrap gap-1.5 mt-3">
      {refs.map((r) => (
        <div key={r} className="relative">
          <button
            className="px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
            onClick={() => setTip(tip === r ? null : r)}
          >
            {r}
          </button>
          {tip === r && REG_REF_SUMMARIES[r] && (
            <div className="absolute z-10 bottom-full mb-1 left-0 w-64 bg-gray-900 text-white text-xs rounded p-2 shadow-lg">
              <strong>{r}:</strong> {REG_REF_SUMMARIES[r]}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Lifecycle stepper ─────────────────────────────────────────────────────────
function LifecycleStepper({ status }) {
  const currentIdx = LIFECYCLE_STAGES.indexOf(status);
  return (
    <div className="flex items-start justify-between px-2 pb-2">
      {LIFECYCLE_STAGES.map((stage, i) => {
        const done    = i < currentIdx;
        const current = i === currentIdx;
        return (
          <React.Fragment key={stage}>
            {i > 0 && (
              <div className={`flex-1 h-0.5 mt-4 mx-1 ${done || current ? 'bg-blue-500' : 'bg-gray-200'}`} />
            )}
            <div className="flex flex-col items-center flex-shrink-0 w-14">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors
                ${done    ? 'bg-blue-500 border-blue-500 text-white' : ''}
                ${current ? 'bg-white border-blue-500 text-blue-700' : ''}
                ${!done && !current ? 'bg-white border-gray-300 text-gray-400' : ''}`}
              >
                {done ? '✓' : i + 1}
              </div>
              <span className={`text-center leading-tight mt-1 text-xs
                ${current ? 'text-blue-700 font-semibold' : done ? 'text-gray-600' : 'text-gray-400'}`}
                style={{ fontSize: '0.65rem', maxWidth: 52 }}
              >
                {STAGE_LABELS[stage]}
              </span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Risk matrix picker ────────────────────────────────────────────────────────
function RiskMatrix({ likelihood, consequence, onSelect, readOnly, label }) {
  const rating = calculateRisk(likelihood, consequence);
  return (
    <div>
      <p className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">{label}</p>
      <div className="overflow-x-auto">
        <table className="text-xs border-collapse w-full">
          <thead>
            <tr>
              <th className="p-1 bg-gray-100 text-left font-normal text-gray-500 whitespace-nowrap">L \ C</th>
              {CONSEQUENCES.map((c) => (
                <th key={c} className="p-1 bg-gray-100 text-center font-normal text-gray-600 w-16">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {LIKELIHOODS.map((l) => (
              <tr key={l}>
                <td className="p-1 bg-gray-50 font-medium text-gray-600 whitespace-nowrap pr-2">{l}</td>
                {CONSEQUENCES.map((c) => {
                  const r = calculateRisk(l, c);
                  const selected = l === likelihood && c === consequence;
                  return (
                    <td
                      key={c}
                      onClick={() => !readOnly && onSelect && onSelect(l, c)}
                      className={`p-1 text-center border border-white transition-all
                        ${RISK_CELL_COLORS[r] || 'bg-gray-200'}
                        ${selected ? 'ring-2 ring-gray-900 ring-inset font-bold scale-105 z-10 relative' : ''}
                        ${!readOnly ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                      title={`${l} × ${c} = ${r}`}
                    >
                      {selected ? r[0] + '●' : r[0]}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {likelihood && consequence && (
        <div className="mt-2 flex items-center gap-2">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${RISK_CELL_COLORS[rating] || ''}`}>
            {rating || '—'}
          </span>
          <span className="text-xs text-gray-500">{likelihood} × {consequence}</span>
        </div>
      )}
      {!likelihood && !readOnly && (
        <p className="text-xs text-gray-400 mt-1 italic">Click a cell to select likelihood × consequence</p>
      )}
    </div>
  );
}

// ── Action status badge ───────────────────────────────────────────────────────
function ActionStatusBadge({ dueDate, completedAt }) {
  if (completedAt) return <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700 font-medium">Complete</span>;
  if (dueDate && new Date(dueDate) < new Date()) return <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 font-medium">Overdue</span>;
  if (dueDate) return <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-700 font-medium">In Progress</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600 font-medium">Pending</span>;
}

// ── Tab 1: Report ─────────────────────────────────────────────────────────────
function ReportTab({ report }) {
  const SEVERITY_COLORS = { Low: 'bg-green-100 text-green-700', Medium: 'bg-yellow-100 text-yellow-700', High: 'bg-orange-100 text-orange-700', Critical: 'bg-red-100 text-red-700' };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div><span className="label">Location</span><p>{report.location?.name}</p></div>
        <div><span className="label">Submitted</span><p>{formatDateTime(report.createdAt)}</p></div>
        <div><span className="label">Type</span><p>{report.type?.replace(/_/g, ' ')}</p></div>
        <div><span className="label">Severity</span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${SEVERITY_COLORS[report.severity] || ''}`}>{report.severity}</span>
        </div>
        <div><span className="label">Reporter</span><p>{report.isAnonymous ? '🔒 Anonymous' : (report.reporterName || 'Not provided')}</p></div>
        <div><span className="label">Days Open</span>
          <p className="font-semibold">{Math.floor((Date.now() - new Date(report.createdAt)) / 86400000)} days</p>
        </div>
      </div>
      <div><span className="label">Description</span>
        <p className="mt-1 text-sm text-gray-700 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">{report.description}</p>
      </div>
      {report.photoUrl && (
        <div><span className="label">Photo</span>
          <img src={`http://localhost:4000${report.photoUrl}`} alt="Hazard" className="mt-1 rounded-lg max-h-48 object-cover" />
        </div>
      )}
      <RegRefTags refs={STAGE_REG_REFS.report} />
    </div>
  );
}

// ── Tab 2: Investigation ──────────────────────────────────────────────────────
function InvestigationTab({ report, users, onSave, canEdit }) {
  const [form, setForm] = useState({
    rootCauseAnalysis: report.rootCauseAnalysis || '',
    contributingFactors: Array.isArray(report.contributingFactors) ? report.contributingFactors : [],
    investigatedById: report.investigatedById || '',
    investigationCompletedAt: typeof report.investigationCompletedAt === 'string' ? report.investigationCompletedAt.slice(0, 10) : '',
  });
  const [saving, setSaving] = useState(false);

  const toggleFactor = (f) => setForm((prev) => ({
    ...prev,
    contributingFactors: prev.contributingFactors.includes(f)
      ? prev.contributingFactors.filter((x) => x !== f)
      : [...prev.contributingFactors, f],
  }));

  const save = async () => {
    setSaving(true);
    try { await onSave(form); toast.success('Investigation saved'); }
    catch { toast.error('Save failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="label">Root Cause Analysis <span className="text-red-500">*</span></label>
        <p className="text-xs text-gray-400 mb-1">Required to advance to Risk Assessment stage. Document the fundamental cause(s) of this hazard.</p>
        <textarea
          value={form.rootCauseAnalysis}
          onChange={(e) => setForm({ ...form, rootCauseAnalysis: e.target.value })}
          rows={5} className="input resize-none" disabled={!canEdit}
          placeholder="Describe the root cause(s) identified during investigation..."
        />
      </div>
      <div>
        <label className="label">Contributing Factors</label>
        <div className="flex flex-wrap gap-2 mt-1">
          {CONTRIBUTING_FACTORS_OPTIONS.map((f) => (
            <button
              key={f} type="button" disabled={!canEdit}
              onClick={() => toggleFactor(f)}
              className={`px-3 py-1 rounded-full text-sm border transition-colors
                ${form.contributingFactors.includes(f)
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Investigated By</label>
          <select value={form.investigatedById} onChange={(e) => setForm({ ...form, investigatedById: e.target.value })} className="input" disabled={!canEdit}>
            <option value="">— Select —</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
          </select>
        </div>
        <div>
          <label className="label">Investigation Completed</label>
          <input type="date" value={form.investigationCompletedAt} onChange={(e) => setForm({ ...form, investigationCompletedAt: e.target.value })} className="input" disabled={!canEdit} />
        </div>
      </div>
      {canEdit && <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save Investigation'}</button>}
      <RegRefTags refs={STAGE_REG_REFS.investigation} />
    </div>
  );
}

// ── Tab 3: Risk Assessment ────────────────────────────────────────────────────
function RiskTab({ report, onSave, canEdit }) {
  const [form, setForm] = useState({
    initialLikelihood:  report.initialLikelihood  || '',
    initialConsequence: report.initialConsequence || '',
    residualLikelihood:  report.residualLikelihood  || '',
    residualConsequence: report.residualConsequence || '',
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try { await onSave(form); toast.success('Risk assessment saved'); }
    catch { toast.error('Save failed'); }
    finally { setSaving(false); }
  };

  const initRating     = calculateRisk(form.initialLikelihood,  form.initialConsequence);
  const residualRating = calculateRisk(form.residualLikelihood, form.residualConsequence);

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
        <strong>ALARP Principle:</strong> Residual risk must be As Low As Reasonably Practicable. Both initial and post-control risk levels must be documented.
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-4 border border-gray-200 rounded-lg">
          <RiskMatrix
            label="Initial Risk (before controls)"
            likelihood={form.initialLikelihood}
            consequence={form.initialConsequence}
            onSelect={canEdit ? (l, c) => setForm({ ...form, initialLikelihood: l, initialConsequence: c }) : null}
            readOnly={!canEdit}
          />
          {initRating && (
            <div className="mt-3 text-center">
              <span className="text-xs text-gray-500">Initial Rating: </span>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${RISK_CELL_COLORS[initRating] || ''}`}>{initRating}</span>
            </div>
          )}
        </div>
        <div className="p-4 border border-gray-200 rounded-lg">
          <RiskMatrix
            label="Residual Risk (after controls)"
            likelihood={form.residualLikelihood}
            consequence={form.residualConsequence}
            onSelect={canEdit ? (l, c) => setForm({ ...form, residualLikelihood: l, residualConsequence: c }) : null}
            readOnly={!canEdit}
          />
          {residualRating && (
            <div className="mt-3 text-center">
              <span className="text-xs text-gray-500">Residual Rating: </span>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${RISK_CELL_COLORS[residualRating] || ''}`}>{residualRating}</span>
            </div>
          )}
        </div>
      </div>
      {initRating && residualRating && (
        <div className={`rounded-lg p-3 text-sm text-center font-medium
          ${['High','Critical'].includes(initRating) && ['Low','Medium'].includes(residualRating)
            ? 'bg-green-50 text-green-800 border border-green-200'
            : residualRating === initRating
            ? 'bg-yellow-50 text-yellow-800 border border-yellow-200'
            : 'bg-gray-50 text-gray-700 border border-gray-200'}`}
        >
          Risk reduced from <strong>{initRating}</strong> → <strong>{residualRating}</strong>
          {['High','Critical'].includes(initRating) && ['Low','Medium'].includes(residualRating) && ' ✓ ALARP achieved'}
        </div>
      )}
      {canEdit && <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save Risk Assessment'}</button>}
      <RegRefTags refs={STAGE_REG_REFS.risk} />
    </div>
  );
}

// ── Tab 4: Controls & Actions ─────────────────────────────────────────────────
function ControlsTab({ report, users, onSave, canEdit }) {
  const [form, setForm] = useState({
    controlType:       report.controlType       || '',
    controlMeasures:   report.controlMeasures   || '',
    sopUpdated:        report.sopUpdated        || false,
    trainingUpdated:   report.trainingUpdated   || false,
    equipmentUpgraded: report.equipmentUpgraded || false,
    actionAssignedToId: report.actionAssignedToId || '',
    actionDueDate:      typeof report.actionDueDate === 'string' ? report.actionDueDate.slice(0, 10) : '',
    actionCompletedAt:  typeof report.actionCompletedAt === 'string' ? report.actionCompletedAt.slice(0, 10) : '',
    actionNotes:        report.actionNotes || '',
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try { await onSave(form); toast.success('Controls saved'); }
    catch { toast.error('Save failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="label">Control Type <span className="text-red-500">*</span></label>
          <select value={form.controlType} onChange={(e) => setForm({ ...form, controlType: e.target.value })} className="input" disabled={!canEdit}>
            <option value="">— Select control type —</option>
            {CONTROL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          {form.controlType && (
            <p className="text-xs text-gray-400 mt-1">
              {{
                'Eliminate': 'Remove the hazard entirely — the highest hierarchy of control.',
                'Substitute': 'Replace with a less hazardous alternative.',
                'Engineering Control': 'Physical safeguards that reduce exposure.',
                'Administrative Control': 'Procedures, checklists, policies, and work rules.',
                'PPE': 'Personal Protective Equipment — the last line of defense.',
              }[form.controlType]}
            </p>
          )}
        </div>
        <div className="col-span-2">
          <label className="label">Control Measures Description <span className="text-red-500">*</span></label>
          <textarea
            value={form.controlMeasures}
            onChange={(e) => setForm({ ...form, controlMeasures: e.target.value })}
            rows={4} className="input resize-none" disabled={!canEdit}
            placeholder="Describe all operational changes, procedural updates, or physical modifications implemented..."
          />
        </div>
      </div>
      <div>
        <label className="label">System Changes</label>
        <div className="flex flex-wrap gap-4 mt-1">
          {[['sopUpdated','SOP Updated'],['trainingUpdated','Training Updated'],['equipmentUpgraded','Equipment Upgraded']].map(([key, lbl]) => (
            <label key={key} className={`flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border transition-colors ${form[key] ? 'bg-blue-50 border-blue-300' : 'border-gray-200'}`}>
              <input type="checkbox" checked={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.checked })} disabled={!canEdit} className="h-4 w-4 text-blue-600 rounded" />
              <span className="text-sm font-medium">{lbl}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Assigned To</label>
          <select value={form.actionAssignedToId} onChange={(e) => setForm({ ...form, actionAssignedToId: e.target.value })} className="input" disabled={!canEdit}>
            <option value="">Unassigned</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
          </select>
        </div>
        <div>
          <label className="label">Action Due Date</label>
          <input type="date" value={form.actionDueDate} onChange={(e) => setForm({ ...form, actionDueDate: e.target.value })} className="input" disabled={!canEdit} />
        </div>
        <div>
          <label className="label">Completion Date</label>
          <input type="date" value={form.actionCompletedAt} onChange={(e) => setForm({ ...form, actionCompletedAt: e.target.value })} className="input" disabled={!canEdit} />
        </div>
        <div className="flex items-end">
          <ActionStatusBadge dueDate={form.actionDueDate} completedAt={form.actionCompletedAt} />
        </div>
        <div className="col-span-2">
          <label className="label">Action Notes</label>
          <textarea value={form.actionNotes} onChange={(e) => setForm({ ...form, actionNotes: e.target.value })} rows={2} className="input resize-none" disabled={!canEdit} />
        </div>
      </div>
      {canEdit && <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save Controls'}</button>}
      <RegRefTags refs={STAGE_REG_REFS.controls} />
    </div>
  );
}

// ── Tab 5: Verification ───────────────────────────────────────────────────────
function VerificationTab({ report, users, onSave, canEdit }) {
  const [form, setForm] = useState({
    verificationStatus:      report.verificationStatus      || 'Pending',
    verificationNotes:       report.verificationNotes       || '',
    verificationCompletedAt: typeof report.verificationCompletedAt === 'string' ? report.verificationCompletedAt.slice(0, 10) : '',
    verifiedById:            report.verifiedById            || '',
    newHazardsIntroduced:    report.newHazardsIntroduced    || false,
    newHazardDescription:    report.newHazardDescription    || '',
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try { await onSave(form); toast.success('Verification saved'); }
    catch { toast.error('Save failed'); }
    finally { setSaving(false); }
  };

  const STATUS_COLORS = { Pending: 'bg-gray-100 text-gray-700', In_Review: 'bg-blue-100 text-blue-700', Verified: 'bg-green-100 text-green-700', Failed: 'bg-red-100 text-red-700' };

  return (
    <div className="space-y-4">
      {form.verificationStatus === 'Failed' && (
        <div className="bg-red-50 border border-red-300 rounded-lg p-4 flex items-start gap-3">
          <ExclamationTriangleIcon className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-800">Mitigation Has Failed Verification</p>
            <p className="text-sm text-red-700 mt-0.5">Immediate corrective action is required. FAA §5.93 requires documented follow-up.</p>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Verification Status</label>
          <select value={form.verificationStatus} onChange={(e) => setForm({ ...form, verificationStatus: e.target.value })} className="input" disabled={!canEdit}>
            {VERIFICATION_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
          <div className="mt-1">
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[form.verificationStatus] || ''}`}>
              {form.verificationStatus.replace(/_/g, ' ')}
            </span>
          </div>
        </div>
        <div>
          <label className="label">Verified By</label>
          <select value={form.verifiedById} onChange={(e) => setForm({ ...form, verifiedById: e.target.value })} className="input" disabled={!canEdit}>
            <option value="">— Select —</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
          </select>
        </div>
        <div>
          <label className="label">Verification Date</label>
          <input type="date" value={form.verificationCompletedAt} onChange={(e) => setForm({ ...form, verificationCompletedAt: e.target.value })} className="input" disabled={!canEdit} />
        </div>
        <div className="col-span-2">
          <label className="label">Verification Notes</label>
          <textarea value={form.verificationNotes} onChange={(e) => setForm({ ...form, verificationNotes: e.target.value })}
            rows={3} className="input resize-none" disabled={!canEdit}
            placeholder="Did the mitigation effectively reduce the risk? Were there any unexpected outcomes?" />
        </div>
      </div>
      <div className={`p-3 rounded-lg border transition-colors ${form.newHazardsIntroduced ? 'bg-orange-50 border-orange-300' : 'border-gray-200'}`}>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={form.newHazardsIntroduced} onChange={(e) => setForm({ ...form, newHazardsIntroduced: e.target.checked })} disabled={!canEdit} className="h-4 w-4 text-orange-600 rounded" />
          <span className="text-sm font-medium text-gray-700">New hazards introduced by mitigation measures</span>
        </label>
        {form.newHazardsIntroduced && (
          <div className="mt-3">
            <label className="label">Describe New Hazards</label>
            <textarea value={form.newHazardDescription} onChange={(e) => setForm({ ...form, newHazardDescription: e.target.value })}
              rows={2} className="input resize-none mt-1" disabled={!canEdit}
              placeholder="Describe any new hazards created by the mitigation — a new hazard report should be filed." />
            <p className="text-xs text-orange-600 mt-1">⚠ File a new hazard report to track the introduced hazard through its own SRM lifecycle.</p>
          </div>
        )}
      </div>
      {canEdit && <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save Verification'}</button>}
      <RegRefTags refs={STAGE_REG_REFS.verification} />
    </div>
  );
}

// ── Tab 6: Reporter Feedback ───────────────────────────────────────────────────
function FeedbackTab({ report, onNotify }) {
  const [showCompose, setShowCompose] = useState(false);
  const [subject, setSubject] = useState(`Safety Report Update — ${report.type?.replace(/_/g, ' ')} at ${report.location?.name}`);
  const [message, setMessage] = useState(
    `Dear Reporter,\n\nWe are following up on the hazard report you submitted at ${report.location?.name}.\n\n` +
    `Current status: ${report.status?.replace(/_/g, ' ')}\n\n` +
    (report.controlMeasures ? `Controls applied: ${report.controlMeasures}\n\n` : '') +
    `Thank you for contributing to our safety culture.\n\nGoJump America Safety Team`
  );
  const [sending, setSending] = useState(false);

  const sendNotification = async () => {
    setSending(true);
    try {
      await onNotify({ subject, message });
      toast.success('Notification sent');
      setShowCompose(false);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Send failed');
    } finally {
      setSending(false);
    }
  };

  const log = Array.isArray(report.notificationLog) ? report.notificationLog : [];

  return (
    <div className="space-y-4">
      {/* Reporter info */}
      <div className="p-4 bg-gray-50 rounded-lg">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="label">Reporter Name</span><p>{report.isAnonymous ? '🔒 Anonymous' : (report.reporterName || 'Not provided')}</p></div>
          <div><span className="label">Reporter Email</span>
            <p>{report.isAnonymous ? '— Anonymous' : (report.reporterEmail || 'Not provided')}</p>
          </div>
        </div>
      </div>

      {!report.reporterEmail && !report.isAnonymous && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800 flex items-start gap-2">
          <InformationCircleIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
          Reporter did not provide an email. Consider posting a status update at the {report.location?.name} notice board.
        </div>
      )}
      {report.isAnonymous && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800 flex items-start gap-2">
          <InformationCircleIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
          Reporter submitted anonymously — no direct notification possible. Consider posting a status update at the <strong>{report.location?.name}</strong> notice board to close the feedback loop.
        </div>
      )}

      {/* Notification history */}
      <div>
        <h5 className="font-semibold text-gray-800 mb-2 text-sm">Notification History</h5>
        {log.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No notifications sent yet.</p>
        ) : (
          <div className="space-y-2">
            {log.map((entry, i) => (
              <div key={i} className="flex gap-3 text-sm">
                <div className="flex flex-col items-center">
                  <div className="h-2.5 w-2.5 rounded-full bg-blue-400 mt-1 flex-shrink-0" />
                  {i < log.length - 1 && <div className="w-0.5 bg-gray-200 flex-1 mt-1" />}
                </div>
                <div className="pb-2">
                  <p className="font-medium text-gray-800">{entry.subject}</p>
                  <p className="text-xs text-gray-400">{formatDateTime(entry.timestamp)} · sent by {entry.sentBy}</p>
                  <p className="text-xs text-gray-600 mt-0.5 bg-gray-50 rounded p-1 whitespace-pre-wrap line-clamp-3">{entry.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Compose */}
      {report.reporterEmail && !report.isAnonymous && (
        <div>
          {!showCompose ? (
            <button onClick={() => setShowCompose(true)} className="btn-secondary flex items-center gap-2 text-sm">
              <PaperAirplaneIcon className="h-4 w-4" /> Send Status Update to Reporter
            </button>
          ) : (
            <div className="border border-gray-200 rounded-lg p-4 space-y-3">
              <h5 className="font-semibold text-gray-800 text-sm">Compose Notification</h5>
              <div>
                <label className="label">Subject</label>
                <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} className="input" />
              </div>
              <div>
                <label className="label">Message</label>
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={8} className="input resize-none font-mono text-xs" />
              </div>
              <div className="flex gap-2">
                <button onClick={sendNotification} disabled={sending} className="btn-primary flex items-center gap-2 text-sm">
                  <PaperAirplaneIcon className="h-4 w-4" /> {sending ? 'Sending…' : 'Send'}
                </button>
                <button onClick={() => setShowCompose(false)} className="btn-secondary text-sm">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      <RegRefTags refs={STAGE_REG_REFS.feedback} />
    </div>
  );
}

// ── Main HazardDetail component ───────────────────────────────────────────────
const TABS = ['Report', 'Investigation', 'Risk Assessment', 'Controls & Actions', 'Verification', 'Reporter Feedback'];

export default function HazardDetail({ reportId, onClose }) {
  const { isSTA, isAdmin } = useAuth();
  const canEdit = isSTA || isAdmin;

  const [report, setReport] = useState(null);
  const [users, setUsers]   = useState([]);
  const [tab, setTab]       = useState(0);
  const [advancing, setAdvancing]   = useState(false);
  const [advanceNote, setAdvanceNote] = useState('');
  const [showAdvance, setShowAdvance] = useState(false);

  const load = useCallback(async () => {
    const [rRes, uRes] = await Promise.all([
      api.get(`/hazard-reports/${reportId}`),
      api.get('/users'),
    ]);
    setReport(rRes.data);
    setUsers(uRes.data);
  }, [reportId]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (data) => {
    await api.put(`/hazard-reports/${reportId}`, data);
    await load();
  };

  const handleAdvance = async () => {
    setAdvancing(true);
    try {
      await api.put(`/hazard-reports/${reportId}/advance`, { note: advanceNote });
      setAdvanceNote('');
      setShowAdvance(false);
      await load();
      toast.success(`Advanced to ${STAGE_LABELS[LIFECYCLE_STAGES[LIFECYCLE_STAGES.indexOf(report.status) + 1]]}`);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Cannot advance stage');
    } finally {
      setAdvancing(false);
    }
  };

  const handleNotify = async (data) => {
    await api.post(`/hazard-reports/${reportId}/notify`, data);
    await load();
  };

  if (!report) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
    </div>
  );

  const isClosed   = report.status === 'Closed';
  const nextLabel  = !isClosed ? ADVANCE_LABELS[report.status] : null;

  return (
    <div className="flex flex-col h-full">
      {/* Stage stepper */}
      <div className="bg-gray-50 border-b border-gray-200 px-4 pt-4 pb-2">
        <LifecycleStepper status={report.status} />
      </div>

      {/* Advance banner */}
      {canEdit && !isClosed && (
        <div className="px-6 py-3 border-b border-gray-200 bg-white flex items-center justify-between gap-4">
          {!showAdvance ? (
            <>
              <div className="text-sm text-gray-500">
                Current: <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${LIFECYCLE_COLORS[report.status] || ''}`}>{STAGE_LABELS[report.status]}</span>
              </div>
              <button onClick={() => setShowAdvance(true)} className="btn-primary text-sm flex items-center gap-2">
                {nextLabel} →
              </button>
            </>
          ) : (
            <div className="flex-1 flex items-center gap-3">
              <input
                type="text"
                value={advanceNote}
                onChange={(e) => setAdvanceNote(e.target.value)}
                placeholder={`Optional note for "${nextLabel}" stage transition...`}
                className="input flex-1 text-sm"
              />
              <button onClick={handleAdvance} disabled={advancing} className="btn-primary text-sm whitespace-nowrap">
                {advancing ? 'Advancing…' : `Confirm: ${nextLabel}`}
              </button>
              <button onClick={() => setShowAdvance(false)} className="btn-secondary text-sm">Cancel</button>
            </div>
          )}
        </div>
      )}
      {isClosed && (
        <div className="px-6 py-3 border-b border-gray-200 bg-green-50 flex items-center gap-2">
          <CheckCircleIcon className="h-5 w-5 text-green-500" />
          <span className="text-sm font-medium text-green-800">Report Closed — full SRM lifecycle completed</span>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex border-b border-gray-200 bg-white flex-shrink-0 overflow-x-auto">
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => setTab(i)}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors
              ${tab === i ? 'border-blue-500 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-6">
        {tab === 0 && <ReportTab report={report} />}
        {tab === 1 && <InvestigationTab report={report} users={users} onSave={handleSave} canEdit={canEdit} />}
        {tab === 2 && <RiskTab report={report} onSave={handleSave} canEdit={canEdit} />}
        {tab === 3 && <ControlsTab report={report} users={users} onSave={handleSave} canEdit={canEdit} />}
        {tab === 4 && <VerificationTab report={report} users={users} onSave={handleSave} canEdit={canEdit} />}
        {tab === 5 && <FeedbackTab report={report} onNotify={handleNotify} />}
      </div>
    </div>
  );
}
