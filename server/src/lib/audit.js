const prisma = require('./prisma');
module.exports = async function audit(req, action, entityType, entityId, detail) {
  try {
    await prisma.auditLog.create({
      data: { userId: req.user?.id || null, action, entityType, entityId: entityId || null,
        detailJson: detail || undefined, ipAddress: req.ip }
    });
  } catch (e) { console.error('audit failed', e.message); }
};
