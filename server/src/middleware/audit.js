const prisma = require('../utils/prisma');

// Convert snake_case table name → camelCase Prisma model accessor
function toCamelCase(str) {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

exports.auditLog = (tableName, actionFn) => async (req, res, next) => {
  // Capture old value BEFORE the operation runs (best-effort, non-fatal)
  let oldValue = null;
  const id = req.params?.id;
  if (id && tableName) {
    try {
      const modelKey = toCamelCase(tableName);
      const model = prisma[modelKey];
      if (model && typeof model.findUnique === 'function') {
        const existing = await model.findUnique({ where: { id } });
        if (existing) oldValue = JSON.stringify(existing);
      }
    } catch { /* non-fatal */ }
  }

  const originalJson = res.json.bind(res);
  res.json = async (data) => {
    if (res.statusCode < 400 && data) {
      try {
        const action = typeof actionFn === 'function' ? actionFn(req, data) : actionFn;
        await prisma.auditLog.create({
          data: {
            userId:     req.user?.id         ?? null,
            userRole:   req.user?.role       ?? null,
            action,
            tableName,
            recordId:   data?.id             ?? req.params?.id ?? null,
            oldValue,                               // ← now populated for UPDATE/DELETE
            newValue:   JSON.stringify(data),
            ipAddress:  req.ip               ?? null,
            locationId: req.user?.locationId ?? data?.locationId ?? null,
          },
        });
      } catch { /* audit failures must never break the request */ }
    }
    return originalJson(data);
  };
  next();
};
