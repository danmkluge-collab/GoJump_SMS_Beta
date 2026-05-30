/**
 * Records Retention Service — FAA §5.95
 *
 * Retention periods per FAA Part 5 and USPA best practices:
 *   srm              — indefinite (SRM records never expire)
 *   safety_assurance — 5 years
 *   training         — indefinite (per 14 CFR §61 requirements)
 *   communication    — 24 months
 *   audit            — 5 years
 */

const prisma = require('../utils/prisma');

const RETENTION_DAYS = {
  srm:               null,        // indefinite — never expires
  safety_assurance:  5 * 365,
  training:          null,        // indefinite
  communication:     2 * 365,    // 24 months
  audit:             5 * 365,
};

// Maps Prisma model name → retention category
const TABLE_CATEGORY = {
  hazardReport:   'srm',
  riskRegister:   'srm',
  incident:       'srm',
  document:       'safety_assurance',
  auditLog:       'audit',
  trainingRecord: 'training',
  safetyBulletin: 'communication',
  meeting:        'safety_assurance',
};

/**
 * SRM records (srm + training categories) must not be deleted.
 * Returns true if the record is deletion-protected.
 */
function isDeletionProtected(category) {
  return category === 'srm' || category === 'training';
}

/**
 * Compute the expiry date for a given retention category.
 * Returns null for indefinite retention.
 */
function computeExpiresAt(category, fromDate = new Date()) {
  const days = RETENTION_DAYS[category];
  if (days === null) return null;
  const d = new Date(fromDate);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Tag a newly created record with its retention metadata.
 * Call this after prisma.XXX.create() — pass the model name and the created record's id.
 *
 * @param {string} modelName   — e.g. 'hazardReport', 'document', 'auditLog'
 * @param {string} recordId    — the created record's id
 * @param {Date}   [fromDate]  — base date for expiry calculation (defaults to now)
 */
async function tagRetention(modelName, recordId, fromDate) {
  const category = TABLE_CATEGORY[modelName];
  if (!category) return; // unknown model — skip

  const retentionExpiresAt = computeExpiresAt(category, fromDate);

  try {
    await prisma[modelName].update({
      where: { id: recordId },
      data: { retentionCategory: category, retentionExpiresAt },
    });
  } catch (err) {
    // Non-fatal: log but don't crash the request
    console.warn(`[retentionService] Failed to tag ${modelName} ${recordId}:`, err.message);
  }
}

/**
 * Archive a record (soft-delete with reason).
 * Blocked for SRM records — returns an error message string if blocked.
 *
 * @param {string} modelName
 * @param {string} recordId
 * @param {string} reason
 * @returns {Promise<null|string>} null on success, error message string on failure
 */
async function archiveRecord(modelName, recordId, reason) {
  const category = TABLE_CATEGORY[modelName];
  if (!category) return `Unknown model: ${modelName}`;

  // Check current retention category from DB
  const record = await prisma[modelName].findUnique({
    where: { id: recordId },
    select: { retentionCategory: true },
  });

  const effectiveCategory = record?.retentionCategory || category;

  if (isDeletionProtected(effectiveCategory)) {
    return `SRM and training records cannot be archived — they must be retained indefinitely per FAA §5.95.`;
  }

  await prisma[modelName].update({
    where: { id: recordId },
    data: { archivedAt: new Date(), archiveReason: reason || 'Archived by administrator' },
  });

  return null; // success
}

/**
 * Get retention summary stats across all managed models.
 */
async function getRetentionSummary() {
  const now = new Date();

  const [
    hazardReports, riskItems, incidents, documents,
    auditLogs, trainingRecords, safetyBulletins, meetings,
  ] = await Promise.all([
    prisma.hazardReport.count(),
    prisma.riskRegister.count(),
    prisma.incident.count(),
    prisma.document.count(),
    prisma.auditLog.count(),
    prisma.trainingRecord.count(),
    prisma.safetyBulletin.count(),
    prisma.meeting.count(),
  ]);

  const expiredDocs = await prisma.document.count({
    where: { retentionExpiresAt: { lt: now }, archivedAt: null },
  });
  const expiredBulletins = await prisma.safetyBulletin.count({
    where: { retentionExpiresAt: { lt: now }, archivedAt: null },
  });

  return {
    categories: {
      srm: {
        label: 'Safety Risk Management',
        retention: 'Indefinite',
        count: hazardReports + riskItems + incidents,
        protected: true,
      },
      safety_assurance: {
        label: 'Safety Assurance',
        retention: '5 years',
        count: documents + meetings,
        expiredCount: expiredDocs,
        protected: false,
      },
      training: {
        label: 'Training Records',
        retention: 'Indefinite',
        count: trainingRecords,
        protected: true,
      },
      communication: {
        label: 'Safety Communications',
        retention: '24 months',
        count: safetyBulletins,
        expiredCount: expiredBulletins,
        protected: false,
      },
      audit: {
        label: 'Audit Logs',
        retention: '5 years',
        count: auditLogs,
        protected: false,
      },
    },
    totals: {
      hazardReports, riskItems, incidents, documents,
      auditLogs, trainingRecords, safetyBulletins, meetings,
    },
  };
}

module.exports = { tagRetention, archiveRecord, getRetentionSummary, isDeletionProtected, RETENTION_DAYS, TABLE_CATEGORY };
