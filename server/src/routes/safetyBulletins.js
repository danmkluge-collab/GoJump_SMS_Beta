const router = require('express').Router();
const prisma = require('../utils/prisma');
const { authenticate, requireRoles } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');

// GET /api/safety-bulletins — all authenticated; Published always visible; Draft only for s_ta/admin
router.get('/', authenticate, requireRoles('admin', 's_ta', 'staff'), async (req, res, next) => {
  try {
    const canSeeDrafts = req.user.role === 'admin' || req.user.role === 's_ta';

    const where = canSeeDrafts
      ? { status: { in: ['Published', 'Draft'] } }
      : { status: 'Published' };

    const bulletins = await prisma.safetyBulletin.findMany({
      where,
      include: {
        sourceLocation: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(bulletins);
  } catch (err) {
    next(err);
  }
});

// POST /api/safety-bulletins — s_ta/admin
router.post('/', authenticate, requireRoles('admin', 's_ta'),
  auditLog('safety_bulletins', 'CREATE'),
  async (req, res, next) => {
    try {
      const {
        title,
        type,
        summary,
        content,
        linkedHazardId,
        regulatoryRefs,
        sourceLocationId: bodySourceLocationId,
      } = req.body;

      const sourceLocationId = req.user.role === 'admin'
        ? (bodySourceLocationId || null)
        : req.user.locationId;

      // Auto-generate bulletinNumber as "SB-YYYY-NNN"
      const year = new Date().getFullYear();
      const count = await prisma.safetyBulletin.count();
      const seq = String(count + 1).padStart(3, '0');
      const bulletinNumber = `SB-${year}-${seq}`;

      const bulletin = await prisma.safetyBulletin.create({
        data: {
          bulletinNumber,
          title,
          type,
          summary,
          content,
          linkedHazardId:  linkedHazardId || null,
          regulatoryRefs:  regulatoryRefs ? JSON.stringify(regulatoryRefs) : JSON.stringify([]),
          sourceLocationId,
          status:          'Draft',
          createdById:     req.user.id,
        },
        include: {
          sourceLocation: { select: { id: true, name: true } },
        },
      });
      res.status(201).json(bulletin);
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/safety-bulletins/:id/publish — s_ta/admin — publish and notify all active users
router.put('/:id/publish', authenticate, requireRoles('admin', 's_ta'),
  auditLog('safety_bulletins', 'PUBLISH'),
  async (req, res, next) => {
    try {
      const existing = await prisma.safetyBulletin.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Bulletin not found' });

      const bulletin = await prisma.safetyBulletin.update({
        where: { id: req.params.id },
        data: {
          status:          'Published',
          publishedAt:     new Date(),
          publishedById:   req.user.id,
        },
        include: {
          sourceLocation: { select: { id: true, name: true } },
        },
      });

      // Create Notification records for all active users
      const activeUsers = await prisma.user.findMany({
        where: { isActive: true },
        select: { id: true },
      });

      if (activeUsers.length > 0) {
        await prisma.notification.createMany({
          data: activeUsers.map((u) => ({
            userId:  u.id,
            message: `New Safety Bulletin published: ${bulletin.title} (${bulletin.bulletinNumber})`,
            link:    '/safety-bulletins',
            isRead:  false,
          })),
        });
      }

      res.json(bulletin);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/safety-bulletins/:id/acknowledge — any authenticated — append user to acknowledgedBy
router.post('/:id/acknowledge', authenticate, requireRoles('admin', 's_ta', 'staff'), async (req, res, next) => {
  try {
    const existing = await prisma.safetyBulletin.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Bulletin not found' });

    let acknowledgedBy = [];
    try {
      acknowledgedBy = existing.acknowledgedBy ? JSON.parse(existing.acknowledgedBy) : [];
    } catch {
      acknowledgedBy = [];
    }

    if (!acknowledgedBy.includes(req.user.id)) {
      acknowledgedBy.push(req.user.id);
    }

    const updated = await prisma.safetyBulletin.update({
      where: { id: req.params.id },
      data: { acknowledgedBy: JSON.stringify(acknowledgedBy) },
      include: {
        sourceLocation: { select: { id: true, name: true } },
      },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// PUT /api/safety-bulletins/:id — s_ta/admin — update draft bulletin fields
router.put('/:id', authenticate, requireRoles('admin', 's_ta'),
  auditLog('safety_bulletins', 'UPDATE'),
  async (req, res, next) => {
    try {
      const existing = await prisma.safetyBulletin.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Bulletin not found' });

      const { title, summary, content, type, regulatoryRefs } = req.body;

      const updated = await prisma.safetyBulletin.update({
        where: { id: req.params.id },
        data: {
          title:          title          ?? existing.title,
          summary:        summary        ?? existing.summary,
          content:        content        ?? existing.content,
          type:           type           ?? existing.type,
          regulatoryRefs: regulatoryRefs !== undefined
            ? JSON.stringify(regulatoryRefs)
            : existing.regulatoryRefs,
        },
        include: {
          sourceLocation: { select: { id: true, name: true } },
        },
      });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
