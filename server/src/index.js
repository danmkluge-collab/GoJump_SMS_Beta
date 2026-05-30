require('dotenv').config();
require('express-async-errors');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const cron = require('node-cron');
const { logger } = require('./utils/logger');
const { errorHandler } = require('./middleware/errorHandler');
const { scheduleOverdueNotifications } = require('./services/notificationScheduler');
const emailSvc = require('./services/emailService');
const { transformResponse } = require('./utils/transformResponse');

// Routes
const authRoutes = require('./routes/auth');
const locationRoutes = require('./routes/locations');
const userRoutes = require('./routes/users');
const hazardReportRoutes = require('./routes/hazardReports');
const riskRegisterRoutes = require('./routes/riskRegister');
const incidentRoutes = require('./routes/incidents');
const documentRoutes = require('./routes/documents');
const kpiRoutes = require('./routes/kpis');
const meetingRoutes = require('./routes/meetings');
const erpRoutes = require('./routes/erp');
const notificationRoutes = require('./routes/notifications');
const auditLogRoutes = require('./routes/auditLog');
const dashboardRoutes = require('./routes/dashboard');
const qrRoutes = require('./routes/qr');
const auditItemRoutes = require('./routes/auditItems');
const accountabilityRoutes = require('./routes/accountabilityMatrix');
const trainingRoutes = require('./routes/training');
const safetyBulletinsRoutes = require('./routes/safetyBulletins');
const interfacingOrgsRoutes = require('./routes/interfacingOrgs');
const changeRequestRoutes  = require('./routes/changeRequests');
const erpDocumentRoutes    = require('./routes/erpDocuments');
const retentionRoutes      = require('./routes/retention');

const app = express();
const PORT = process.env.PORT || 4000;

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({
  origin: [process.env.CLIENT_URL || 'http://localhost:3000', /localhost:\d+/],
  credentials: true,
}));

// Rate limiting
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500 });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
app.use('/api/auth', authLimiter);
app.use('/api', apiLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Transform SQLite JSON string fields back to arrays for all API responses
app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (data) => originalJson(transformResponse(data));
  next();
});

// Static files (QR codes, uploads)
app.use('/public', express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/hazard-reports', hazardReportRoutes);
app.use('/api/risk-register', riskRegisterRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/kpis', kpiRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/erp', erpRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/audit-log', auditLogRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/qr', qrRoutes);
app.use('/api/audit-items', auditItemRoutes);
app.use('/api/accountability', accountabilityRoutes);
app.use('/api/training', trainingRoutes);
app.use('/api/safety-bulletins', safetyBulletinsRoutes);
app.use('/api/interfacing-orgs', interfacingOrgsRoutes);
app.use('/api/change-requests', changeRequestRoutes);
app.use('/api/erp-documents',   erpDocumentRoutes);
app.use('/api/retention',       retentionRoutes);

// Error handler (must be last)
app.use(errorHandler);

// Daily 08:00 — overdue action digest
cron.schedule('0 8 * * *', () => {
  logger.info('Running daily overdue notification check');
  scheduleOverdueNotifications().catch((e) => logger.error('Cron error:', e));
});

// Daily 06:00 — trend analysis alert (§5.91 / Gap 14)
cron.schedule('0 6 * * *', () => {
  logger.info('Running daily trend analysis check');
  emailSvc.checkTrends().catch((e) => logger.error('Trend cron error:', e));
});

app.listen(PORT, () => {
  logger.info(`GoJump SMS server running on port ${PORT}`);
});

module.exports = app;
