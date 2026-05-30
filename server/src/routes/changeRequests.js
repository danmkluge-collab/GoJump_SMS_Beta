const router = require('express').Router();
const prisma = require('../utils/prisma');
const { authenticate, requireRoles } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');

const CHANGE_REQUEST_INCLUDE = {
  location: { select: { name: true } },
  createdBy: { select: { id: true, name: true, role: true } },
  approvedBy: { select: { id: true, name: true, role: true } },
};

// GET /api/change-requests
router.get('/', authenticate, requireRoles('admin', 's_ta', 'staff'), async (req, res) => {
  try {
    const { locationId } = req.query;
    const where = {};

    if (req.user.role !== 'admin') {
      where.locationId = req.user.locationId;
    } else if (locationId) {
      where.locationId = locationId;
    }

    const changeRequests = await prisma.changeRequest.findMany({
      where,
      include: CHANGE_REQUEST_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    res.json(changeRequests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Severity mapping for auto-created hazard reports
const CHANGE_TYPE_HAZARD_MAP = {
  'Equipment Change':  { type: 'Equipment',     severity: 'High'   },
  'Procedure Change':  { type: 'Operational',   severity: 'Medium' },
  'Personnel Change':  { type: 'Human_Factors', severity: 'Medium' },
  'Training Change':   { type: 'Human_Factors', severity: 'Low'    },
  'Facility Change':   { type: 'Operational',   severity: 'Medium' },
  'Regulatory Change': { type: 'Operational',   severity: 'High'   },
  'Other':             { type: 'Operational',   severity: 'Medium' },
};

// Stages at or beyond Risk_Assessed (gate for approval)
const SRM_STAGES_PAST_RISK_ASSESSED = ['Risk_Assessed', 'Controls_Applied', 'Verification', 'Closed'];

// POST /api/change-requests
router.post('/', authenticate, async (req, res) => {
  try {
    const { changeType, description, proposedDate, notes, locationId: bodyLocationId } = req.body;

    if (!changeType || !description) {
      return res.status(400).json({ error: 'changeType and description are required' });
    }

    const targetLocationId = (req.user.role === 'admin' && bodyLocationId)
      ? bodyLocationId
      : req.user.locationId;

    if (!targetLocationId) {
      return res.status(400).json({ error: 'locationId is required' });
    }

    // Create the change request at Submitted status initially
    const changeRequest = await prisma.changeRequest.create({
      data: {
        locationId: targetLocationId,
        changeType,
        description,
        proposedDate: proposedDate ? new Date(proposedDate) : null,
        notes: notes || null,
        status: 'Submitted',
        createdById: req.user.id,
      },
      include: CHANGE_REQUEST_INCLUDE,
    });

    // §5.51 — Auto-create a linked SRM hazard report for every change request
    const hazardMapping = CHANGE_TYPE_HAZARD_MAP[changeType] || { type: 'Operational', severity: 'Medium' };
    const linkedHazard = await prisma.hazardReport.create({
      data: {
        locationId:    targetLocationId,
        reporterName:  req.user.name,
        reporterEmail: req.user.email,
        isAnonymous:   false,
        type:          hazardMapping.type,
        severity:      hazardMapping.severity,
        description:   `[MoC §5.51] Change Request SRM Review: ${description.substring(0, 200)}`,
        status:        'Submitted',
        regulatoryRefs: JSON.stringify(['§5.51', '§5.5', '§5.7']),
      },
    });

    // Update change request: link hazard ID and advance to SRM_Required
    const updated = await prisma.changeRequest.update({
      where: { id: changeRequest.id },
      data: {
        linkedHazardIds: JSON.stringify([linkedHazard.id]),
        status: 'SRM_Required',
      },
      include: CHANGE_REQUEST_INCLUDE,
    });

    // Notify all s_ta users at the target location (§5.51)
    const staUsers = await prisma.user.findMany({
      where: { locationId: targetLocationId, role: 's_ta', isActive: true },
      select: { id: true },
    });

    const descriptionSnippet = description.substring(0, 60);
    if (staUsers.length > 0) {
      await prisma.notification.createMany({
        data: staUsers.map((u) => ({
          userId: u.id,
          message: `New Change Request: ${descriptionSnippet}${description.length > 60 ? '...' : ''} — SRM hazard report created, risk assessment required (§5.51)`,
          link: '/change-management',
          read: false,
        })),
      });
    }

    res.status(201).json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/change-requests/:id
router.put('/:id', authenticate, requireRoles('admin', 's_ta'),
  auditLog('change_requests', 'UPDATE'),
  async (req, res) => {
    try {
      const existing = await prisma.changeRequest.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Change request not found' });

      if (req.user.role !== 'admin' && existing.locationId !== req.user.locationId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const { status, notes, proposedDate, implementedAt, approvedById, approvedAt, linkedHazardIds } = req.body;

      // §5.51 — Block approval until linked hazard report has reached Risk_Assessed
      if (status === 'Approved') {
        let hazardIds = [];
        try { hazardIds = JSON.parse(existing.linkedHazardIds || '[]'); } catch { hazardIds = []; }
        if (hazardIds.length === 0) {
          return res.status(422).json({ error: 'Cannot approve: no linked hazard report found. A risk assessment (§5.51) must be completed first.' });
        }
        const hazards = await prisma.hazardReport.findMany({
          where: { id: { in: hazardIds } },
          select: { id: true, status: true },
        });
        const notAssessed = hazards.filter((h) => !SRM_STAGES_PAST_RISK_ASSESSED.includes(h.status));
        if (notAssessed.length > 0) {
          return res.status(422).json({ error: `Cannot approve: linked hazard report must reach Risk_Assessed stage before approval (§5.51). Current status: ${hazards[0]?.status || 'Unknown'}.` });
        }
      }

      const data = {};
      if (status !== undefined)          data.status = status;
      if (notes !== undefined)           data.notes = notes;
      if (proposedDate !== undefined)    data.proposedDate = proposedDate ? new Date(proposedDate) : null;
      if (implementedAt !== undefined)   data.implementedAt = implementedAt ? new Date(implementedAt) : null;
      if (approvedById !== undefined)    data.approvedById = approvedById || null;
      if (approvedAt !== undefined)      data.approvedAt = approvedAt ? new Date(approvedAt) : null;
      if (linkedHazardIds !== undefined) data.linkedHazardIds = JSON.stringify(linkedHazardIds);

      const updated = await prisma.changeRequest.update({
        where: { id: req.params.id },
        data,
        include: CHANGE_REQUEST_INCLUDE,
      });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// GET /api/change-requests/:id
router.get('/:id', authenticate, requireRoles('admin', 's_ta'), async (req, res) => {
  try {
    const changeRequest = await prisma.changeRequest.findUnique({
      where: { id: req.params.id },
      include: CHANGE_REQUEST_INCLUDE,
    });
    if (!changeRequest) return res.status(404).json({ error: 'Change request not found' });

    if (req.user.role !== 'admin' && changeRequest.locationId !== req.user.locationId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(changeRequest);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
