/* NIRMAN API — Express entry point. */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');

const auth = require('./routes/auth');
const projects = require('./routes/projects');
const dashboard = require('./routes/dashboard');
const predictions = require('./routes/predictions');
const alerts = require('./routes/alerts');
const interventions = require('./routes/interventions');
const uploads = require('./routes/uploads');
const admin = require('./routes/admin');
const { refreshAllPredictions } = require('./lib/riskService');
const swaggerUi = require('swagger-ui-express');
const openapi = require('./lib/openapi');

const app = express();
app.use(helmet());
app.use(cors({ origin: (process.env.CORS_ORIGIN || '*').split(','), credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));
app.use(rateLimit({ windowMs: 60_000, max: 300, standardHeaders: true, legacyHeaders: false }));

const v1 = express.Router();
v1.use('/auth', auth);
v1.use('/projects', projects);
v1.use('/dashboard', dashboard);
v1.use('/predictions', predictions);
v1.use('/alerts', alerts);
v1.use('/interventions', interventions);
v1.use('/uploads', uploads);
v1.use('/admin', admin);
v1.get('/health', (_req, res) => res.json({ status: 'ok', service: 'nirman-api' }));
app.use('/api/v1', v1);
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi));

// Central error handler — never leak stack traces to the client.
app.use((err, _req, res, _next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({ error: err.publicMessage || 'Internal server error' });
});

if (process.env.ENABLE_CRON !== 'false') {
  cron.schedule(process.env.RISK_REFRESH_CRON || '0 2 * * *', async () => {
    console.log('[cron] refreshing risk predictions');
    try { await refreshAllPredictions(); } catch (e) { console.error('[cron] failed', e.message); }
  });
}

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`NIRMAN API on http://localhost:${port}/api/v1 (docs at /api/docs)`));
