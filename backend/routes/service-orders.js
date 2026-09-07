const router = require('express').Router();
const service = require('../services/service-orders');
const { asyncRoute, auth, errorResponse, pagination, validateRequired } = require('../http');

router.use(auth());
router.get('/', asyncRoute(async (req, res) => {
  const paginationData = pagination(req.query);
  const result = await service.list({ ...paginationData, filters: req.query });
  res.json({ data: result.data, meta: { page: paginationData.page, limit: paginationData.limit, total: result.total, pages: Math.ceil(result.total / paginationData.limit) } });
}));
router.get('/:id', asyncRoute(async (req, res) => { const row = await service.findById(req.params.id); return row ? res.json(row) : errorResponse(res, 404, 'NOT_FOUND', 'Ordem de serviço não encontrada.'); }));
router.post('/', asyncRoute(async (req, res) => {
  const details = validateRequired(req.body || {}, ['titulo', 'cliente_id', 'veiculo_id', 'responsavel_id']);
  if (Object.keys(details).length) return errorResponse(res, 422, 'VALIDATION_ERROR', 'Dados inválidos.', details);
  const result = await service.create(req.body);
  if (result.details) return errorResponse(res, 422, 'VALIDATION_ERROR', 'Dados inválidos.', result.details);
  res.status(201).json(result.row);
}));
router.patch('/:id/status', asyncRoute(async (req, res) => {
  const result = await service.update(req.params.id, { status: req.body?.status });
  if (result.notFound) return errorResponse(res, 404, 'NOT_FOUND', 'Ordem de serviço não encontrada.');
  if (result.details) return errorResponse(res, 422, 'VALIDATION_ERROR', 'Dados inválidos.', result.details);
  res.json(result.row);
}));
router.patch('/:id', asyncRoute(async (req, res) => {
  const result = await service.update(req.params.id, req.body || {});
  if (result.notFound) return errorResponse(res, 404, 'NOT_FOUND', 'Ordem de serviço não encontrada.');
  if (result.details) return errorResponse(res, 422, 'VALIDATION_ERROR', 'Dados inválidos.', result.details);
  if (result.empty) return errorResponse(res, 422, 'VALIDATION_ERROR', 'Nenhum campo para atualizar.');
  res.json(result.row);
}));
router.delete('/:id', asyncRoute(async (req, res) => { const result = await service.remove(req.params.id); return result.rowCount ? res.status(204).send() : errorResponse(res, 404, 'NOT_FOUND', 'Ordem de serviço não encontrada.'); }));

module.exports = router;