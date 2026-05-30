import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import {
  formatDate, formatDateTime, calculateRisk,
  LIKELIHOODS, CONSEQUENCES,
  CONTRIBUTING_FACTORS_OPTIONS, CONTROL_TYPES, VERIFICATION_STATUSES,
} from '../utils/helpers';
import {
  CheckCircleIcon, ExclamationTriangleIcon, InformationCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

// ── Incident-specific constants (§5.71 — 7-stage SRM lifecycle) ───────────────
const INC_STAGES = [
  'Submitted', 'Acknowledged', 'Under_Investigation',
  'Risk_Assessed', 'Controls_Applied', 'Verification', 'Closed',
];

const INC_STAGE_LABELS = {
  Submitted:           'Submitted',
  Acknowledged:        'Acknowledged',
  Under_Investigation: 'Investigation',
  Risk_Assessed:       'Risk Assessed',
  Controls_Applied:    'Controls Applied',
  Verification:        'Verification',
  Closed:              'Closed',
};

const INC_ADVANCE_LABELS = {
  Submitted:           'Acknowledge Incident',
  Acknowledged:        'Begin Investigation',
  Under_Investigation: 'Mark Risk Assessed',
  Risk_Assessed:       'Apply Controls',
  Controls_Applied:    'Enter Verification',
  Verification:        'Close Incident',
};

const INC_STAGE_COLORS = {
  Submitted:           'bg-gray-100 text-gray-700',
  Acknowledged:        'bg-blue-100 text-blue-700',
  Under_Investigation: 'bg-yellow-100 text-yellow-800',
  Risk_Assessed:       'bg-orange-100 text-orange-700',
  Controls_Applied:    'bg-indigo-100 text-indigo-700',
  Verification:        'bg-purple-100 text-purple-700',
  Closed:              'bg-green-100 text-green-700',
};

const RISK_CELL_COLORS = {
  Critical: 'bg-red-500 text-white',
  High:     'bg-orange-400 text-white',
  Medium:   'bg-yellow-400 text-gray-900',
  Low:      'bg-green-500 text-white',
};

// ── Lifecycle stepper ─────────────────────────────────────────────────────────
function LifecycleStepper({ status }) {
  const currentIdx = INC_STAGES.indexOf(status);
  return (
    <div className="flex items-start justify-between px-2 pb-2">
      {INC_STAGES.map((stage, i) => {
        const done    = i < currentIdx;
        const current = i === currentIdx;
        return (
          <React.Fragment key={stage}>
            {i > 0 && (
              <div className={`flex-1 h-0.5 mt-4 mx-1 ${done || current ? 'bg-blue-500' : 'bg-gray-200'}`} />
            )}
            <div className="flex flex-col items-center flex-shrink-0 w-16">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors
                ${done    ? 'bg-blue-500 border-blue-500 text-white' : ''}
                ${current ? 'bg-white border-blue-500 text-blue-700' : ''}
                ${!done && !current ? 'bg-white border-gray-300 text-gray-400' : ''}`}
              >
                {done ? '✓' : i + 1}
              </div>
              <span
                className={`text-center leading-tight mt-1
                  ${current ? 'text-blue-700 font-semibold' : done ? 'text-gray-600' : 'text-gray-400'}`}
                style={{ fontSize: '0.63rem', maxWidth: 58 }}
              >
                {INC_STAGE_LABELS[stage]}
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

// ── Tab 1: Overview ───────────────────────────────────────────────────────────
function OverviewTab({ incident, users }) {
  const findUser = (id) => users.find((u) => u.id === id);

  const SEVERITY_COLORS = {
    Low: 'bg-green-100 text-green-700', Medium: 'bg-yellow-100 text-yellow-700',
    High: 'bg-orange-100 text-orange-700', Critical: 'bg-red-100 text-red-700',
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div><span className="label">Location</span><p>{incident.location?.name}</p></div>
        <div><span className="label">Created</span><p>{formatDateTime(incident.createdAt)}</p></div>
        <div><span className="label">Status</span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${INC_STAGE_COLORS[incident.status] || ''}`}>
            {INC_STAGE_LABELS[incident.status]}
          </span>
        </div>
        <div><span className="label">Days Open</span>
          <p className="font-semibold">{Math.floor((Date.now() - new Date(incident.createdAt)) / 86400000)} days</p>
        </div>
        <div><span className="label">Assigned To</span>
          <p>{incident.assignedTo?.name || '— Unassigned'}</p>
        </div>
        {incident.followUpDate && (
          <div><span className="label">Follow-up Date</span>
            <p className={new Date(incident.followUpDate) < new Date() && incident.status !== 'Closed' ? 'text-red-600 font-medium' : ''}>
              {formatDate(incident.followUpDate)}
              {new Date(incident.followUpDate) < new Date() && incident.status !== 'Closed' && ' ⚠ Overdue'}
            </p>
          </div>
        )}
        {incident.closedAt && (
          <div><span className="label">Closed</span><p>{formatDate(incident.closedAt)}</p>
          </div>
        )}
      </div>

      {incident.investigationNotes && (
        <div>
          <span className="label">Investigation Notes</span>
          <p className="mt-1 text-sm text-gray-700 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">{incident.investigationNotes}</p>
        </div>
      )}
      {incident.correctiveAction && (
        <div>
          <span className="label">Corrective Action Summary</span>
          <p className="mt-1 text-sm text-gray-700 bg-blue-50 rounded-lg p-3 whitespace-pre-wrap">{incident.correctiveAction}</p>
        </div>
      )}

      {/* Linked hazard report */}
      {incident.hazardReport && (
        <div className="border border-gray-200 rounded-lg p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Source Hazard Report</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="label">Type</span><p>{incident.hazardReport.type?.replace(/_/g, ' ')}</p></div>
            <div><span className="label">Severity</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${SEVERITY_COLORS[incident.hazardReport.severity] || ''}`}>
                {incident.hazardReport.severity}
              </span>
            </div>
            <div className="col-span-2"><span className="label">Description</span>
              <p className="text-gray-700 mt-0.5">{incident.hazardReport.description}</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
        <strong>Regulatory refs:</strong> FAA 14 CFR Part 5 §5.7, §5.71, §5.73, §5.91, §5.95
      </div>
    </div>
  );
}

// ── Tab 2: Investigation ──────────────────────────────────────────────────────
function InvestigationTab({ incident, users, onSave, canEdit }) {
  const [form, setForm] = useState({
    rootCauseAnalysis:        incident.rootCauseAnalysis        || '',
    contributingFactors:      Array.isArray(incident.contributingFactors) ? incident.contributingFactors : [],
    investigationNotes:       incident.investigationNotes       || '',
    investigatedById:         incident.investigatedById         || '',
    investigationCompletedAt: typeof incident.investigationCompletedAt === 'string' ? incident.investigationCompletedAt.slice(0, 10) : '',
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
        <p className="text-xs text-gray-400 mb-1">Required to advance to Under Investigation stage. Document the fundamental cause(s).</p>
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
      <div>
        <label className="label">Investigation Notes</label>
        <textarea
          value={form.investigationNotes}
          onChange={(e) => setForm({ ...form, investigationNotes: e.target.value })}
          rows={4} className="input resize-none" disabled={!canEdit}
          placeholder="Detailed investigation findings, witness statements, evidence reviewed..."
        />
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
    </div>
  );
}

// ── Tab 3: Risk Assessment ────────────────────────────────────────────────────
function RiskTab({ incident, onSave, canEdit }) {
  const [form, setForm] = useState({
    initialLikelihood:   incident.initialLikelihood   || '',
    initialConsequence:  incident.initialConsequence  || '',
    residualLikelihood:  incident.residualLikelihood  || '',
    residualConsequence: incident.residualConsequence || '',
    alarpJustification:  incident.alarpJustification  || '',
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
        <strong>ALARP Principle:</strong> Residual risk must be As Low As Reasonably Practicable. Both initial and post-control risk levels must be documented per §5.55.
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
      {(residualRating === 'High' || residualRating === 'Critical') && (
        <div>
          <label className="label">ALARP Justification <span className="text-red-500">*</span></label>
          <p className="text-xs text-gray-400 mb-1">Required for High/Critical residual risk per §5.55. Document why further risk reduction is impracticable.</p>
          <textarea
            value={form.alarpJustification}
            onChange={(e) => setForm({ ...form, alarpJustification: e.target.value })}
            rows={3} className="input resize-none" disabled={!canEdit}
            placeholder="Justify that all reasonably practicable measures have been implemented..."
          />
        </div>
      )}
      {canEdit && <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save Risk Assessment'}</button>}
    </div>
  );
}

// ── Tab 4: Controls & Actions ─────────────────────────────────────────────────
function ControlsTab({ incident, users, onSave, canEdit }) {
  const [form, setForm] = useState({
    controlType:        incident.controlType        || '',
    controlMeasures:    incident.controlMeasures    || '',
    correctiveAction:   incident.correctiveAction   || '',
    sopUpdated:         incident.sopUpdated         || false,
    trainingUpdated:    incident.trainingUpdated    || false,
    equipmentUpgraded:  incident.equipmentUpgraded  || false,
    actionAssignedToId: incident.actionAssignedToId || '',
    actionDueDate:      typeof incident.actionDueDate   === 'string' ? incident.actionDueDate.slice(0, 10)   : '',
    actionCompletedAt:  typeof incident.actionCompletedAt === 'string' ? incident.actionCompletedAt.slice(0, 10) : '',
    actionNotes:        incident.actionNotes        || '',
    followUpDate:       typeof incident.followUpDate === 'string' ? incident.followUpDate.slice(0, 10) : '',
    assignedToId:       incident.assignedToId       || '',
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
        </div>
        <div className="col-span-2">
          <label className="label">Control Measures Description <span className="text-red-500">*</span></label>
          <textarea
            value={form.controlMeasures}
            onChange={(e) => setForm({ ...form, controlMeasures: e.target.value })}
            rows={3} className="input resize-none" disabled={!canEdit}
            placeholder="Describe all operational changes, procedural updates, or physical modifications..."
          />
        </div>
        <div className="col-span-2">
          <label className="label">Corrective Action Summary</label>
          <textarea
            value={form.correctiveAction}
            onChange={(e) => setForm({ ...form, correctiveAction: e.target.value })}
            rows={3} className="input resize-none" disabled={!canEdit}
            placeholder="Summary of corrective actions taken to address the root cause..."
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
          <label className="label">Assigned To (overall)</label>
          <select value={form.assignedToId} onChange={(e) => setForm({ ...form, assignedToId: e.target.value })} className="input" disabled={!canEdit}>
            <option value="">Unassigned</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
          </select>
        </div>
        <div>
          <label className="label">Follow-up Date</label>
          <input type="date" value={form.followUpDate} onChange={(e) => setForm({ ...form, followUpDate: e.target.value })} className="input" disabled={!canEdit} />
        </div>
        <div>
          <label className="label">Action Assigned To</label>
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
          <label className="label">Action Completed</label>
          <input type="date" value={form.actionCompletedAt} onChange={(e) => setForm({ ...form, actionCompletedAt: e.target.value })} className="input" disabled={!canEdit} />
        </div>
        <div className="col-span-2">
          <label className="label">Action Notes</label>
          <textarea value={form.actionNotes} onChange={(e) => setForm({ ...form, actionNotes: e.target.value })} rows={2} className="input resize-none" disabled={!canEdit} />
        </div>
      </div>
      {canEdit && <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save Controls'}</button>}
    </div>
  );
}

// ── Tab 5: Verification ───────────────────────────────────────────────────────
function VerificationTab({ incident, users, onSave, canEdit }) {
  const [form, setForm] = useState({
    verificationStatus:      incident.verificationStatus      || 'Pending',
    verificationNotes:       incident.verificationNotes       || '',
    verificationCompletedAt: typeof incident.verificationCompletedAt === 'string' ? incident.verificationCompletedAt.slice(0, 10) : '',
    verifiedById:            incident.verifiedById            || '',
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try { await onSave(form); toast.success('Verification saved'); }
    catch { toast.error('Save failed'); }
    finally { setSaving(false); }
  };

  const STATUS_COLORS = {
    Pending:   'bg-gray-100 text-gray-700',
    In_Review: 'bg-blue-100 text-blue-700',
    Verified:  'bg-green-100 text-green-700',
    Failed:    'bg-red-100 text-red-700',
  };

  return (
    <div className="space-y-4">
      {form.verificationStatus === 'Failed' && (
        <div className="bg-red-50 border border-red-300 rounded-lg p-4 flex items-start gap-3">
          <ExclamationTriangleIcon className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-800">Corrective Action Has Failed Verification</p>
            <p className="text-sm text-red-700 mt-0.5">Revised corrective actions must be implemented. FAA §5.93 requires documented follow-up.</p>
          </div>
        </div>
      )}
      {form.verificationStatus === 'Verified' && (
        <div className="bg-green-50 border border-green-300 rounded-lg p-4 flex items-start gap-3">
          <CheckCircleIcon className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-green-800">Corrective Action Verified — Ready to Close</p>
            <p className="text-sm text-green-700 mt-0.5">Effectiveness has been confirmed. You may now advance to close this incident.</p>
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
            rows={4} className="input resize-none" disabled={!canEdit}
            placeholder="Did the corrective action effectively address the root cause? Were there any unexpected outcomes?" />
        </div>
      </div>
      {canEdit && <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save Verification'}</button>}
    </div>
  );
}

// ── Tab 6: Timeline ───────────────────────────────────────────────────────────
function TimelineTab({ incident, onAddNote, canEdit }) {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const entries = Array.isArray(incident.timeline)
    ? incident.timeline
    : (() => { try { return JSON.parse(incident.timeline || '[]'); } catch { return []; } })();

  const addNote = async () => {
    if (!note.trim()) return;
    setSaving(true);
    try {
      await onAddNote(note);
      setNote('');
      toast.success('Note added');
    } catch { toast.error('Failed to add note'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      {entries.length === 0 && <p className="text-sm text-gray-400 italic">No timeline entries yet.</p>}
      <div className="space-y-3">
        {entries.slice().reverse().map((e, i) => (
          <div key={i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`h-2.5 w-2.5 rounded-full mt-1 flex-shrink-0 ${INC_STAGE_COLORS[e.status]?.includes('green') ? 'bg-green-500' : 'bg-blue-500'}`} />
              {i < entries.length - 1 && <div className="w-0.5 bg-gray-200 flex-1 mt-1" />}
            </div>
            <div className="pb-3 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${INC_STAGE_COLORS[e.status] || 'bg-gray-100 text-gray-600'}`}>
                  {INC_STAGE_LABELS[e.status] || e.status?.replace(/_/g, ' ')}
                </span>
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <ClockIcon className="h-3 w-3" />{formatDateTime(e.timestamp)}
                </span>
                {e.userName && <span className="text-xs text-gray-400">· {e.userName}</span>}
              </div>
              {e.note && <p className="text-sm text-gray-700 mt-0.5">{e.note}</p>}
            </div>
          </div>
        ))}
      </div>
      {canEdit && (
        <div className="border-t pt-4">
          <label className="label">Add Timeline Note</label>
          <div className="flex gap-2 mt-1">
            <input
              type="text" value={note} onChange={(e) => setNote(e.target.value)}
              className="input flex-1" placeholder="Brief note (investigation finding, communication, etc.)..."
              onKeyDown={(e) => e.key === 'Enter' && addNote()}
            />
            <button onClick={addNote} disabled={saving || !note.trim()} className="btn-primary whitespace-nowrap">
              {saving ? 'Adding…' : 'Add Note'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main IncidentDetail component ─────────────────────────────────────────────
const TABS = ['Overview', 'Investigation', 'Risk Assessment', 'Controls & Actions', 'Verification', 'Timeline'];

export default function IncidentDetail({ incidentId, onClose }) {
  const { isSTA, isAdmin } = useAuth();
  const canEdit = isSTA || isAdmin;

  const [incident, setIncident] = useState(null);
  const [users, setUsers]       = useState([]);
  const [tab, setTab]           = useState(0);
  const [advancing, setAdvancing]     = useState(false);
  const [advanceNote, setAdvanceNote] = useState('');
  const [showAdvance, setShowAdvance] = useState(false);

  const load = useCallback(async () => {
    const [iRes, uRes] = await Promise.all([
      api.get(`/incidents/${incidentId}`),
      api.get('/users'),
    ]);
    setIncident(iRes.data);
    setUsers(uRes.data);
  }, [incidentId]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (data) => {
    await api.put(`/incidents/${incidentId}`, data);
    await load();
  };

  const handleAdvance = async () => {
    setAdvancing(true);
    try {
      const res = await api.put(`/incidents/${incidentId}/advance`, {
        note: advanceNote || undefined,
      });
      setAdvanceNote('');
      setShowAdvance(false);
      await load();
      toast.success(`Advanced to ${INC_STAGE_LABELS[res.data.status] || res.data.status}`);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Cannot advance stage');
    } finally {
      setAdvancing(false);
    }
  };

  const handleAddNote = async (note) => {
    await api.put(`/incidents/${incidentId}`, { note });
    await load();
  };

  if (!incident) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
    </div>
  );

  const currentIdx = INC_STAGES.indexOf(incident.status);
  const isClosed   = incident.status === 'Closed';
  const nextLabel  = !isClosed && currentIdx < INC_STAGES.length - 1
    ? INC_ADVANCE_LABELS[incident.status]
    : null;

  return (
    <div className="flex flex-col h-full">
      {/* Stage stepper */}
      <div className="bg-gray-50 border-b border-gray-200 px-4 pt-4 pb-2">
        <LifecycleStepper status={incident.status} />
      </div>

      {/* Advance banner */}
      {canEdit && !isClosed && (
        <div className="px-6 py-3 border-b border-gray-200 bg-white flex items-center justify-between gap-4">
          {!showAdvance ? (
            <>
              <div className="text-sm text-gray-500">
                Current: <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${INC_STAGE_COLORS[incident.status] || ''}`}>
                  {INC_STAGE_LABELS[incident.status]}
                </span>
              </div>
              {nextLabel && (
                <button onClick={() => setShowAdvance(true)} className="btn-primary text-sm flex items-center gap-2">
                  {nextLabel} →
                </button>
              )}
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
          <span className="text-sm font-medium text-green-800">Incident Closed — full investigation lifecycle completed</span>
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
        {tab === 0 && <OverviewTab    incident={incident} users={users} />}
        {tab === 1 && <InvestigationTab incident={incident} users={users} onSave={handleSave} canEdit={canEdit} />}
        {tab === 2 && <RiskTab        incident={incident} onSave={handleSave} canEdit={canEdit} />}
        {tab === 3 && <ControlsTab   incident={incident} users={users} onSave={handleSave} canEdit={canEdit} />}
        {tab === 4 && <VerificationTab incident={incident} users={users} onSave={handleSave} canEdit={canEdit} />}
        {tab === 5 && <TimelineTab    incident={incident} onAddNote={handleAddNote} canEdit={canEdit} />}
      </div>
    </div>
  );
}
