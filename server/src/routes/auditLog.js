const router = require('express').Router();
const prisma = require('../utils/prisma');
const { authenticate, requireRoles } = require('../middleware/auth');

// GET /api/audit-log — read-only, admin and s_ta only
router.get('/', authenticate, requireRoles('admin', 's_ta'), async (req, res) => {
  const { locationId, tableName, action, userId, from, to, page = 1, limit = 100 } = req.query;
  const where = {};

  if (req.user.role !== 'admin') {
    where.locationId = req.user.locationId;
  } else if (locationId) {
    where.locationId = locationId;
  }

  if (tableName) where.tableName = tableName;
  if (action) where.action = action;
  if (userId) where.userId = userId;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
    }),
  ]);

  res.json({ total, page: Number(page), limit: Number(limit), data: logs });
});

module.exports = router;
