const router = require('express').Router();
const prisma = require('../utils/prisma');
const { authenticate, requireRoles } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');

// §5.71 — 7-stage SRM lifecycle (matches hazardReports.js)
const LIFECYCLE_STAGES = [
  'Submitted', 'Acknowledged', 'Under_Investigation',
  'Risk_Assessed', 'Controls_Applied', 'Verification', 'Closed',
];

const RISK_MATRIX = {
  Frequent:   { Negligible: 'Medium', Minor: 'High',   Major: 'Critical', Catastrophic: 'Critical' },
  Occasional: { Negligible: 'Low',    Minor: 'Medium', Major: 'High',     Catastrophic: 'Critical' },
  Remote:     { Negligible: 'Low',    Minor: 'Low',    Major: 'Medium',   Catastrophic: 'High'     },
  Improbable: { Negligible: 'Low',    Minor: 'Low',    Major: 'Low',      Catastrophic: 'Medium'   },
};
function calcRisk(l, c) { return RISK_MATRIX[l]?.[c] ?? null; }

// ─── Transition validation (§5.51, §5.55, §5.71) ─────────────────────────────
function validateIncidentTransition(incident, nextStage) {
  const currentIdx = LIFECYCLE_STAGES.indexOf(incident.status);
  const nextIdx    = LIFECYCLE_STAGES.indexOf(nextStage);
  if (nextIdx !== currentIdx + 1) {
    return `Cannot advance from ${incident.status} to ${nextStage}. Lifecycle must be sequential.`;
  }
  if (nextStage === 'Under_Investigation') {
    if (!incident.rootCauseAnalysis?.trim()) {
      return 'Root cause analysis notes are required before moving to Under Investigation.';
    }
  }
  if (nextStage === 'Risk_Assessed') {
    if (!incident.initialLikelihood || !incident.initialConsequence) {
      return 'Initial likelihood and consequence ratings are required for Risk Assessed.';
    }
  }
  if (nextStage === 'Controls_Applied') {
    if (!incident.controlMeasures?.trim()) {
      return 'Control measures must be documented before Controls Applied.';
    }
    if (!incident.residualLikelihood || !incident.residualConsequence) {
      return 'Residual likelihood and consequence are required for Controls Applied.';
    }
    const residual = calcRisk(incident.residualLikelihood, incident.residualConsequence);
    if ((residual === 'High' || residual === 'Critical') && !incident.alarpJustification?.trim()) {
      return 'ALARP justification is required for High/Critical residual risk (§5.55).';
    }
  }
  if (nextStage === 'Verification') {
    if (!incident.verifiedById) {
      return 'A verifier must be assigned before entering the Verification stage.';
    }
  }
  if (nextStage === 'Closed') {
    if (incident.verificationStatus !== 'Verified') {
      return 'Verification must be marked "Verified" before closing the incident.';
    }
  }
  return null;
}

async function validateIncidentRiskAcceptance(incident, user) {
  const residual = calcRisk(incident.residualLikelihood, incident.residualConsequence) || incident.residualRiskRating;
  if (residual === 'Critical') {
    const isAE = await prisma.user.findFirst({ where: { id: user.id, isAccountableExecutive: true } });
    if (!isAE) return 'Critical residual risk requires Accountable Executive acceptance (§5.55).';
  }
  if (residual === 'High') {
    const isAE = await prisma.user.findFirst({ where: { id: user.id, isAccountableExecutive: true } });
    if (!isAE && user.role !== 'admin') {
      return 'High residual risk requires Admin or Accountable Executive acceptance (§5.55).';
    }
  }
  return null;
}

const INCIDENT_INCLUDE = {
  location: true,
  hazardReport: true,
  assignedTo: { select: { id: true, name: true, email: true, role: true } },
};

// ─── GET /api/incidents ───────────────────────────────────────────────────────
router.get('/', authenticate, requireRoles('admin', 's_ta', 'staff'), async (req, res) => {
  const { locationId, status, assignedToId, overdue } = req.query;
  const where = {};

  if (req.user.role !== 'admin') {
    where.locationId = req.user.locationId;
  } else if (locationId) {
    where.locationId = locationId;
  }

  if (status) where.status = status;
  if (assignedToId) where.assignedToId = assignedToId;
  if (overdue === 'true') {
    where.followUpDate = { not: null, lt: new Date() };
    where.status = { notIn: ['Closed'] };
  }

  const incidents = await prisma.incident.findMany({
    where,
    include: INCIDENT_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });
  res.json(incidents);
});

// ─── POST /api/incidents — create / promote hazard report to incident ─────────
router.post('/', authenticate, requireRoles('admin', 's_ta'),
  auditLog('incidents', 'CREATE'),
  async (req, res) => {
    const { locationId, hazardReportId, assignedToId, regulatoryRefs } = req.body;
    const targetLocationId = req.user.role === 'admin' ? locationId : req.user.locationId;

    const incident = await prisma.incident.create({
      data: {
        locationId: targetLocationId,
        hazardReportId: hazardReportId || null,
        assignedToId:   assignedToId   || null,
        regulatoryRefs: JSON.stringify(regulatoryRefs || []),
        timeline: JSON.stringify([{
          status: 'Submitted',
          timestamp: new Date().toISOString(),
          userId: req.user.id,
          userName: req.user.name,
          note: 'Incident created',
        }]),
      },
      include: INCIDENT_INCLUDE,
    });
    res.status(201).json(incident);
  }
);

// ─── GET /api/incidents/:id ───────────────────────────────────────────────────
router.get('/:id', authenticate, requireRoles('admin', 's_ta', 'staff'), async (req, res) => {
  const incident = await prisma.incident.findUnique({
    where: { id: req.params.id },
    include: INCIDENT_INCLUDE,
  });
  if (!incident) return res.status(404).json({ error: 'Not found' });
  if (req.user.role !== 'admin' && incident.locationId !== req.user.locationId) {
    return res.status(403).json({ error: 'Access denied' });
  }
  res.json(incident);
});

// ─── PUT /api/incidents/:id — full SRM field update ──────────────────────────
router.put('/:id', authenticate, requireRoles('admin', 's_ta', 'staff'),
  auditLog('incidents', 'UPDATE'),
  async (req, res) => {
    const existing = await prisma.incident.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (req.user.role !== 'admin' && existing.locationId !== req.user.locationId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const {
      status, note,
      // Basic fields
      investigationNotes, correctiveAction, followUpDate, assignedToId,
      // §5.73 Investigation
      rootCauseAnalysis, contributingFactors, investigationCompletedAt, investigatedById,
      // Risk assessment
      initialLikelihood, initialConsequence,
      residualLikelihood, residualConsequence,
      alarpJustification, riskAcceptedById, riskAcceptedAt,
      // Controls
      controlMeasures, controlType, sopUpdated, trainingUpdated, equipmentUpgraded,
      actionAssignedToId, actionDueDate, actionCompletedAt, actionNotes,
      // Verification
      verificationStatus, verificationNotes, verificationCompletedAt, verifiedById,
    } = req.body;

    // ── Timeline update ──────────────────────────────────────────────────────
    let timeline = [];
    try { timeline = JSON.parse(existing.timeline || '[]'); } catch { timeline = []; }

    const newStatus = status || existing.status;
    if (status && status !== existing.status) {
      timeline.push({
        status,
        timestamp: new Date().toISOString(),
        userId: req.user.id,
        userName: req.user.name,
        note: note || `Status changed to ${status.replace(/_/g, ' ')}`,
      });
    } else if (note) {
      timeline.push({
        status: existing.status,
        timestamp: new Date().toISOString(),
        userId: req.user.id,
        userName: req.user.name,
        note,
      });
    }

    const data = {
      status:    newStatus,
      timeline:  JSON.stringify(timeline),
      closedAt:  newStatus === 'Closed' ? (existing.closedAt || new Date()) : existing.closedAt,
    };

    // ── Simple string fields ─────────────────────────────────────────────────
    if (investigationNotes       !== undefined) data.investigationNotes       = investigationNotes;
    if (correctiveAction         !== undefined) data.correctiveAction         = correctiveAction;
    if (rootCauseAnalysis        !== undefined) data.rootCauseAnalysis        = rootCauseAnalysis;
    if (controlMeasures          !== undefined) data.controlMeasures          = controlMeasures;
    if (controlType              !== undefined) data.controlType              = controlType;
    if (actionNotes              !== undefined) data.actionNotes              = actionNotes;
    if (alarpJustification       !== undefined) data.alarpJustification       = alarpJustification;
    if (verificationNotes        !== undefined) data.verificationNotes        = verificationNotes;
    if (verificationStatus       !== undefined) data.verificationStatus       = verificationStatus;
    if (initialLikelihood        !== undefined) data.initialLikelihood        = initialLikelihood;
    if (initialConsequence       !== undefined) data.initialConsequence       = initialConsequence;
    if (residualLikelihood       !== undefined) data.residualLikelihood       = residualLikelihood;
    if (residualConsequence      !== undefined) data.residualConsequence      = residualConsequence;

    // ── Booleans ─────────────────────────────────────────────────────────────
    if (sopUpdated        !== undefined) data.sopUpdated        = !!sopUpdated;
    if (trainingUpdated   !== undefined) data.trainingUpdated   = !!trainingUpdated;
    if (equipmentUpgraded !== undefined) data.equipmentUpgraded = !!equipmentUpgraded;

    // ── FK fields (empty string → null) ──────────────────────────────────────
    if (assignedToId       !== undefined) data.assignedToId       = assignedToId       || null;
    if (investigatedById   !== undefined) data.investigatedById   = investigatedById   || null;
    if (actionAssignedToId !== undefined) data.actionAssignedToId = actionAssignedToId || null;
    if (riskAcceptedById   !== undefined) data.riskAcceptedById   = riskAcceptedById   || null;
    if (verifiedById       !== undefined) data.verifiedById       = verifiedById       || null;

    // ── DateTime fields ───────────────────────────────────────────────────────
    if (followUpDate             !== undefined) data.followUpDate             = followUpDate             ? new Date(followUpDate)             : null;
    if (investigationCompletedAt !== undefined) data.investigationCompletedAt = investigationCompletedAt ? new Date(investigationCompletedAt) : null;
    if (actionDueDate            !== undefined) data.actionDueDate            = actionDueDate            ? new Date(actionDueDate)            : null;
    if (actionCompletedAt        !== undefined) data.actionCompletedAt        = actionCompletedAt        ? new Date(actionCompletedAt)        : null;
    if (riskAcceptedAt           !== undefined) data.riskAcceptedAt           = riskAcceptedAt           ? new Date(riskAcceptedAt)           : null;
    if (verificationCompletedAt  !== undefined) data.verificationCompletedAt  = verificationCompletedAt  ? new Date(verificationCompletedAt)  : null;

    // ── JSON array fields ─────────────────────────────────────────────────────
    if (contributingFactors !== undefined) data.contributingFactors = JSON.stringify(contributingFactors);

    // ── Auto-calc risk ratings ────────────────────────────────────────────────
    const il = initialLikelihood  ?? existing.initialLikelihood;
    const ic = initialConsequence ?? existing.initialConsequence;
    if (il && ic) data.initialRiskRating = calcRisk(il, ic);

    const rl = residualLikelihood  ?? existing.residualLikelihood;
    const rc = residualConsequence ?? existing.residualConsequence;
    if (rl && rc) data.residualRiskRating = calcRisk(rl, rc);

    const updated = await prisma.incident.update({
      where: { id: req.params.id },
      data,
      include: INCIDENT_INCLUDE,
    });
    res.json(updated);
  }
);

// ─── PUT /api/incidents/:id/advance — validated lifecycle transition ──────────
router.put('/:id/advance', authenticate, requireRoles('admin', 's_ta'),
  auditLog('incidents', 'ADVANCE'),
  async (req, res) => {
    const { note } = req.body;

    const incident = await prisma.incident.findUnique({ where: { id: req.params.id } });
    if (!incident) return res.status(404).json({ error: 'Not found' });
    if (req.user.role !== 'admin' && incident.locationId !== req.user.locationId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const currentIdx = LIFECYCLE_STAGES.indexOf(incident.status);
    if (currentIdx === -1) return res.status(400).json({ error: 'Unknown current status' });
    if (currentIdx >= LIFECYCLE_STAGES.length - 1) {
      return res.status(400).json({ error: 'Incident is already Closed.' });
    }

    const nextStage = LIFECYCLE_STAGES[currentIdx + 1];

    const transitionError = validateIncidentTransition(incident, nextStage);
    if (transitionError) return res.status(422).json({ error: transitionError });

    // §5.55 risk acceptance gate: Controls_Applied → Verification
    if (nextStage === 'Verification') {
      const riskError = await validateIncidentRiskAcceptance(incident, req.user);
      if (riskError) return res.status(422).json({ error: riskError });
    }

    let timeline = [];
    try { timeline = JSON.parse(incident.timeline || '[]'); } catch { timeline = []; }
    timeline.push({
      status: nextStage,
      timestamp: new Date().toISOString(),
      userId: req.user.id,
      userName: req.user.name,
      note: note || `Advanced to ${nextStage.replace(/_/g, ' ')}`,
    });

    const updated = await prisma.incident.update({
      where: { id: req.params.id },
      data: {
        status: nextStage,
        timeline: JSON.stringify(timeline),
        ...(nextStage === 'Closed' ? { closedAt: new Date() } : {}),
      },
      include: INCIDENT_INCLUDE,
    });

    res.json(updated);
  }
);

// ─── DELETE /api/incidents/:id — blocked for SRM records (§5.95) ─────────────
router.delete('/:id', authenticate, requireRoles('admin'), async (req, res) => {
  return res.status(403).json({
    error: 'Incident records are SRM records and must be retained indefinitely per FAA §5.95. Use archive instead of deletion.',
  });
});

module.exports = router;
