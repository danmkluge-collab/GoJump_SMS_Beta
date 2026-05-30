const router = require('express').Router();
const bcrypt = require('bcryptjs');
const prisma = require('../utils/prisma');
const { authenticate, requireRoles } = require('../middleware/auth');

// GET /api/users — admin sees all, s_ta sees their location
router.get('/', authenticate, requireRoles('admin', 's_ta', 'staff'), async (req, res) => {
  const where = req.user.role === 'admin' ? {} : { locationId: req.user.locationId };
  if (req.query.locationId) where.locationId = req.query.locationId;
  const users = await prisma.user.findMany({
    where,
    select: { id: true, name: true, email: true, role: true, locationId: true, isActive: true, location: true, createdAt: true },
    orderBy: { name: 'asc' },
  });
  res.json(users);
});

// POST /api/users — admin only
router.post('/', authenticate, requireRoles('admin'), async (req, res) => {
  const { name, email, password, role, locationId } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'name, email, password, and role are required' });
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { name, email: email.toLowerCase().trim(), passwordHash, role, locationId: locationId || null },
    select: { id: true, name: true, email: true, role: true, locationId: true, isActive: true },
  });
  res.status(201).json(user);
});

// PUT /api/users/:id — admin only
router.put('/:id', authenticate, requireRoles('admin'), async (req, res) => {
  const { name, email, role, locationId, isActive, password } = req.body;
  const data = { name, email: email?.toLowerCase().trim(), role, locationId: locationId || null, isActive };
  if (password) data.passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data,
    select: { id: true, name: true, email: true, role: true, locationId: true, isActive: true },
  });
  res.json(user);
});

// DELETE /api/users/:id — soft delete
router.delete('/:id', authenticate, requireRoles('admin'), async (req, res) => {
  await prisma.user.update({ where: { id: req.params.id }, data: { isActive: false } });
  res.json({ success: true });
});

module.exports = router;
