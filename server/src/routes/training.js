const router = require('express').Router();
const prisma = require('../utils/prisma');
const { authenticate, requireRoles } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');

// GET /api/training — admin/s_ta see all at their location; staff see only their own
router.get('/', authenticate, requireRoles('admin', 's_ta', 'staff'), async (req, res, next) => {
  try {
    const where = {};

    if (req.user.role === 'staff') {
      // Staff only see their own records
      where.userId = req.user.id;
    } else if (req.user.role === 's_ta') {
      // S_TA sees all records at their location
      where.locationId = req.user.locationId;
    }
    // admin: no filter (sees all)

    const records = await prisma.trainingRecord.findMany({
      where,
      include: {
        user:     { select: { id: true, name: true, role: true } },
        location: { select: { id: true, name: true } },
      },
      orderBy: { completedAt: 'desc' },
    });
    res.json(records);
  } catch (err) {
    next(err);
  }
});

// POST /api/training — s_ta/admin only
router.post('/', authenticate, requireRoles('admin', 's_ta'),
  auditLog('training_records', 'CREATE'),
  async (req, res, next) => {
    try {
      const {
        userId,
        locationId: bodyLocationId,
        trainingType,
        completedAt,
        expiresAt,
        deliveredBy,
        notes,
        documentUrl,
      } = req.body;

      // s_ta is scoped to their own location; admin may specify location in body
      const locationId = req.user.role === 'admin'
        ? (bodyLocationId || null)
        : req.user.locationId;

      const record = await prisma.trainingRecord.create({
        data: {
          userId,
          locationId,
          trainingType,
          completedAt:  completedAt ? new Date(completedAt) : new Date(),
          expiresAt:    expiresAt   ? new Date(expiresAt)   : null,
          deliveredBy:  deliveredBy || null,
          notes:        notes       || null,
          documentUrl:  documentUrl || null,
          createdById:  req.user.id,
        },
        include: {
          user:     { select: { id: true, name: true, role: true } },
          location: { select: { id: true, name: true } },
        },
      });
      res.status(201).json(record);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/training/:id — admin only
router.delete('/:id', authenticate, requireRoles('admin'),
  auditLog('training_records', 'DELETE'),
  async (req, res, next) => {
    try {
      const existing = await prisma.trainingRecord.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Training record not found' });

      await prisma.trainingRecord.delete({ where: { id: req.params.id } });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
