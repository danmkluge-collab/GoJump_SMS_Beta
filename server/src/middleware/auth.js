const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('[FATAL] JWT_SECRET environment variable is not set. Refusing to start.');
}

exports.authenticate = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = header.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: payload.sub }, include: { location: true } });
    if (!user || !user.isActive) return res.status(401).json({ error: 'Invalid or inactive account' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

exports.requireRoles = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
};

// Middleware that enforces location scoping for non-admin users
exports.scopeToLocation = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  if (req.user.role === 'admin') return next(); // admin sees all
  const locationId = req.query.locationId || req.body.locationId || req.params.locationId;
  if (locationId && locationId !== req.user.locationId) {
    return res.status(403).json({ error: 'Access restricted to your assigned location' });
  }
  // Inject user's locationId for queries
  req.scopedLocationId = req.user.locationId;
  next();
};

exports.generateToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role, locationId: user.locationId }, JWT_SECRET, { expiresIn: '8h' });
