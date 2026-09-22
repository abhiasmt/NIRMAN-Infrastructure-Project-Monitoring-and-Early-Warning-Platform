const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const validate = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const audit = require('../lib/audit');
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({ windowMs: 15 * 60_000, max: 20 });

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
const registerSchema = z.object({
  email: z.string().email(), name: z.string().min(2), password: z.string().min(8),
  role: z.enum(['ADMIN','MOSPI_OFFICER','MINISTRY_OFFICER','AGENCY_OFFICER','ANALYST','VIEWER']),
  ministryId: z.string().optional(), agencyId: z.string().optional()
});

const publicUser = u => ({ id: u.id, email: u.email, name: u.name, role: u.role,
  ministry: u.ministry?.name || null, agency: u.agency?.name || null });

router.post('/login', loginLimiter, validate({ body: loginSchema }), async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() }, include: { ministry: true, agency: true } });
  // Same message either way — don't reveal which accounts exist.
  if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash)))
    return res.status(401).json({ error: 'Invalid email or password' });
  const token = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });
  res.json({ token, user: publicUser(user) });
});

router.post('/register', requireAuth, requireRole('ADMIN'), validate({ body: registerSchema }), async (req, res) => {
  const exists = await prisma.user.findUnique({ where: { email: req.body.email.toLowerCase() } });
  if (exists) return res.status(409).json({ error: 'An account with that email already exists' });
  const user = await prisma.user.create({
    data: { ...req.body, email: req.body.email.toLowerCase(),
      passwordHash: await bcrypt.hash(req.body.password, 12), password: undefined },
    include: { ministry: true, agency: true }
  });
  await audit(req, 'USER_CREATED', 'User', user.id, { role: user.role });
  res.status(201).json(publicUser(user));
});

router.get('/me', requireAuth, (req, res) => res.json(publicUser(req.user)));

// Stateless JWT: the client discards the token. Recorded for the audit trail.
router.post('/logout', requireAuth, async (req, res) => {
  await audit(req, 'LOGOUT', 'User', req.user.id);
  res.json({ message: 'Signed out' });
});

module.exports = router;
