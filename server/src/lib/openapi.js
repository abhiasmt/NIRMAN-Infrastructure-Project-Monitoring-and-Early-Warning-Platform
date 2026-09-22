/* Minimal OpenAPI description served at /api/docs. */
const path = { get: {}, post: {} };
module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'NIRMAN API',
    version: '1.0.0',
    description: 'AI-powered infrastructure project monitoring and early-warning platform. ' +
      'Synthetic CUF-like data only — production deployment requires authorised PAIMANA/OCMS integration.'
  },
  servers: [{ url: '/api/v1' }],
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } }
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/auth/login': { post: { summary: 'Sign in and receive a JWT', security: [],
      requestBody: { required: true, content: { 'application/json': { schema: { type: 'object',
        properties: { email: { type: 'string' }, password: { type: 'string' } },
        required: ['email', 'password'] } } } },
      responses: { 200: { description: 'Token and user profile' }, 401: { description: 'Invalid credentials' } } } },
    '/auth/me': { get: { summary: 'Current user profile', responses: { 200: { description: 'Profile' } } } },
    '/projects': {
      get: { summary: 'List projects (filtered, sorted, paginated)',
        parameters: ['ministry','sector','state','agency','riskLevel','status','minCost','stale','q','sortBy','order','page','pageSize']
          .map(name => ({ name, in: 'query', schema: { type: 'string' } })),
        responses: { 200: { description: 'Paged project list with latest prediction' } } },
      post: { summary: 'Create a project (ADMIN, MOSPI_OFFICER)', responses: { 201: { description: 'Created' } } }
    },
    '/projects/{id}': { get: { summary: 'Project detail with milestones, alerts and interventions',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Project' }, 404: { description: 'Not found' } } } },
    '/projects/{id}/updates': { post: { summary: 'File a periodic progress return and rescore',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 201: { description: 'Update and new prediction' } } } },
    '/dashboard/summary': { get: { summary: 'Portfolio KPI summary', responses: { 200: { description: 'KPIs' } } } },
    '/dashboard/risk-by-sector': { get: { summary: 'High-risk counts by sector', responses: { 200: { description: 'Counts' } } } },
    '/dashboard/risk-by-ministry': { get: { summary: 'High-risk counts by ministry', responses: { 200: { description: 'Counts' } } } },
    '/dashboard/risk-by-state': { get: { summary: 'High-risk counts by state', responses: { 200: { description: 'Counts' } } } },
    '/dashboard/top-risk-projects': { get: { summary: 'Highest-risk projects', responses: { 200: { description: 'List' } } } },
    '/dashboard/risk-trends': { get: { summary: 'Average risk score per period', responses: { 200: { description: 'Series' } } } },
    '/predictions/project/{id}': { post: { summary: 'Score one project now',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 201: { description: 'Prediction' } } } },
    '/predictions/refresh-all': { post: { summary: 'Rescore the whole portfolio (ADMIN, ANALYST)',
      responses: { 200: { description: 'Count refreshed' } } } },
    '/alerts': { get: { summary: 'List early-warning alerts', responses: { 200: { description: 'Paged alerts' } } } },
    '/alerts/{id}/acknowledge': { patch: { summary: 'Acknowledge an alert',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Updated alert' } } } },
    '/alerts/{id}/resolve': { patch: { summary: 'Resolve an alert',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Updated alert' } } } },
    '/interventions': { get: { summary: 'List interventions', responses: { 200: { description: 'List' } } },
      post: { summary: 'Create an intervention', responses: { 201: { description: 'Created' } } } },
    '/uploads/projects/csv': { post: { summary: 'Import a CSV of project returns (multipart, field "file")',
      responses: { 201: { description: 'Import summary with row errors' } } } },
    '/uploads/template': { get: { summary: 'Download the CSV template', responses: { 200: { description: 'CSV' } } } },
    '/admin/settings': { get: { summary: 'Risk thresholds and weights', responses: { 200: { description: 'Settings' } } } }
  }
};
