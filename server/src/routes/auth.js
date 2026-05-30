const router = require('express').Router();
const bcrypt = require('bcryptjs');
const prisma = require('../utils/prisma');
const { generateToken, authenticate } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: { location: true },
  });
  if (!user || !user.isActive) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const token = generateToken(user);

  // §5.95/§5.97 — log login event for audit trail
  prisma.auditLog.create({
    data: {
      userId: user.id, userRole: user.role,
      action: 'LOGIN', tableName: 'users', recordId: user.id,
      ipAddress: req.ip ?? null, locationId: user.locationId ?? null,
      newValue: JSON.stringify({ email: user.email, name: user.name }),
    },
  }).catch(() => {});

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      locationId: user.locationId,
      location: user.location,
      emailNotifications: user.emailNotifications,
    },
  });
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { location: true },
  });
  const { passwordHash, ...safeUser } = user;
  res.json(safeUser);
});

// PUT /api/auth/me — update own profile
router.put('/me', authenticate, async (req, res) => {
  const { name, emailNotifications, currentPassword, newPassword } = req.body;
  const updates = {};
  if (name) updates.name = name;
  if (typeof emailNotifications === 'boolean') updates.emailNotifications = emailNotifications;

  if (newPassword) {
    if (!currentPassword) return res.status(400).json({ error: 'Current password required' });
    const valid = await bcrypt.compare(currentPassword, req.user.passwordHash);
    if (!valid) return res.status(400).json({ error: 'Current password incorrect' });
    updates.passwordHash = await bcrypt.hash(newPassword, 12);
  }

  const updated = await prisma.user.update({ where: { id: req.user.id }, data: updates });
  const { passwordHash, ...safeUser } = updated;
  res.json(safeUser);
});

module.exports = router;
