// Fields stored as JSON strings in SQLite that should be returned as arrays/objects
const JSON_ARRAY_FIELDS = new Set([
  'regulatoryRefs',
  'history',
  'attendees',
  'actionItems',
  'participants',
  'checklistItems',
  'correctiveActions',
  'timeline',
  'contributingFactors',
  'notificationLog',
  // New compliance fields
  'linkedHazardIds',
  'acknowledgedBy',
]);

function transformRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return record;
  // Date objects are objects but must NOT be recursed into — they serialize correctly as ISO strings
  if (record instanceof Date) return record;

  const out = {};
  for (const [key, val] of Object.entries(record)) {
    if (JSON_ARRAY_FIELDS.has(key) && typeof val === 'string') {
      try { out[key] = JSON.parse(val); } catch { out[key] = []; }
    } else if (val instanceof Date) {
      out[key] = val; // preserve Date objects for correct ISO string serialization
    } else if (val && typeof val === 'object' && !Array.isArray(val)) {
      out[key] = transformRecord(val); // recurse for nested includes (location, assignedTo, etc.)
    } else if (Array.isArray(val)) {
      out[key] = val.map((item) =>
        item && typeof item === 'object' ? transformRecord(item) : item
      );
    } else {
      out[key] = val;
    }
  }
  return out;
}

function transformResponse(data) {
  if (Array.isArray(data)) return data.map(transformRecord);
  if (data && typeof data === 'object') return transformRecord(data);
  return data;
}

module.exports = { transformResponse };
