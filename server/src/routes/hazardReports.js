const router = require('express').Router();
const prisma = require('../utils/prisma');
const { authenticate, requireRoles } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { auditLog } = require('../middleware/audit');
const emailSvc = require('../services/emailService');

const LIFECYCLE_STAGES = [
  'Submitted',
  'Acknowledged',
  'Under_Investigation',
  'Risk_Assessed',
  'Controls_Applied',
  'Verification',
  'Closed',
];

const HAZARD_INCLUDE = {
  location: true,
  incident: true,
  investigatedBy:   { select: { id: true, name: true, role: true } },
  actionAssignedTo: { select: { id: true, name: true, role: true } },
  verifiedBy:       { select: { id: true, name: true, role: true } },
};

// ─── POST /api/hazard-reports — PUBLIC (QR form, no auth) ─────────────────────
router.post('/', upload.single('photo'), async (req, res) => {
  const { locationId, reporterName, reporterEmail, type, description, severity, isAnonymous, confidentialReport } = req.body;
  if (!locationId || !type || !description || !severity)
    return res.status(400).json({ error: 'locationId, type, description, and severity are required' });

  const loc = await prisma.location.findUnique({ where: { id: locationId } });
  if (!loc) return res.status(404).json({ error: 'Location not found' });

  const anon = isAnonymous === 'true' || isAnonymous === true;
  const confidential = confidentialReport === 'true' || confidentialReport === true;
  const report = await prisma.hazardReport.create({
    data: {
      locationId,
      reporterName:      anon ? null : (reporterName  || null),
      reporterEmail:     anon ? null : (reporterEmail || null),
      isAnonymous:       anon,
      confidentialReport: confidential,
      type, description, severity,
      status: 'Submitted',
      photoUrl: req.file ? `/uploads/${req.file.filename}` : null,
    },
  });

  emailSvc.notifyStaForNewReport(locationId, report).catch(() => {});

  // §5.95 — log with masked IP (protect identity, maintain system integrity)
  await prisma.auditLog.create({
    data: { action: 'CREATE', tableName: 'hazard_reports', recordId: report.id,
            newValue: JSON.stringify({ type, severity, isAnonymous: anon }),
            ipAddress: req.ip ? req.ip.replace(/\d+$/, 'x') : null,
            locationId },
  }).catch(() => {});

  res.status(201).json(report);
});

// ─── GET /api/hazard-reports ──────────────────────────────────────────────────
router.get('/', authenticate, requireRoles('admin', 's_ta', 'staff'), async (req, res) => {
  const { locationId, status, severity, type, overdue, assignedTo, from, to, page = 1, limit = 50 } = req.query;
  const where = {};

  if (req.user.role !== 'admin') where.locationId = req.user.locationId;
  else if (locationId)            where.locationId = locationId;

  if (status)     where.status = status;
  if (severity)   where.severity = severity;
  if (type)       where.type = type;
  if (assignedTo) where.actionAssignedToId = assignedTo;
  if (overdue === 'true') {
    where.actionDueDate = { not: null, lt: new Date() };
    where.status = { notIn: ['Controls_Applied', 'Verification', 'Closed'] };
  }
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to)   where.createdAt.lte = new Date(to);
  }

  const [total, reports] = await Promise.all([
    prisma.hazardReport.count({ where }),
    prisma.hazardReport.findMany({
      where,
      include: HAZARD_INCLUDE,
      orderBy: { createdAt: 'desc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
    }),
  ]);

  res.json({ total, page: Number(page), limit: Number(limit), data: reports });
});

// ─── GET /api/hazard-reports/:id ──────────────────────────────────────────────
router.get('/:id', authenticate, requireRoles('admin', 's_ta', 'staff'), async (req, res) => {
  const report = await prisma.hazardReport.findUnique({
    where: { id: req.params.id }, include: HAZARD_INCLUDE,
  });
  if (!report) return res.status(404).json({ error: 'Report not found' });
  if (req.user.role !== 'admin' && report.locationId !== req.user.locationId)
    return res.status(403).json({ error: 'Access denied' });

  // §5.71(a)(7) — Staff see de-identified version of confidential reports
  if (report.confidentialReport && req.user.role === 'staff') {
    return res.json({
      ...report,
      description: report.deIdentifiedDesc || '[Confidential — de-identified summary pending]',
      reporterName: null, reporterEmail: null, photoUrl: null,
      _confidentialFiltered: true,
    });
  }
  res.json(report);
});

// ─── GET /api/hazard-reports/:id/deidentified — safe view for staff ───────────
router.get('/:id/deidentified', authenticate, requireRoles('admin', 's_ta', 'staff'), async (req, res) => {
  const report = await prisma.hazardReport.findUnique({ where: { id: req.params.id } });
  if (!report) return res.status(404).json({ error: 'Report not found' });
  if (req.user.role !== 'admin' && report.locationId !== req.user.locationId)
    return res.status(403).json({ error: 'Access denied' });
  res.json({
    id: report.id, type: report.type, severity: report.severity, status: report.status,
    description: report.deIdentifiedDesc || '[Awaiting de-identification by S&TA]',
    createdAt: report.createdAt, locationId: report.locationId,
    isAnonymous: true, confidentialReport: true, _confidentialFiltered: true,
  });
});

// ─── PUT /api/hazard-reports/:id — update SRM section data ───────────────────
router.put('/:id', authenticate, requireRoles('admin', 's_ta', 'staff'),
  auditLog('hazard_reports', 'UPDATE'),
  async (req, res) => {
    const existing = await prisma.hazardReport.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Report not found' });
    if (req.user.role !== 'admin' && existing.locationId !== req.user.locationId)
      return res.status(403).json({ error: 'Access denied' });

    const JSON_FIELDS    = ['regulatoryRefs', 'contributingFactors'];
    const DATETIME_FIELDS = ['investigationCompletedAt', 'actionDueDate', 'actionCompletedAt', 'verificationCompletedAt', 'deIdentifiedAt', 'riskAcceptedAt'];
    const FK_FIELDS       = ['investigatedById', 'actionAssignedToId', 'verifiedById', 'deIdentifiedById', 'riskAcceptedById'];
    const ALLOWED = [
      'status', 'regulatoryRefs',
      // §5.71(a)(7) confidential reporting
      'confidentialReport', 'deIdentifiedDesc', 'deIdentifiedById', 'deIdentifiedAt',
      'rootCauseAnalysis', 'contributingFactors', 'investigationCompletedAt', 'investigatedById',
      'initialLikelihood', 'initialConsequence', 'initialRiskRating',
      'controlMeasures', 'controlType', 'sopUpdated', 'trainingUpdated', 'equipmentUpgraded',
      'actionAssignedToId', 'actionDueDate', 'actionCompletedAt', 'actionNotes',
      'residualLikelihood', 'residualConsequence', 'residualRiskRating',
      // §5.55 risk acceptance
      'riskAcceptedById', 'riskAcceptedAt', 'riskAcceptanceNotes', 'alarpJustification',
      'verificationStatus', 'verificationNotes', 'verificationCompletedAt', 'verifiedById',
      'newHazardsIntroduced', 'newHazardDescription', 'reporterEmail',
    ];

    const data = {};
    for (const field of ALLOWED) {
      if (req.body[field] !== undefined) {
        let val = req.body[field];
        // Serialize JSON array fields
        if (JSON_FIELDS.includes(field)) { val = JSON.stringify(val); }
        // Convert YYYY-MM-DD date strings to full ISO DateTime (Prisma requires it)
        else if (DATETIME_FIELDS.includes(field)) {
          val = val ? new Date(val).toISOString() : null;
        }
        // Convert empty FK strings to null so Prisma doesn't try to look up ""
        else if (FK_FIELDS.includes(field)) {
          val = val || null;
        }
        data[field] = val;
      }
    }

    // Auto-calculate risk ratings
    if (data.initialLikelihood || data.initialConsequence) {
      const l = data.initialLikelihood ?? existing.initialLikelihood;
      const c = data.initialConsequence ?? existing.initialConsequence;
      if (l && c) data.initialRiskRating = calcRisk(l, c);
    }
    if (data.residualLikelihood || data.residualConsequence) {
      const l = data.residualLikelihood ?? existing.residualLikelihood;
      const c = data.residualConsequence ?? existing.residualConsequence;
      if (l && c) data.residualRiskRating = calcRisk(l, c);
    }

    // If verification status set to Failed, notify S&TA
    if (data.verificationStatus === 'Failed' && existing.verificationStatus !== 'Failed') {
      emailSvc.notifyStaVerificationFailed(existing.locationId, existing).catch(() => {});
    }

    const updated = await prisma.hazardReport.update({
      where: { id: req.params.id }, data, include: HAZARD_INCLUDE,
    });
    res.json(updated);
  }
);

// ─── PUT /api/hazard-reports/:id/advance — advance lifecycle stage ────────────
router.put('/:id/advance', authenticate, requireRoles('admin', 's_ta'), async (req, res) => {
  const { note } = req.body;
  const report = await prisma.hazardReport.findUnique({ where: { id: req.params.id } });
  if (!report) return res.status(404).json({ error: 'Report not found' });
  if (req.user.role !== 'admin' && report.locationId !== req.user.locationId)
    return res.status(403).json({ error: 'Access denied' });

  const currentIdx = LIFECYCLE_STAGES.indexOf(report.status);
  if (currentIdx < 0 || currentIdx >= LIFECYCLE_STAGES.length - 1)
    return res.status(400).json({ error: 'Already at final stage' });

  const nextStage = LIFECYCLE_STAGES[currentIdx + 1];
  const errors = validateTransition(report, nextStage);
  if (errors.length) return res.status(400).json({ error: errors.join('; ') });

  // §5.55 — Async authority check (requires DB lookup)
  const authError = await validateRiskAcceptance(report, nextStage);
  if (authError) return res.status(403).json({ error: authError });

  const updated = await prisma.hazardReport.update({
    where: { id: req.params.id },
    data: { status: nextStage },
    include: HAZARD_INCLUDE,
  });

  await prisma.auditLog.create({
    data: {
      userId: req.user.id, userRole: req.user.role,
      action: 'STATUS_CHANGE', tableName: 'hazard_reports',
      recordId: report.id, oldValue: report.status, newValue: nextStage,
      locationId: report.locationId,
    },
  }).catch(() => {});

  emailSvc.notifyReporterStageChange(updated, nextStage, note).catch(() => {});

  res.json(updated);
});

// ─── POST /api/hazard-reports/:id/notify — manual reporter notification ───────
router.post('/:id/notify', authenticate, requireRoles('admin', 's_ta'), async (req, res) => {
  const { subject, message } = req.body;
  const report = await prisma.hazardReport.findUnique({
    where: { id: req.params.id }, include: { location: true },
  });
  if (!report) return res.status(404).json({ error: 'Report not found' });
  if (!report.reporterEmail)
    return res.status(400).json({ error: 'No reporter email on file' });

  await emailSvc.send(report.reporterEmail, subject,
    `<p style="font-family:sans-serif">${message.replace(/\n/g, '<br>')}</p>
     <hr><p style="font-size:12px;color:#888">GoJump America Safety Management System — ${report.location?.name}</p>`
  );

  const log = Array.isArray(report.notificationLog) ? report.notificationLog : [];
  log.push({ timestamp: new Date().toISOString(), subject, message, sentBy: req.user.name });
  await prisma.hazardReport.update({
    where: { id: req.params.id },
    data: { notificationLog: JSON.stringify(log), reporterNotifiedAt: new Date() },
  });

  res.json({ success: true });
});

// ─── DELETE /api/hazard-reports/:id — blocked for SRM records (§5.95) ────────
router.delete('/:id', authenticate, requireRoles('admin'), async (req, res) => {
  // §5.95 — SRM records must be retained indefinitely and cannot be deleted
  return res.status(403).json({
    error: 'Hazard reports are SRM records and must be retained indefinitely per FAA §5.95. Use archive instead of deletion.',
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
const RISK_MATRIX = {
  Frequent:   { Negligible: 'Medium', Minor: 'High',   Major: 'Critical', Catastrophic: 'Critical' },
  Occasional: { Negligible: 'Low',    Minor: 'Medium', Major: 'High',     Catastrophic: 'Critical' },
  Remote:     { Negligible: 'Low',    Minor: 'Low',    Major: 'Medium',   Catastrophic: 'High'     },
  Improbable: { Negligible: 'Low',    Minor: 'Low',    Major: 'Low',      Catastrophic: 'Medium'   },
};
function calcRisk(l, c) { return RISK_MATRIX[l]?.[c] ?? null; }

function validateTransition(report, nextStage) {
  const err = [];
  if (nextStage === 'Risk_Assessed') {
    if (!report.rootCauseAnalysis?.trim()) err.push('Root cause analysis is required');
    if (!report.initialLikelihood || !report.initialConsequence) err.push('Initial risk assessment (likelihood & consequence) is required');
  }
  if (nextStage === 'Controls_Applied') {
    if (!report.controlMeasures?.trim())  err.push('Control measures description is required');
    if (!report.controlType)              err.push('Control type is required');
    if (!report.residualLikelihood || !report.residualConsequence) err.push('Residual risk assessment is required');
  }
  if (nextStage === 'Verification') {
    // §5.55 — Risk acceptance authority enforcement
    const residual = report.residualRiskRating;
    if (['High', 'Critical'].includes(residual)) {
      if (!report.alarpJustification?.trim())
        err.push('ALARP justification is required for High/Critical residual risk (§5.55)');
      if (!report.riskAcceptedById)
        err.push('High/Critical residual risk must be formally accepted by an authorized person before proceeding to Verification (§5.55)');
    }
  }
  if (nextStage === 'Closed') {
    if (report.verificationStatus !== 'Verified') err.push('Verification must be marked Verified before closing');
  }
  return err;
}

// §5.55 — Async risk acceptance authority check (called separately so we can await prisma)
async function validateRiskAcceptance(report, nextStage) {
  if (nextStage !== 'Verification') return null;
  const residual = report.residualRiskRating;
  if (!['High', 'Critical'].includes(residual) || !report.riskAcceptedById) return null;

  const acceptor = await prisma.user.findUnique({ where: { id: report.riskAcceptedById } });
  if (!acceptor) return 'Risk acceptor user not found';
  if (residual === 'Critical' && !acceptor.isAccountableExecutive)
    return 'Critical residual risk acceptance requires the designated Accountable Executive (§5.55)';
  if (residual === 'High' && !acceptor.isAccountableExecutive && acceptor.role !== 'admin')
    return 'High residual risk acceptance requires the Accountable Executive or an admin (§5.55)';
  return null;
}

module.exports = router;
