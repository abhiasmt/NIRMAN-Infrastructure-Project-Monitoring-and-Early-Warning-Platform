const router = require('express').Router();
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const prisma = require('../lib/prisma');
const { requireAuth, requireRole } = require('../middleware/auth');
const { scoreProject, savePrediction } = require('../lib/riskService');
const audit = require('../lib/audit');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    file.mimetype.includes('csv') || file.originalname.endsWith('.csv')
      ? cb(null, true) : cb(new Error('Only CSV files are accepted'))
});

const COLUMNS = ['project_code', 'project_name', 'physical_progress_pct', 'expected_progress_pct',
  'revised_cost_cr', 'expenditure_incurred_cr', 'land_acquisition_pct', 'clearance_status',
  'months_of_delay', 'last_updated_date'];

router.use(requireAuth);

router.get('/template', (_req, res) => {
  res.header('Content-Type', 'text/csv');
  res.attachment('nirman_project_update_template.csv');
  res.send(COLUMNS.join(',') + '\n');
});

function validateRow(row, index) {
  const errors = [];
  if (!row.project_code) errors.push('project_code is required');
  const num = (key, min, max) => {
    if (row[key] === '' || row[key] == null) return;
    const v = Number(row[key]);
    if (Number.isNaN(v)) errors.push(`${key} is not a number`);
    else if (v < min || v > max) errors.push(`${key} is outside ${min}–${max}`);
  };
  num('physical_progress_pct', 0, 100); num('expected_progress_pct', 0, 100);
  num('land_acquisition_pct', 0, 100); num('revised_cost_cr', 0, 1e6);
  num('expenditure_incurred_cr', 0, 1e6); num('months_of_delay', 0, 240);
  if (row.clearance_status && !['Approved', 'Partial', 'Pending'].includes(row.clearance_status))
    errors.push('clearance_status must be Approved, Partial or Pending');
  if (row.last_updated_date && Number.isNaN(Date.parse(row.last_updated_date)))
    errors.push('last_updated_date is not a valid date');
  return { line: index + 2, row, errors };
}

router.post('/projects/csv', requireRole('ADMIN', 'AGENCY_OFFICER'),
  upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Attach a CSV file in the "file" field' });

    let records;
    try {
      records = parse(req.file.buffer, { columns: true, skip_empty_lines: true, trim: true });
    } catch (e) {
      return res.status(400).json({ error: 'Could not read the CSV', detail: e.message });
    }

    const checked = records.map(validateRow);
    const valid = checked.filter(r => !r.errors.length);
    const rejected = checked.filter(r => r.errors.length);
    const missingColumns = COLUMNS.filter(c => !Object.keys(records[0] || {}).includes(c));

    let imported = 0;
    const touched = [];
    for (const { row } of valid) {
      const project = await prisma.project.findUnique({ where: { projectCode: row.project_code } });
      if (!project) { rejected.push({ line: '-', row, errors: [`no project with code ${row.project_code}`] }); continue; }
      const n = (k) => (row[k] === '' || row[k] == null ? undefined : Number(row[k]));
      await prisma.project.update({
        where: { id: project.id },
        data: {
          physicalProgressPct: n('physical_progress_pct'), expectedProgressPct: n('expected_progress_pct'),
          revisedCostCr: n('revised_cost_cr'), expenditureIncurredCr: n('expenditure_incurred_cr'),
          landAcquisitionPct: n('land_acquisition_pct'), monthsOfDelay: n('months_of_delay'),
          clearanceStatus: row.clearance_status || undefined,
          lastUpdatedDate: row.last_updated_date ? new Date(row.last_updated_date) : new Date()
        }
      });
      await prisma.projectUpdate.create({
        data: { projectId: project.id, reportingDate: new Date(),
          physicalProgressPct: n('physical_progress_pct') ?? project.physicalProgressPct,
          expenditureIncurredCr: n('expenditure_incurred_cr'),
          remark: `Imported from ${req.file.originalname}`, submittedBy: req.user.name }
      });
      touched.push(project.id); imported++;
    }

    // Rescore everything the import touched, so alerts reflect the new data.
    for (const id of touched) {
      const p = await prisma.project.findUnique({ where: { id }, include: { milestones: true } });
      await savePrediction(id, await scoreProject(p));
    }

    const log = await prisma.uploadLog.create({
      data: { filename: req.file.originalname, uploadedById: req.user.id,
        totalRows: records.length, importedRows: imported, rejectedRows: rejected.length,
        warnings: missingColumns.length, errorsJson: rejected.slice(0, 50) }
    });
    await audit(req, 'CSV_IMPORTED', 'UploadLog', log.id, { imported, rejected: rejected.length });

    res.status(201).json({
      uploadId: log.id, totalRows: records.length, importedRows: imported,
      rejectedRows: rejected.length, warnings: missingColumns,
      rowErrors: rejected.slice(0, 50), preview: records.slice(0, 10)
    });
  });

router.get('/:id/status', async (req, res) => {
  const log = await prisma.uploadLog.findUnique({ where: { id: req.params.id } });
  if (!log) return res.status(404).json({ error: 'Upload not found' });
  res.json(log);
});

router.get('/', async (_req, res) =>
  res.json(await prisma.uploadLog.findMany({ orderBy: { createdAt: 'desc' }, take: 25 })));

module.exports = router;
