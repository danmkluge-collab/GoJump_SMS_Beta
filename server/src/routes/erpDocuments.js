const router = require('express').Router();
const prisma = require('../utils/prisma');
const { authenticate, requireRoles } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');

// GET /api/erp-documents
router.get('/', authenticate, requireRoles('admin', 's_ta', 'staff'), async (req, res) => {
  try {
    const { locationId } = req.query;

    const targetLocationId = req.user.role === 'admin'
      ? (locationId || null)
      : req.user.locationId;

    if (!targetLocationId) {
      return res.status(400).json({ error: 'locationId is required' });
    }

    const document = await prisma.erpDocument.findFirst({
      where: { locationId: targetLocationId },
      orderBy: { createdAt: 'desc' },
    });

    res.json(document ?? null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/erp-documents
router.post('/', authenticate, requireRoles('admin', 's_ta'),
  auditLog('erp_documents', 'CREATE'),
  async (req, res) => {
    try {
      const { locationId: bodyLocationId, title, version, status, effectiveDate } = req.body;

      if (!title) return res.status(400).json({ error: 'title is required' });

      const targetLocationId = (req.user.role === 'admin' && bodyLocationId)
        ? bodyLocationId
        : req.user.locationId;

      if (!targetLocationId) {
        return res.status(400).json({ error: 'locationId is required' });
      }

      const document = await prisma.erpDocument.create({
        data: {
          locationId: targetLocationId,
          title,
          version: version || null,
          status: status || 'Draft',
          effectiveDate: effectiveDate ? new Date(effectiveDate) : null,
          createdById: req.user.id,
        },
      });

      res.status(201).json(document);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// PUT /api/erp-documents/:id
router.put('/:id', authenticate, requireRoles('admin', 's_ta'),
  auditLog('erp_documents', 'UPDATE'),
  async (req, res) => {
    try {
      const existing = await prisma.erpDocument.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'ERP document not found' });

      if (req.user.role !== 'admin' && existing.locationId !== req.user.locationId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const { title, version, status, effectiveDate } = req.body;

      const data = {};
      if (title !== undefined)         data.title = title;
      if (version !== undefined)       data.version = version || null;
      if (status !== undefined)        data.status = status;
      if (effectiveDate !== undefined) data.effectiveDate = effectiveDate ? new Date(effectiveDate) : null;

      const updated = await prisma.erpDocument.update({
        where: { id: req.params.id },
        data,
      });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

module.exports = router;
