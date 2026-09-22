/* JWT verification + role-based authorisation. */
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { ministry: true, agency: true }
    });
    if (!user || !user.isActive) return res.status(401).json({ error: 'Account is not active' });
    delete user.passwordHash;               // never expose the hash downstream
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next()
    : res.status(403).json({ error: 'Your role does not permit this action' });

/* Row-level scope: a ministry officer sees their ministry, an agency officer their agency. */
function projectScope(user) {
  if (user.role === 'MINISTRY_OFFICER' && user.ministryId) return { ministryId: user.ministryId };
  if (user.role === 'AGENCY_OFFICER' && user.agencyId) return { agencyId: user.agencyId };
  return {};
}

module.exports = { requireAuth, requireRole, projectScope };
