const router = require('express').Router();
const prisma = require('../utils/prisma');
const { authenticate, requireRoles } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');
const { calculateRisk } = require('../utils/riskMatrix');
const { notifyHighRisk } = require('../services/emailService');

// GET /api/risk-register
router.get('/', authenticate, requireRoles('admin', 's_ta', 'staff'), async (req, res) => {
  const { locationId, riskRating, regulatoryRef } = req.query;
  const where = {};

  if (req.user.role !== 'admin') {
    where.locationId = req.user.locationId;
  } else if (locationId) {
    where.locationId = locationId;
  }

  if (riskRating) where.riskRating = riskRating;
  if (regulatoryRef) where.regulatoryRefs = { contains: regulatoryRef };

  const items = await prisma.riskRegister.findMany({
    where,
    include: {
      location: true,
      responsibleUser: { select: { id: true, name: true, email: true } },
      riskAcceptedBy: { select: { id: true, name: true, role: true } },
    },
    orderBy: [{ riskRating: 'asc' }, { hazardIdLabel: 'asc' }],
  });
  res.json(items);
});

// POST /api/risk-register
router.post('/', authenticate, requireRoles('admin', 's_ta'),
  auditLog('risk_register', 'CREATE'),
  async (req, res) => {
    const {
      locationId, description, likelihood, consequence, controls,
      responsibleUserId, implementationDate, revisedLikelihood, revisedConsequence,
      regulatoryRefs, notes, dueDate,
    } = req.body;

    const targetLocationId = req.user.role === 'admin' ? locationId : req.user.locationId;
    if (!targetLocationId) return res.status(400).json({ error: 'locationId required' });

    // Auto-compute risk ratings
    const riskRating = calculateRisk(likelihood, consequence);
    const revisedRating = revisedLikelihood && revisedConsequence
      ? calculateRisk(revisedLikelihood, revisedConsequence)
      : null;

    // Auto-generate hazard ID label
    const count = await prisma.riskRegister.count({ where: { locationId: targetLocationId } });
    const hazardIdLabel = `H-${String(count + 1).padStart(3, '0')}`;

    const item = await prisma.riskRegister.create({
      data: {
        locationId: targetLocationId,
        hazardIdLabel,
        description,
        likelihood,
        consequence,
        riskRating,
        controls,
        responsibleUserId: responsibleUserId || null,
        implementationDate: implementationDate ? new Date(implementationDate) : null,
        revisedLikelihood: revisedLikelihood || null,
        revisedConsequence: revisedConsequence || null,
        revisedRating,
        regulatoryRefs: JSON.stringify(regulatoryRefs || []),
        notes,
        dueDate: dueDate ? new Date(dueDate) : null,
      },
      include: { location: true, responsibleUser: { select: { id: true, name: true } } },
    });

    if (['High', 'Critical'].includes(riskRating)) {
      notifyHighRisk(targetLocationId, item).catch(() => {});
    }

    res.status(201).json(item);
  }
);

// PUT /api/risk-register/:id
router.put('/:id', authenticate, requireRoles('admin', 's_ta'),
  auditLog('risk_register', 'UPDATE'),
  async (req, res) => {
    const existing = await prisma.riskRegister.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (req.user.role !== 'admin' && existing.locationId !== req.user.locationId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const {
      description, likelihood, consequence, controls, responsibleUserId,
      implementationDate, revisedLikelihood, revisedConsequence,
      regulatoryRefs, notes, dueDate,
      // §5.55 ALARP fields
      alarpJustification, riskAcceptedById, riskAcceptedAt, riskAcceptanceNotes,
    } = req.body;

    const riskRating = likelihood && consequence ? calculateRisk(likelihood, consequence) : existing.riskRating;
    const revisedRating = revisedLikelihood && revisedConsequence
      ? calculateRisk(revisedLikelihood, revisedConsequence)
      : null;

    // §5.55 — Validate risk acceptance authority
    const residualRating = revisedRating || existing.revisedRating;
    if (riskAcceptedById && residualRating) {
      const acceptor = await prisma.user.findUnique({ where: { id: riskAcceptedById }, select: { role: true, isAccountableExecutive: true } });
      if (residualRating === 'Critical' && !acceptor?.isAccountableExecutive) {
        return res.status(422).json({ error: 'Critical residual risk must be accepted by the Accountable Executive (§5.55).' });
      }
      if (residualRating === 'High' && acceptor?.role !== 'admin' && !acceptor?.isAccountableExecutive) {
        return res.status(422).json({ error: 'High residual risk must be accepted by Admin or the Accountable Executive (§5.55).' });
      }
    }

    const updated = await prisma.riskRegister.update({
      where: { id: req.params.id },
      data: {
        description, likelihood, consequence, riskRating, controls,
        responsibleUserId: responsibleUserId || null,
        implementationDate: implementationDate ? new Date(implementationDate) : null,
        revisedLikelihood: revisedLikelihood || null,
        revisedConsequence: revisedConsequence || null,
        revisedRating,
        regulatoryRefs: regulatoryRefs ? JSON.stringify(regulatoryRefs) : existing.regulatoryRefs,
        notes,
        dueDate: dueDate ? new Date(dueDate) : null,
        // §5.55 ALARP
        alarpJustification: alarpJustification !== undefined ? (alarpJustification || null) : existing.alarpJustification,
        riskAcceptedById: riskAcceptedById !== undefined ? (riskAcceptedById || null) : existing.riskAcceptedById,
        riskAcceptedAt: riskAcceptedAt !== undefined ? (riskAcceptedAt ? new Date(riskAcceptedAt) : null) : existing.riskAcceptedAt,
        riskAcceptanceNotes: riskAcceptanceNotes !== undefined ? (riskAcceptanceNotes || null) : existing.riskAcceptanceNotes,
      },
      include: {
        location: true,
        responsibleUser: { select: { id: true, name: true } },
        riskAcceptedBy: { select: { id: true, name: true, role: true } },
      },
    });
    res.json(updated);
  }
);

// DELETE /api/risk-register/:id — blocked for SRM records (§5.95)
router.delete('/:id', authenticate, requireRoles('admin'), async (req, res) => {
  return res.status(403).json({
    error: 'Risk register items are SRM records and must be retained indefinitely per FAA §5.95. Use archive instead of deletion.',
  });
});

module.exports = router;
