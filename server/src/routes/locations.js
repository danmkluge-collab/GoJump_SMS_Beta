const router = require('express').Router();
const prisma = require('../utils/prisma');
const { authenticate, requireRoles } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');

// GET /api/locations — all locations (authenticated)
router.get('/', authenticate, async (req, res) => {
  const locations = await prisma.location.findMany({ orderBy: { name: 'asc' } });
  res.json(locations);
});

// GET /api/locations/slug/:slug — resolve by slug (must be before /:id)
router.get('/slug/:slug', async (req, res) => {
  const loc = await prisma.location.findUnique({ where: { slug: req.params.slug } });
  if (!loc) return res.status(404).json({ error: 'Location not found' });
  res.json({ id: loc.id, name: loc.name, slug: loc.slug });
});

// GET /api/locations/:id/accountable-executive — returns AE info for a location
router.get('/:id/accountable-executive', authenticate, async (req, res, next) => {
  try {
    const loc = await prisma.location.findUnique({
      where: { id: req.params.id },
      select: {
        id:                          true,
        name:                        true,
        accountableExecutiveUserId:  true,
        aeDesignationDate:           true,
        aeDesignationDocumentUrl:    true,
      },
    });
    if (!loc) return res.status(404).json({ error: 'Location not found' });

    let aeUser = null;
    if (loc.accountableExecutiveUserId) {
      aeUser = await prisma.user.findUnique({
        where: { id: loc.accountableExecutiveUserId },
        select: {
          id:                   true,
          name:                 true,
          email:                true,
          role:                 true,
          isAccountableExecutive: true,
          aeAuthorityStatement: true,
        },
      });
    }

    res.json({
      locationId:                  loc.id,
      locationName:                loc.name,
      accountableExecutiveUserId:  loc.accountableExecutiveUserId,
      aeDesignationDate:           loc.aeDesignationDate,
      aeDesignationDocumentUrl:    loc.aeDesignationDocumentUrl,
      accountableExecutive:        aeUser,
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/locations/:id/accountable-executive — admin only
router.put('/:id/accountable-executive', authenticate, requireRoles('admin'),
  auditLog('locations', 'AE_DESIGNATION_CHANGE'),
  async (req, res, next) => {
    try {
      const { userId, aeDesignationDate, aeAuthorityStatement } = req.body;

      const loc = await prisma.location.findUnique({ where: { id: req.params.id } });
      if (!loc) return res.status(404).json({ error: 'Location not found' });

      // If there is a previous AE, clear their flag
      if (loc.accountableExecutiveUserId && loc.accountableExecutiveUserId !== userId) {
        await prisma.user.update({
          where: { id: loc.accountableExecutiveUserId },
          data:  { isAccountableExecutive: false },
        });
      }

      // Set the new AE's flag and authority statement
      await prisma.user.update({
        where: { id: userId },
        data: {
          isAccountableExecutive: true,
          aeAuthorityStatement:   aeAuthorityStatement || null,
        },
      });

      // Update the location
      const updated = await prisma.location.update({
        where: { id: req.params.id },
        data: {
          accountableExecutiveUserId: userId,
          aeDesignationDate:          aeDesignationDate ? new Date(aeDesignationDate) : null,
        },
      });

      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/locations/:id
router.get('/:id', authenticate, async (req, res) => {
  const loc = await prisma.location.findUnique({ where: { id: req.params.id } });
  if (!loc) return res.status(404).json({ error: 'Location not found' });
  res.json(loc);
});

// PUT /api/locations/:id — admin only
router.put('/:id', authenticate, requireRoles('admin'), async (req, res) => {
  const { name, timezone, address } = req.body;
  const updated = await prisma.location.update({
    where: { id: req.params.id },
    data: { name, timezone, address },
  });
  res.json(updated);
});

module.exports = router;
