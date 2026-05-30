const router = require('express').Router();
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const prisma = require('../utils/prisma');
const { authenticate, requireRoles } = require('../middleware/auth');

const QR_DIR = path.join(__dirname, '../../public/qr');
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'http://localhost:4000';
// QR codes and form links must point to the React client, not the API server
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

// GET /api/qr — list all QR codes (admin only)
router.get('/', authenticate, requireRoles('admin', 's_ta'), async (req, res) => {
  const locations = await prisma.location.findMany({ orderBy: { name: 'asc' } });
  res.json(locations.map((l) => ({
    id: l.id,
    name: l.name,
    slug: l.slug,
    qrCodeUrl: l.qrCodeUrl,
    formUrl: `${CLIENT_URL}/report?location=${l.slug}`,
    qrImageUrl: `${PUBLIC_BASE_URL}/public/qr/${l.slug}.png`,
  })));
});

// POST /api/qr/generate — (re)generate all QR codes
router.post('/generate', authenticate, requireRoles('admin'), async (req, res) => {
  if (!fs.existsSync(QR_DIR)) fs.mkdirSync(QR_DIR, { recursive: true });

  const locations = await prisma.location.findMany();
  const results = [];

  for (const loc of locations) {
    const url = `${CLIENT_URL}/report?location=${loc.slug}`;
    const filePath = path.join(QR_DIR, `${loc.slug}.png`);
    await QRCode.toFile(filePath, url, { width: 400, margin: 2 });
    const qrCodeUrl = `/public/qr/${loc.slug}.png`;
    await prisma.location.update({ where: { id: loc.id }, data: { qrCodeUrl } });
    results.push({ name: loc.name, slug: loc.slug, qrCodeUrl });
  }

  res.json({ success: true, results });
});

// GET /api/qr/:slug/download — download QR code PNG
router.get('/:slug/download', authenticate, async (req, res) => {
  const filePath = path.join(QR_DIR, `${req.params.slug}.png`);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'QR code not found' });
  res.download(filePath, `gojump-qr-${req.params.slug}.png`);
});

module.exports = router;
