const router = require('express').Router();
const prisma = require('../utils/prisma');
const { authenticate, requireRoles } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');

router.get('/', authenticate, requireRoles('admin', 's_ta', 'staff'), async (req, res) => {
  const { locationId, status } = req.query;
  const where = req.user.role === 'admin'
    ? (locationId ? { locationId } : {})
    : { locationId: req.user.locationId };

  if (status) where.status = status;

  const items = await prisma.auditItem.findMany({
    where,
    include: { location: true },
    orderBy: { scheduledDate: 'asc' },
  });
  res.json(items);
});

router.post('/', authenticate, requireRoles('admin', 's_ta'),
  auditLog('audit_items', 'CREATE'),
  async (req, res) => {
    const {
      locationId, title, description, checklistItems, scheduledDate,
      frequency, regulatoryRefs,
    } = req.body;
    const targetLocationId = req.user.role === 'admin' ? locationId : req.user.locationId;
    const item = await prisma.auditItem.create({
      data: {
        locationId: targetLocationId,
        title,
        description,
        checklistItems: checklistItems ? JSON.stringify(checklistItems) : JSON.stringify([]),
        scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
        frequency,
        regulatoryRefs: JSON.stringify(regulatoryRefs || []),
      },
      include: { location: true },
    });
    res.status(201).json(item);
  }
);

router.put('/:id', authenticate, requireRoles('admin', 's_ta'),
  auditLog('audit_items', 'UPDATE'),
  async (req, res) => {
    const existing = await prisma.auditItem.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (req.user.role !== 'admin' && existing.locationId !== req.user.locationId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const {
      title, description, checklistItems, status, scheduledDate,
      completedDate, findings, correctiveActions, regulatoryRefs,
    } = req.body;

    const updated = await prisma.auditItem.update({
      where: { id: req.params.id },
      data: {
        title: title ?? existing.title,
        description: description ?? existing.description,
        checklistItems: checklistItems ? JSON.stringify(checklistItems) : existing.checklistItems,
        status: status ?? existing.status,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : existing.scheduledDate,
        completedDate: completedDate ? new Date(completedDate) : existing.completedDate,
        findings: findings ?? existing.findings,
        correctiveActions: correctiveActions ? JSON.stringify(correctiveActions) : existing.correctiveActions,
        regulatoryRefs: regulatoryRefs ? JSON.stringify(regulatoryRefs) : existing.regulatoryRefs,
      },
      include: { location: true },
    });
    res.json(updated);
  }
);

router.delete('/:id', authenticate, requireRoles('admin'), async (req, res) => {
  await prisma.auditItem.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

module.exports = router;
