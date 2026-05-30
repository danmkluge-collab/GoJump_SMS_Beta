const router = require('express').Router();
const prisma = require('../utils/prisma');
const { authenticate, requireRoles } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');

// GET /api/interfacing-orgs — admin/s_ta — list orgs for user's location (or ?locationId= for admin)
router.get('/', authenticate, requireRoles('admin', 's_ta'), async (req, res, next) => {
  try {
    const where = {};

    if (req.user.role === 'admin') {
      if (req.query.locationId) where.locationId = req.query.locationId;
    } else {
      where.locationId = req.user.locationId;
    }

    const orgs = await prisma.interfacingOrganization.findMany({
      where,
      orderBy: { name: 'asc' },
    });
    res.json(orgs);
  } catch (err) {
    next(err);
  }
});

// POST /api/interfacing-orgs — s_ta/admin — create InterfacingOrganization
router.post('/', authenticate, requireRoles('admin', 's_ta'),
  auditLog('interfacing_organizations', 'CREATE'),
  async (req, res, next) => {
    try {
      const {
        name,
        type,
        contactName,
        contactEmail,
        contactPhone,
        address,
        notes,
        locationId: bodyLocationId,
      } = req.body;

      const locationId = req.user.role === 'admin'
        ? (bodyLocationId || null)
        : req.user.locationId;

      const org = await prisma.interfacingOrganization.create({
        data: {
          name,
          type:         type         || null,
          contactName:  contactName  || null,
          contactEmail: contactEmail || null,
          contactPhone: contactPhone || null,
          address:      address      || null,
          notes:        notes        || null,
          locationId,
        },
      });
      res.status(201).json(org);
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/interfacing-orgs/:id — s_ta/admin — update org
router.put('/:id', authenticate, requireRoles('admin', 's_ta'),
  auditLog('interfacing_organizations', 'UPDATE'),
  async (req, res, next) => {
    try {
      const existing = await prisma.interfacingOrganization.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Organization not found' });

      // s_ta can only update orgs at their own location
      if (req.user.role === 's_ta' && existing.locationId !== req.user.locationId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const {
        name,
        type,
        contactName,
        contactEmail,
        contactPhone,
        address,
        notes,
      } = req.body;

      const updated = await prisma.interfacingOrganization.update({
        where: { id: req.params.id },
        data: {
          name:         name         ?? existing.name,
          type:         type         !== undefined ? (type         || null) : existing.type,
          contactName:  contactName  !== undefined ? (contactName  || null) : existing.contactName,
          contactEmail: contactEmail !== undefined ? (contactEmail || null) : existing.contactEmail,
          contactPhone: contactPhone !== undefined ? (contactPhone || null) : existing.contactPhone,
          address:      address      !== undefined ? (address      || null) : existing.address,
          notes:        notes        !== undefined ? (notes        || null) : existing.notes,
        },
      });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/interfacing-orgs/:id/notify — s_ta/admin — create HazardNotification record
router.post('/:id/notify', authenticate, requireRoles('admin', 's_ta'),
  auditLog('hazard_notifications', 'CREATE'),
  async (req, res, next) => {
    try {
      const org = await prisma.interfacingOrganization.findUnique({ where: { id: req.params.id } });
      if (!org) return res.status(404).json({ error: 'Organization not found' });

      if (req.user.role === 's_ta' && org.locationId !== req.user.locationId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const { hazardReportId, notificationMethod, summary } = req.body;

      const notification = await prisma.hazardNotification.create({
        data: {
          organizationId:     req.params.id,
          hazardReportId:     hazardReportId     || null,
          notificationMethod: notificationMethod || null,
          summary:            summary            || null,
          sentById:           req.user.id,
          sentAt:             new Date(),
        },
      });
      res.status(201).json(notification);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
