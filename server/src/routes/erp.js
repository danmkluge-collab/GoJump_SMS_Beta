const router = require('express').Router();
const prisma = require('../utils/prisma');
const { authenticate, requireRoles } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');

// GET /api/erp/exercises
router.get('/exercises', authenticate, requireRoles('admin', 's_ta', 'staff'), async (req, res) => {
  const { locationId } = req.query;
  const where = req.user.role === 'admin'
    ? (locationId ? { locationId } : {})
    : { locationId: req.user.locationId };

  const exercises = await prisma.erpExercise.findMany({
    where,
    include: { location: true },
    orderBy: { date: 'desc' },
  });
  res.json(exercises);
});

// POST /api/erp/exercises
router.post('/exercises', authenticate, requireRoles('admin', 's_ta'),
  auditLog('erp_exercises', 'CREATE'),
  async (req, res) => {
    const { locationId, date, type, participants, notes } = req.body;
    const targetLocationId = req.user.role === 'admin' ? locationId : req.user.locationId;
    const exercise = await prisma.erpExercise.create({
      data: {
        locationId: targetLocationId,
        date: new Date(date),
        type,
        participants: JSON.stringify(Array.isArray(participants) ? participants : (participants ? [participants] : [])),
        notes,
      },
      include: { location: true },
    });
    res.status(201).json(exercise);
  }
);

// GET /api/erp/contacts
router.get('/contacts', authenticate, requireRoles('admin', 's_ta', 'staff'), async (req, res) => {
  const { locationId } = req.query;
  const where = req.user.role === 'admin'
    ? (locationId ? { locationId } : {})
    : { locationId: req.user.locationId };

  const contacts = await prisma.erpContact.findMany({
    where,
    include: { location: true },
    orderBy: { priority: 'asc' },
  });
  res.json(contacts);
});

// POST /api/erp/contacts
router.post('/contacts', authenticate, requireRoles('admin', 's_ta'),
  auditLog('erp_contacts', 'CREATE'),
  async (req, res) => {
    const { locationId, role, name, phone, email, priority } = req.body;
    const targetLocationId = req.user.role === 'admin' ? locationId : req.user.locationId;
    const contact = await prisma.erpContact.create({
      data: { locationId: targetLocationId, role, name, phone, email, priority: Number(priority) || 0 },
      include: { location: true },
    });
    res.status(201).json(contact);
  }
);

// PUT /api/erp/contacts/:id
router.put('/contacts/:id', authenticate, requireRoles('admin', 's_ta'), async (req, res) => {
  const { role, name, phone, email, priority } = req.body;
  const updated = await prisma.erpContact.update({
    where: { id: req.params.id },
    data: { role, name, phone, email, priority: Number(priority) || 0 },
  });
  res.json(updated);
});

// DELETE /api/erp/contacts/:id
router.delete('/contacts/:id', authenticate, requireRoles('admin', 's_ta'), async (req, res) => {
  await prisma.erpContact.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

// GET /api/erp/status — check if ERP exercise is overdue
router.get('/status', authenticate, requireRoles('admin', 's_ta', 'staff'), async (req, res) => {
  const { locationId } = req.query;
  const locId = req.user.role === 'admin' ? locationId : req.user.locationId;
  if (!locId) return res.status(400).json({ error: 'locationId required' });

  const last = await prisma.erpExercise.findFirst({
    where: { locationId: locId },
    orderBy: { date: 'desc' },
  });

  const SIX_MONTHS_MS = 180 * 24 * 60 * 60 * 1000;
  const overdue = !last || (Date.now() - new Date(last.date).getTime()) > SIX_MONTHS_MS;
  const daysSinceLast = last
    ? Math.floor((Date.now() - new Date(last.date).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  res.json({ overdue, lastExercise: last, daysSinceLast });
});

module.exports = router;
