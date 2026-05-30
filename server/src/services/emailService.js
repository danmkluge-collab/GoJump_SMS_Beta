const nodemailer = require('nodemailer');
const prisma = require('../utils/prisma');
const { logger } = require('../utils/logger');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
  port: Number(process.env.SMTP_PORT) || 587,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM = process.env.FROM_EMAIL || 'sms@gojumpamerica.com';

async function send(to, subject, html) {
  if (!process.env.SMTP_USER) {
    logger.info(`[Email] Would send to ${to}: ${subject}`);
    return;
  }
  try {
    await transporter.sendMail({ from: FROM, to, subject, html });
  } catch (e) {
    logger.error('Email send error:', e.message);
  }
}
exports.send = send;

async function getStaEmails(locationId) {
  const users = await prisma.user.findMany({
    where: { locationId, role: { in: ['s_ta', 'admin'] }, isActive: true, emailNotifications: true },
    select: { email: true, id: true },
  });
  return users;
}

async function createNotification(userId, message, type = 'info', link = null, locationId = null) {
  await prisma.notification.create({ data: { userId, message, type, link, locationId } }).catch(() => {});
}

exports.notifyStaForNewReport = async (locationId, report) => {
  const recipients = await getStaEmails(locationId);
  for (const u of recipients) {
    await createNotification(
      u.id,
      `New ${report.severity} severity hazard report submitted — ${report.type}`,
      report.severity === 'Critical' || report.severity === 'High' ? 'danger' : 'warning',
      `/hazard-reports/${report.id}`,
      locationId
    );
    await send(
      u.email,
      `[GoJump SMS] New Hazard Report — ${report.severity} Severity`,
      `<h2>New Hazard Report Submitted</h2>
      <p><strong>Type:</strong> ${report.type}</p>
      <p><strong>Severity:</strong> ${report.severity}</p>
      <p><strong>Description:</strong> ${report.description}</p>
      <p><strong>Anonymous:</strong> ${report.isAnonymous ? 'Yes' : 'No'}</p>
      <p><strong>Submitted:</strong> ${new Date(report.createdAt).toLocaleString()}</p>
      <hr>
      <p>Login to the SMS to review and assign this report.</p>`
    );
  }
};

exports.notifyHighRisk = async (locationId, riskItem) => {
  const recipients = await getStaEmails(locationId);
  for (const u of recipients) {
    await createNotification(
      u.id,
      `${riskItem.riskRating} risk item created: ${riskItem.hazardIdLabel} — ${riskItem.description.substring(0, 60)}`,
      'danger',
      `/risk-register`,
      locationId
    );
    await send(
      u.email,
      `[GoJump SMS] ${riskItem.riskRating} Risk Item Created — Immediate Action Required`,
      `<h2>${riskItem.riskRating} Risk Item Requires Attention</h2>
      <p><strong>Hazard ID:</strong> ${riskItem.hazardIdLabel}</p>
      <p><strong>Description:</strong> ${riskItem.description}</p>
      <p><strong>Risk Rating:</strong> ${riskItem.riskRating}</p>
      <p><strong>Action Required:</strong> Immediate action required. Please log in to the SMS to assign a responsible person and implement controls.</p>`
    );
  }
};

// ── Reporter lifecycle notifications ─────────────────────────────────────────
const REPORTER_STAGE_MESSAGES = {
  Acknowledged: {
    subject: '[GoJump SMS] Your Safety Report Has Been Received',
    body: (r) => `<p>Your hazard report at <strong>${r.location?.name || 'GoJump'}</strong> has been reviewed and accepted by our Safety &amp; Training Advisor. An investigation will begin shortly.</p>`,
  },
  Controls_Applied: {
    subject: '[GoJump SMS] Action Taken on Your Safety Report',
    body: (r) => `<p>We have implemented corrective actions for the hazard you reported.</p>
      ${r.controlMeasures ? `<p><strong>Controls applied:</strong> ${r.controlMeasures}</p>` : ''}
      <p>Your report is now in the verification phase to confirm effectiveness.</p>`,
  },
  Closed: {
    subject: '[GoJump SMS] Your Safety Report Has Been Fully Resolved',
    body: (r) => `<p>Your hazard report has been fully investigated, mitigated, and verified. Here is a summary:</p>
      ${r.rootCauseAnalysis ? `<p><strong>Root cause:</strong> ${r.rootCauseAnalysis}</p>` : ''}
      ${r.controlMeasures ? `<p><strong>Controls applied:</strong> ${r.controlMeasures}</p>` : ''}
      <p>Thank you for contributing to GoJump America's safety culture.</p>`,
  },
  Verification: {
    subject: '[GoJump SMS] Your Report Is Under Effectiveness Review',
    body: () => `<p>The corrective actions for your hazard report are currently being reviewed for effectiveness. We will notify you once the review is complete.</p>`,
  },
};

exports.notifyReporterStageChange = async (report, stage, note) => {
  if (!report.reporterEmail) return;
  const template = REPORTER_STAGE_MESSAGES[stage];
  if (!template) return;
  const noteHtml = note ? `<p><em>Note from safety team: ${note}</em></p>` : '';
  await send(
    report.reporterEmail,
    template.subject,
    `${template.body(report)}${noteHtml}
     <hr><p style="font-size:12px;color:#888">GoJump America Safety Management System — Protected under Just Culture policy</p>`
  );
};

exports.notifyStaVerificationFailed = async (locationId, report) => {
  const recipients = await getStaEmails(locationId);
  for (const u of recipients) {
    await createNotification(u.id, `Verification FAILED for hazard report — ${report.type}. Immediate corrective action required.`, 'danger', `/hazard-reports`, locationId);
    await send(
      u.email,
      '[GoJump SMS] ⚠ Hazard Mitigation Verification Failed',
      `<h2>Verification Failed — Immediate Action Required</h2>
       <p>The mitigation for a hazard report has <strong>failed verification</strong>:</p>
       <p><strong>Type:</strong> ${report.type}</p>
       <p><strong>Description:</strong> ${report.description}</p>
       ${report.verificationNotes ? `<p><strong>Verification notes:</strong> ${report.verificationNotes}</p>` : ''}
       <p>Please log in to the SMS and implement revised corrective actions immediately. FAA §5.93 requires documented follow-up.</p>`
    );
  }
};

// §5.71 — Gap 16: Expanded overdue notifications (incidents + hazard actions + audit items + KPIs)
exports.notifyOverdueActions = async () => {
  const now = new Date();

  // 1. Overdue incident follow-up dates
  const overdueIncidents = await prisma.incident.findMany({
    where: { status: { notIn: ['Closed'] }, followUpDate: { not: null, lt: now } },
    include: { location: true, assignedTo: { select: { id: true, email: true, name: true, emailNotifications: true } } },
  });
  const grouped = {};
  for (const inc of overdueIncidents) {
    if (!inc.assignedTo?.emailNotifications) continue;
    if (!grouped[inc.assignedTo.email]) grouped[inc.assignedTo.email] = { user: inc.assignedTo, incidents: [], hazards: [] };
    grouped[inc.assignedTo.email].incidents.push(inc);
  }

  // 2. Overdue hazard report action due dates
  const overdueHazards = await prisma.hazardReport.findMany({
    where: { status: { notIn: ['Controls_Applied','Verification','Closed'] }, actionDueDate: { not: null, lt: now } },
    include: { location: true, actionAssignedTo: { select: { id: true, email: true, name: true, emailNotifications: true } } },
  });
  for (const h of overdueHazards) {
    if (!h.actionAssignedTo?.emailNotifications) continue;
    if (!grouped[h.actionAssignedTo.email]) grouped[h.actionAssignedTo.email] = { user: h.actionAssignedTo, incidents: [], hazards: [] };
    grouped[h.actionAssignedTo.email].hazards.push(h);
  }

  for (const { user, incidents, hazards } of Object.values(grouped)) {
    const incHtml = incidents.map((i) =>
      `<li>Incident at ${i.location?.name} — follow-up due ${new Date(i.followUpDate).toLocaleDateString()}</li>`
    ).join('');
    const hazHtml = hazards.map((h) =>
      `<li>Hazard: ${h.type} at ${h.location?.name} — action due ${new Date(h.actionDueDate).toLocaleDateString()}</li>`
    ).join('');
    const total = incidents.length + hazards.length;
    await send(user.email,
      `[GoJump SMS] Daily Digest — ${total} Overdue Action Item(s)`,
      `<h2>Overdue Action Items</h2>
       ${incidents.length ? `<h3>Incidents</h3><ul>${incHtml}</ul>` : ''}
       ${hazards.length ? `<h3>Hazard Report Actions</h3><ul>${hazHtml}</ul>` : ''}
       <p>Please log in to the SMS to update these items.</p>`
    );
  }

  // 3. Overdue audit items — notify S&TA at each location
  const overdueAudits = await prisma.auditItem.findMany({
    where: { status: { not: 'Completed' }, scheduledDate: { not: null, lt: now } },
    include: { location: true },
  });
  const auditByLoc = {};
  for (const a of overdueAudits) {
    if (!auditByLoc[a.locationId]) auditByLoc[a.locationId] = { location: a.location, items: [] };
    auditByLoc[a.locationId].items.push(a);
  }
  for (const { location, items } of Object.values(auditByLoc)) {
    const stAs = await getStaEmails(location.id);
    const listHtml = items.map((a) => `<li>${a.title} — scheduled ${new Date(a.scheduledDate).toLocaleDateString()}</li>`).join('');
    for (const u of stAs) {
      await send(u.email,
        `[GoJump SMS] ${items.length} Overdue Audit Item(s) at ${location.name}`,
        `<h2>Overdue Internal Audits</h2><ul>${listHtml}</ul><p>Please log in to the SMS to update these audits.</p>`
      );
    }
  }

  // 4. Stale KPI measurements
  const kpis = await prisma.kpi.findMany({ where: { lastMeasuredAt: { not: null } }, include: { location: true } });
  const staleKpisByLoc = {};
  for (const k of kpis) {
    if (!k.lastMeasuredAt) continue;
    const daysSince = (now - new Date(k.lastMeasuredAt)) / 86400000;
    const stale = (k.frequency === 'Monthly' && daysSince > 35) || (k.frequency === 'Quarterly' && daysSince > 100);
    if (stale) {
      if (!staleKpisByLoc[k.locationId]) staleKpisByLoc[k.locationId] = { location: k.location, kpis: [] };
      staleKpisByLoc[k.locationId].kpis.push(k);
    }
  }
  for (const { location, kpis: staleList } of Object.values(staleKpisByLoc)) {
    const stAs = await getStaEmails(location.id);
    const listHtml = staleList.map((k) => `<li>${k.name} — last measured ${new Date(k.lastMeasuredAt).toLocaleDateString()}</li>`).join('');
    for (const u of stAs) {
      await send(u.email,
        `[GoJump SMS] ${staleList.length} KPI(s) Need Updating at ${location.name}`,
        `<h2>Stale KPI Measurements</h2><ul>${listHtml}</ul><p>Please log in to update these Safety Performance Indicators.</p>`
      );
    }
  }
};

// §5.91 — Gap 14: Trend alerting — called daily by cron
exports.checkTrends = async () => {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const locations = await prisma.location.findMany();

  for (const loc of locations) {
    const typeGroups = await prisma.hazardReport.groupBy({
      by: ['type'],
      where: { locationId: loc.id, createdAt: { gte: ninetyDaysAgo } },
      _count: { id: true },
    });
    const flagged = typeGroups.filter((t) => t._count.id >= 3);

    for (const t of flagged) {
      // Only alert if no notification sent in the last 7 days for this type
      const recentAlert = await prisma.notification.findFirst({
        where: {
          locationId: loc.id,
          type: 'trend_alert',
          message: { contains: t.type },
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      });
      if (recentAlert) continue;

      const staUsers = await prisma.user.findMany({
        where: { locationId: loc.id, role: { in: ['s_ta', 'admin'] }, isActive: true },
      });

      for (const u of staUsers) {
        await prisma.notification.create({
          data: {
            userId: u.id, locationId: loc.id, type: 'trend_alert',
            message: `Trend Alert: "${t.type}" hazards reported ${t._count.id} times in the last 90 days at ${loc.name}. Review required per §5.91.`,
            link: `/hazard-reports?type=${t.type}`,
          },
        }).catch(() => {});

        if (u.emailNotifications) {
          await send(u.email,
            `[GoJump SMS] Trend Alert — ${t.type} Hazards at ${loc.name}`,
            `<p>The hazard type <strong>${t.type}</strong> has been reported <strong>${t._count.id} times</strong> in the last 90 days at ${loc.name}.</p>
             <p>A documented safety review is required per FAA §5.91. Please log in to the SMS to review and action this trend.</p>`
          );
        }
      }
      logger.info(`Trend alert sent: ${t.type} × ${t._count.id} at ${loc.name}`);
    }
  }
};
