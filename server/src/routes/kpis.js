const router = require('express').Router();
const prisma = require('../utils/prisma');
const { authenticate, requireRoles } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');

function computeStatus(current, target) {
  if (current === null || current === undefined) return null;
  const ratio = current / target;
  if (ratio <= 1.0) return 'On_Target';
  if (ratio <= 1.2) return 'At_Risk';
  return 'Off_Target';
}

// GET /api/kpis
router.get('/', authenticate, requireRoles('admin', 's_ta', 'staff'), async (req, res) => {
  const { locationId } = req.query;
  const where = req.user.role === 'admin'
    ? (locationId ? { locationId } : {})
    : { locationId: req.user.locationId };

  const kpis = await prisma.kpi.findMany({ where, include: { location: true }, orderBy: { name: 'asc' } });
  res.json(kpis);
});

// POST /api/kpis
router.post('/', authenticate, requireRoles('admin', 's_ta'),
  auditLog('kpis', 'CREATE'),
  async (req, res) => {
    const { locationId, name, frequency, targetValue, measureMethod, regulatoryRefs } = req.body;
    const targetLocationId = req.user.role === 'admin' ? locationId : req.user.locationId;
    const kpi = await prisma.kpi.create({
      data: {
        locationId: targetLocationId,
        name, frequency, targetValue: Number(targetValue),
        measureMethod,
        regulatoryRefs: JSON.stringify(regulatoryRefs || []),
      },
    });
    res.status(201).json(kpi);
  }
);

// PUT /api/kpis/:id — update value or definition
router.put('/:id', authenticate, requireRoles('admin', 's_ta'),
  auditLog('kpis', 'UPDATE'),
  async (req, res) => {
    const existing = await prisma.kpi.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (req.user.role !== 'admin' && existing.locationId !== req.user.locationId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { name, frequency, targetValue, currentValue, measureMethod, regulatoryRefs } = req.body;
    const newCurrent = currentValue !== undefined ? Number(currentValue) : existing.currentValue;
    const newTarget = targetValue !== undefined ? Number(targetValue) : existing.targetValue;
    const status = computeStatus(newCurrent, newTarget);

    // Append history entry
    const history = JSON.parse(existing.history || '[]');
    if (currentValue !== undefined) {
      history.push({ date: new Date().toISOString(), value: newCurrent });
    }

    const updated = await prisma.kpi.update({
      where: { id: req.params.id },
      data: {
        name: name ?? existing.name,
        frequency: frequency ?? existing.frequency,
        targetValue: newTarget,
        currentValue: newCurrent,
        measureMethod: measureMethod ?? existing.measureMethod,
        regulatoryRefs: regulatoryRefs ? JSON.stringify(regulatoryRefs) : existing.regulatoryRefs,
        status,
        history: JSON.stringify(history),
      },
    });
    res.json(updated);
  }
);

// DELETE /api/kpis/:id — admin only
router.delete('/:id', authenticate, requireRoles('admin'), async (req, res) => {
  await prisma.kpi.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

module.exports = router;
