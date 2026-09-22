/* Zod request validation. Usage: validate({ body: schema }) */
module.exports = schemas => (req, res, next) => {
  for (const key of ['body', 'query', 'params']) {
    if (!schemas[key]) continue;
    const result = schemas[key].safeParse(req[key]);
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: result.error.issues.map(i => ({ field: i.path.join('.'), message: i.message }))
      });
    }
    if (key === 'body') req.body = result.data;
    else req.validated = Object.assign(req.validated || {}, { [key]: result.data });
  }
  next();
};
