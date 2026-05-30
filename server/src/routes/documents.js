const router = require('express').Router();
const prisma = require('../utils/prisma');
const { authenticate, requireRoles } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { auditLog } = require('../middleware/audit');

// GET /api/documents
router.get('/', authenticate, requireRoles('admin', 's_ta', 'staff'), async (req, res) => {
  const { locationId, status, type } = req.query;
  const where = { parentId: null }; // only top-level (latest versions)

  if (req.user.role !== 'admin') {
    where.OR = [{ locationId: req.user.locationId }, { locationId: null }];
  } else if (locationId === 'null') {
    where.locationId = null;
  } else if (locationId) {
    where.locationId = locationId;
  }

  if (status) where.status = status;
  if (type) where.type = type;

  const docs = await prisma.document.findMany({
    where,
    include: {
      location: true,
      approvedBy: { select: { id: true, name: true } },
      versions: { orderBy: { createdAt: 'desc' } },
    },
    orderBy: { updatedAt: 'desc' },
  });
  res.json(docs);
});

// POST /api/documents
router.post('/', authenticate, requireRoles('admin', 's_ta'),
  upload.single('file'),
  auditLog('documents', 'CREATE'),
  async (req, res) => {
    const { locationId, title, type, version, regulatoryRefs, effectiveDate } = req.body;
    const doc = await prisma.document.create({
      data: {
        locationId: locationId === 'null' || !locationId ? null : locationId,
        title,
        type,
        version: version || '1.0',
        fileUrl: req.file ? `/uploads/${req.file.filename}` : null,
        regulatoryRefs: regulatoryRefs || '[]',
        effectiveDate: effectiveDate ? new Date(effectiveDate) : null,
      },
      include: { location: true },
    });
    res.status(201).json(doc);
  }
);

// PUT /api/documents/:id/status — workflow transitions
router.put('/:id/status', authenticate, requireRoles('admin', 's_ta'),
  auditLog('documents', 'STATUS_CHANGE'),
  async (req, res) => {
    const { status } = req.body;
    const allowed = ['Draft', 'Pending_Approval', 'Approved', 'Superseded'];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const data = { status };
    if (status === 'Approved') {
      data.approvedById = req.user.id;
      data.effectiveDate = data.effectiveDate || new Date();
    }

    const updated = await prisma.document.update({ where: { id: req.params.id }, data });
    res.json(updated);
  }
);

// POST /api/documents/:id/version — upload new version
router.post('/:id/version', authenticate, requireRoles('admin', 's_ta'),
  upload.single('file'),
  async (req, res) => {
    const parent = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!parent) return res.status(404).json({ error: 'Not found' });

    // Increment version
    const parts = parent.version.split('.').map(Number);
    parts[1] = (parts[1] || 0) + 1;
    const newVersion = parts.join('.');

    // Supersede old doc
    await prisma.document.update({ where: { id: parent.id }, data: { status: 'Superseded' } });

    const newDoc = await prisma.document.create({
      data: {
        locationId: parent.locationId,
        title: parent.title,
        type: parent.type,
        version: newVersion,
        fileUrl: req.file ? `/uploads/${req.file.filename}` : parent.fileUrl,
        regulatoryRefs: parent.regulatoryRefs,
        parentId: parent.id,
      },
    });
    res.status(201).json(newDoc);
  }
);

// DELETE /api/documents/:id — admin only
router.delete('/:id', authenticate, requireRoles('admin'), async (req, res) => {
  await prisma.document.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

module.exports = router;
