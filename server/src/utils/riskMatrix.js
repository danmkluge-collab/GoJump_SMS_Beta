const RISK_MATRIX = {
  Frequent:   { Negligible: 'Medium', Minor: 'High',   Major: 'Critical', Catastrophic: 'Critical' },
  Occasional: { Negligible: 'Low',    Minor: 'Medium', Major: 'High',     Catastrophic: 'Critical' },
  Remote:     { Negligible: 'Low',    Minor: 'Low',    Major: 'Medium',   Catastrophic: 'High'     },
  Improbable: { Negligible: 'Low',    Minor: 'Low',    Major: 'Low',      Catastrophic: 'Medium'   },
};

const RISK_ACTION = {
  Critical: 'Immediate action required — cease operations if necessary',
  High:     'Immediate action required — assign responsible person within 24 hours',
  Medium:   'Action required within 30 days',
  Low:      'Monitor — review at next safety committee meeting',
};

function calculateRisk(likelihood, consequence) {
  return RISK_MATRIX[likelihood]?.[consequence] ?? 'Low';
}

module.exports = { calculateRisk, RISK_MATRIX, RISK_ACTION };
