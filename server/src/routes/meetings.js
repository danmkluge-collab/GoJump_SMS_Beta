const router = require('express').Router();
const prisma = require('../utils/prisma');
const { authenticate, requireRoles } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');

router.get('/', authenticate, requireRoles('admin', 's_ta', 'staff'), async (req, res) => {
  const { locationId } = req.query;
  const where = req.user.role === 'admin'
    ? (locationId ? { locationId } : {})
    : { locationId: req.user.locationId };

  const meetings = await prisma.meeting.findMany({
    where,
    include: { location: true },
    orderBy: { date: 'desc' },
  });
  res.json(meetings);
});

router.post('/', authenticate, requireRoles('admin', 's_ta'),
  auditLog('meetings', 'CREATE'),
  async (req, res) => {
    const { locationId, date, attendees, agenda, notes, actionItems } = req.body;
    const targetLocationId = req.user.role === 'admin' ? locationId : req.user.locationId;
    const meeting = await prisma.meeting.create({
      data: {
        locationId: targetLocationId,
        date: new Date(date),
        attendees: JSON.stringify(Array.isArray(attendees) ? attendees : [attendees]),
        agenda,
        notes,
        actionItems: actionItems ? JSON.stringify(actionItems) : JSON.stringify([]),
      },
      include: { location: true },
    });
    res.status(201).json(meeting);
  }
);

router.put('/:id', authenticate, requireRoles('admin', 's_ta'),
  auditLog('meetings', 'UPDATE'),
  async (req, res) => {
    const { date, attendees, agenda, notes, actionItems } = req.body;
    const existing = await prisma.meeting.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (req.user.role !== 'admin' && existing.locationId !== req.user.locationId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const updated = await prisma.meeting.update({
      where: { id: req.params.id },
      data: {
        date: date ? new Date(date) : existing.date,
        attendees: attendees ? JSON.stringify(Array.isArray(attendees) ? attendees : [attendees]) : existing.attendees,
        agenda: agenda ?? existing.agenda,
        notes: notes ?? existing.notes,
        actionItems: actionItems ? JSON.stringify(actionItems) : existing.actionItems,
      },
      include: { location: true },
    });
    res.json(updated);
  }
);

router.delete('/:id', authenticate, requireRoles('admin', 's_ta'), async (req, res) => {
  await prisma.meeting.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

module.exports = router;
