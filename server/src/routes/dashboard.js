const router = require('express').Router();
const prisma = require('../utils/prisma');
const { authenticate, requireRoles } = require('../middleware/auth');

function getLocationFilter(user, locationId) {
  if (user.role === 'admin' && locationId) return locationId;
  if (user.role === 'admin') return null;
  return user.locationId;
}

// GET /api/dashboard/overview
router.get('/overview', authenticate, requireRoles('admin', 's_ta', 'staff'), async (req, res) => {
  const locId = getLocationFilter(req.user, req.query.locationId);
  const where = locId ? { locationId: locId } : {};

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const [
    openHazards,
    resolvedThisMonth,
    criticalHighOpen,
    totalReportsThisMonth,
    totalReportsLastMonth,
    openIncidents,
    closedIncidentsThisMonth,
    overdueActions,
    lastErpExercise,
    trendData,
    typeBreakdown,
    severityBreakdown,
    recentReports,
  ] = await Promise.all([
    prisma.hazardReport.count({ where: { ...where, status: { not: 'Closed' } } }),
    prisma.hazardReport.count({ where: { ...where, status: 'Closed', updatedAt: { gte: startOfMonth } } }),
    prisma.riskRegister.count({ where: { ...where, riskRating: { in: ['High', 'Critical'] } } }),
    prisma.hazardReport.count({ where: { ...where, createdAt: { gte: startOfMonth } } }),
    prisma.hazardReport.count({ where: { ...where, createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } } }),
    prisma.incident.count({ where: { ...where, status: { notIn: ['Closed'] } } }),
    prisma.incident.count({ where: { ...where, status: 'Closed', closedAt: { gte: startOfMonth } } }),
    prisma.incident.count({
      where: {
        ...where,
        status: { notIn: ['Closed'] },
        followUpDate: { lt: now },
        followUpDate: { not: null, lt: now },
      },
    }),
    locId
      ? prisma.erpExercise.findFirst({ where: { locationId: locId }, orderBy: { date: 'desc' } })
      : null,
    // Trend: reports per day for last 30 days
    prisma.hazardReport.findMany({
      where: { ...where, createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true, type: true, severity: true },
    }),
    // Type breakdown
    prisma.hazardReport.groupBy({
      by: ['type'],
      where: { ...where, createdAt: { gte: ninetyDaysAgo } },
      _count: { id: true },
    }),
    // Severity breakdown
    prisma.hazardReport.groupBy({
      by: ['severity'],
      where,
      _count: { id: true },
    }),
    // Recent reports
    prisma.hazardReport.findMany({
      where,
      include: { location: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ]);

  // Calculate average days to close
  const closedIncidents = await prisma.incident.findMany({
    where: { ...where, status: 'Closed', closedAt: { not: null } },
    select: { createdAt: true, closedAt: true },
  });
  const avgDaysToClose = closedIncidents.length > 0
    ? Math.round(
        closedIncidents.reduce((sum, i) => sum + (i.closedAt - i.createdAt) / (1000 * 60 * 60 * 24), 0)
        / closedIncidents.length
      )
    : null;

  // Daily trend buckets
  const dailyTrend = {};
  trendData.forEach((r) => {
    const day = r.createdAt.toISOString().split('T')[0];
    dailyTrend[day] = (dailyTrend[day] || 0) + 1;
  });
  const trendChart = Object.entries(dailyTrend)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // ERP overdue check (>180 days)
  const erpOverdue = !lastErpExercise
    || (Date.now() - new Date(lastErpExercise.date).getTime()) > 180 * 24 * 60 * 60 * 1000;

  // Recurring hazard types in 90 days (flagged if >3)
  const flaggedTypes = typeBreakdown.filter((t) => t._count.id >= 3).map((t) => ({
    type: t.type,
    count: t._count.id,
  }));

  res.json({
    kpis: {
      openHazards,
      resolvedThisMonth,
      criticalHighOpen,
      totalReportsThisMonth,
      totalReportsLastMonth,
      reportsChangePct: totalReportsLastMonth > 0
        ? Math.round(((totalReportsThisMonth - totalReportsLastMonth) / totalReportsLastMonth) * 100)
        : null,
      openIncidents,
      closedIncidentsThisMonth,
      overdueActions,
      avgDaysToClose,
    },
    erpOverdue,
    lastErpExercise,
    trendChart,
    typeBreakdown: typeBreakdown.map((t) => ({ type: t.type, count: t._count.id })),
    severityBreakdown: severityBreakdown.map((s) => ({ severity: s.severity, count: s._count.id })),
    flaggedTrends: flaggedTypes,
    recentReports,
  });
});

// GET /api/dashboard/srm-summary — SRM lifecycle overview for S&TA/admin widget
const LIFECYCLE_STAGES = ['Submitted','Acknowledged','Under_Investigation','Risk_Assessed','Controls_Applied','Verification','Closed'];

router.get('/srm-summary', authenticate, requireRoles('admin', 's_ta'), async (req, res) => {
  const locId = getLocationFilter(req.user, req.query.locationId);
  const where = locId ? { locationId: locId } : {};

  const [stageCounts, withRisk, overdueActions, failedVerification, openReports] = await Promise.all([
    Promise.all(LIFECYCLE_STAGES.map((stage) =>
      prisma.hazardReport.count({ where: { ...where, status: stage } }).then((count) => ({ stage, count }))
    )),
    prisma.hazardReport.findMany({
      where: { ...where, initialRiskRating: { not: null }, residualRiskRating: { not: null } },
      select: { initialRiskRating: true, residualRiskRating: true },
    }),
    prisma.hazardReport.count({
      where: { ...where, actionDueDate: { not: null, lt: new Date() },
               status: { notIn: ['Controls_Applied', 'Verification', 'Closed'] } },
    }),
    prisma.hazardReport.count({ where: { ...where, verificationStatus: 'Failed' } }),
    prisma.hazardReport.findMany({
      where: { ...where, status: { not: 'Closed' } }, select: { createdAt: true },
    }),
  ]);

  const highCriticalBefore = withRisk.filter((r) => ['High', 'Critical'].includes(r.initialRiskRating)).length;
  const reducedCount = withRisk.filter(
    (r) => ['High', 'Critical'].includes(r.initialRiskRating) && ['Low', 'Medium'].includes(r.residualRiskRating)
  ).length;

  const avgDaysOpen = openReports.length > 0
    ? Math.round(openReports.reduce((s, r) => s + (Date.now() - new Date(r.createdAt)) / 86400000, 0) / openReports.length)
    : 0;

  res.json({
    byStage: stageCounts,
    riskReduction: { highCriticalBefore, reducedCount },
    overdueActions, failedVerification, avgDaysOpen,
  });
});

// GET /api/dashboard/export?locationId=&format=csv
router.get('/export', authenticate, requireRoles('admin', 's_ta'), async (req, res) => {
  const locId = getLocationFilter(req.user, req.query.locationId);
  const where = locId ? { locationId: locId } : {};

  const reports = await prisma.hazardReport.findMany({
    where,
    include: { location: true },
    orderBy: { createdAt: 'desc' },
  });

  if (req.query.format === 'csv') {
    const header = 'ID,Location,Type,Severity,Status,Description,Reporter,Anonymous,Date\n';
    const rows = reports.map((r) =>
      [
        r.id,
        r.location?.name,
        r.type,
        r.severity,
        r.status,
        `"${(r.description || '').replace(/"/g, '""')}"`,
        r.isAnonymous ? 'Anonymous' : (r.reporterName || 'Unknown'),
        r.isAnonymous,
        r.createdAt.toISOString(),
      ].join(',')
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="gojump-sms-export.csv"');
    return res.send(header + rows);
  }

  res.json(reports);
});

module.exports = router;
