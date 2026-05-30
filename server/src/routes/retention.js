const router = require('express').Router();
const { authenticate, requireRoles } = require('../middleware/auth');
const { getRetentionSummary, archiveRecord } = require('../services/retentionService');
const { auditLog } = require('../middleware/audit');

// GET /api/retention/summary — admin only
router.get('/summary', authenticate, requireRoles('admin'), async (req, res) => {
  try {
    const summary = await getRetentionSummary();
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/retention/archive — archive a record (admin only)
router.post('/archive', authenticate, requireRoles('admin'),
  auditLog('retention', 'ARCHIVE'),
  async (req, res) => {
    const { modelName, recordId, reason } = req.body;
    if (!modelName || !recordId) {
      return res.status(400).json({ error: 'modelName and recordId are required' });
    }
    const error = await archiveRecord(modelName, recordId, reason);
    if (error) return res.status(422).json({ error });
    res.json({ success: true });
  }
);

module.exports = router;
