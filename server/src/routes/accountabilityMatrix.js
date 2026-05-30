const router = require('express').Router();
const prisma = require('../utils/prisma');
const { authenticate, requireRoles } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');

// GET /api/accountability-matrix — admin, s_ta, staff
router.get('/', authenticate, requireRoles('admin', 's_ta', 'staff'), async (req, res, next) => {
  try {
    const { locationId } = req.query;
    const where = {};
    if (locationId) where.locationId = locationId;

    const records = await prisma.safetyAccountability.findMany({
      where,
      orderBy: { position: 'asc' },
    });
    res.json(records);
  } catch (err) {
    next(err);
  }
});

// POST /api/accountability-matrix — admin only
router.post('/', authenticate, requireRoles('admin'),
  auditLog('safety_accountability', 'CREATE'),
  async (req, res, next) => {
    try {
      const { locationId, position, smsRole, responsibilities, authority } = req.body;
      const record = await prisma.safetyAccountability.create({
        data: {
          locationId:       locationId || null,
          position,
          smsRole,
          responsibilities,
          authority,
        },
      });
      res.status(201).json(record);
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/accountability-matrix/:id — admin only
router.put('/:id', authenticate, requireRoles('admin'),
  auditLog('safety_accountability', 'UPDATE'),
  async (req, res, next) => {
    try {
      const { locationId, position, smsRole, responsibilities, authority } = req.body;
      const existing = await prisma.safetyAccountability.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Record not found' });

      const updated = await prisma.safetyAccountability.update({
        where: { id: req.params.id },
        data: {
          locationId:       locationId !== undefined ? (locationId || null) : existing.locationId,
          position:         position         ?? existing.position,
          smsRole:          smsRole          ?? existing.smsRole,
          responsibilities: responsibilities ?? existing.responsibilities,
          authority:        authority        ?? existing.authority,
        },
      });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/accountability-matrix/:id — admin only
router.delete('/:id', authenticate, requireRoles('admin'),
  auditLog('safety_accountability', 'DELETE'),
  async (req, res, next) => {
    try {
      const existing = await prisma.safetyAccountability.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Record not found' });

      await prisma.safetyAccountability.delete({ where: { id: req.params.id } });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
