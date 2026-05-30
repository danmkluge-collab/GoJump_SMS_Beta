export const SEVERITY_COLORS = {
  Low:      'badge-low',
  Medium:   'badge-medium',
  High:     'badge-high',
  Critical: 'badge-critical',
};

export const RISK_COLORS = {
  Low:      'text-green-700 bg-green-50 border-green-200',
  Medium:   'text-yellow-700 bg-yellow-50 border-yellow-200',
  High:     'text-orange-700 bg-orange-50 border-orange-200',
  Critical: 'text-red-700 bg-red-50 border-red-200',
};

export const INCIDENT_STATUS_COLORS = {
  Submitted:         'bg-gray-100 text-gray-700',
  Acknowledged:      'bg-blue-100 text-blue-700',
  Investigation:     'bg-yellow-100 text-yellow-700',
  Corrective_Action: 'bg-orange-100 text-orange-700',
  Closed:            'bg-green-100 text-green-700',
};

export const REPORT_STATUS_COLORS = {
  Open:       'bg-red-100 text-red-700',
  In_Review:  'bg-yellow-100 text-yellow-700',
  Mitigated:  'bg-blue-100 text-blue-700',
  Closed:     'bg-green-100 text-green-700',
};

// ── SRM Lifecycle ─────────────────────────────────────────────────────────────
export const LIFECYCLE_STAGES = [
  'Submitted', 'Acknowledged', 'Under_Investigation',
  'Risk_Assessed', 'Controls_Applied', 'Verification', 'Closed',
];

export const STAGE_LABELS = {
  Submitted:           'Submitted',
  Acknowledged:        'Acknowledged',
  Under_Investigation: 'Investigation',
  Risk_Assessed:       'Risk Assessed',
  Controls_Applied:    'Controls Applied',
  Verification:        'Verification',
  Closed:              'Closed',
};

export const ADVANCE_LABELS = {
  Submitted:           'Acknowledge Report',
  Acknowledged:        'Start Investigation',
  Under_Investigation: 'Complete Risk Assessment',
  Risk_Assessed:       'Mark Controls Applied',
  Controls_Applied:    'Submit for Verification',
  Verification:        'Close Report',
};

export const LIFECYCLE_COLORS = {
  Submitted:           'bg-gray-100 text-gray-700',
  Acknowledged:        'bg-blue-100 text-blue-700',
  Under_Investigation: 'bg-yellow-100 text-yellow-800',
  Risk_Assessed:       'bg-orange-100 text-orange-700',
  Controls_Applied:    'bg-indigo-100 text-indigo-700',
  Verification:        'bg-purple-100 text-purple-700',
  Closed:              'bg-green-100 text-green-700',
};

export const LIFECYCLE_BORDER = {
  Submitted:           'border-l-gray-400',
  Acknowledged:        'border-l-blue-400',
  Under_Investigation: 'border-l-yellow-400',
  Risk_Assessed:       'border-l-orange-400',
  Controls_Applied:    'border-l-indigo-400',
  Verification:        'border-l-purple-400',
  Closed:              'border-l-green-400',
};

// Regulatory refs shown per lifecycle tab
export const STAGE_REG_REFS = {
  report:        ['§5.7', '§5.91'],
  investigation: ['§5.71', '§5.73'],
  risk:          ['§5.5', '§5.7', '§5.91', '§5.95'],
  controls:      ['§5.5', '§5.7', '§5.91'],
  verification:  ['§5.7', '§5.9', '§5.93', '§5.95'],
  feedback:      ['§5.93'],
};

export const REG_REF_SUMMARIES = {
  '§5.5':  'Defines hazard identification, risk analysis, and mitigation requirements.',
  '§5.7':  'Requires documented safety risk assessment for all identified hazards.',
  '§5.9':  'Safety assurance — continual monitoring and measurement of SMS effectiveness.',
  '§5.71': 'Requires a process to acquire safety data from operations.',
  '§5.73': 'Analysis of safety data to identify hazards and assess risk.',
  '§5.91': 'Safety risk management procedures must be applied to all identified hazards.',
  '§5.93': 'Safety promotion — communication of safety information throughout the organization.',
  '§5.95': 'Documented safety risk mitigations including verification of effectiveness.',
};

export const CONTRIBUTING_FACTORS_OPTIONS = [
  'Human Factors', 'Equipment', 'Weather', 'Procedure Gap',
  'Training', 'Communication', 'Maintenance', 'Other',
];

export const CONTROL_TYPES = [
  'Eliminate', 'Substitute', 'Engineering Control', 'Administrative Control', 'PPE',
];

export const VERIFICATION_STATUSES = ['Pending', 'In_Review', 'Verified', 'Failed'];

export const KPI_STATUS_COLORS = {
  On_Target:  'text-green-700 bg-green-50',
  At_Risk:    'text-yellow-700 bg-yellow-50',
  Off_Target: 'text-red-700 bg-red-50',
};

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function daysAgo(dateStr) {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

export const HAZARD_TYPES = ['Equipment', 'Weather', 'Human_Factors', 'Operational', 'Aircraft', 'Other'];
export const SEVERITIES = ['Low', 'Medium', 'High', 'Critical'];
export const LIKELIHOODS = ['Frequent', 'Occasional', 'Remote', 'Improbable'];
export const CONSEQUENCES = ['Negligible', 'Minor', 'Major', 'Catastrophic'];
export const REGULATORY_REFS = [
  '§5.1', '§5.3', '§5.5', '§5.7', '§5.9', '§5.11', '§5.13', '§5.15', '§5.17',
  '§5.19', '§5.21', '§5.23', '§5.51', '§5.53', '§5.55', '§5.57', '§5.71',
  '§5.73', '§5.75', '§5.91', '§5.93', '§5.95', '§5.97',
];

export const RISK_MATRIX = {
  Frequent:   { Negligible: 'Medium', Minor: 'High',   Major: 'Critical', Catastrophic: 'Critical' },
  Occasional: { Negligible: 'Low',    Minor: 'Medium', Major: 'High',     Catastrophic: 'Critical' },
  Remote:     { Negligible: 'Low',    Minor: 'Low',    Major: 'Medium',   Catastrophic: 'High'     },
  Improbable: { Negligible: 'Low',    Minor: 'Low',    Major: 'Low',      Catastrophic: 'Medium'   },
};

export function calculateRisk(likelihood, consequence) {
  return RISK_MATRIX[likelihood]?.[consequence] ?? '';
}
