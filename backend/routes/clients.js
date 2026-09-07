const router = require('express').Router();
const service = require('../services/clients');
const { asyncRoute, auth, adminOnly, errorResponse, pagination, validateRequired } = require('../http');

router.use(auth());
router.get('/', asyncRoute(async (req, res) => { const paginationData = pagination(req.query); const result = await service.list({ ...paginationData, search: req.query.search }); res.json({ data: result.data, meta: { page: paginationData.page, limit: paginationData.limit, total: result.total, pages: Math.ceil(result.total / paginationData.limit) } }); }));
router.get('/:cliente_id/veiculos', asyncRoute(async (req, res) => {
	const vehicles = await require('../services/vehicles').byClient(req.params.cliente_id);
	res.json({ data: vehicles.rows, meta: { total: vehicles.rowCount } });
}));
router.get('/:id', asyncRoute(async (req, res) => { const row = await service.findById(req.params.id); return row ? res.json(row) : errorResponse(res, 404, 'NOT_FOUND', 'Cliente não encontrado.'); }));
router.post('/', asyncRoute(async (req, res) => { const details = validateRequired(req.body || {}, ['nome', 'cpf_cnpj']); if (Object.keys(details).length) return errorResponse(res, 422, 'VALIDATION_ERROR', 'Dados inválidos.', details); res.status(201).json(await service.create(req.body)); }));
router.patch('/:id', asyncRoute(async (req, res) => { const row = await service.update(req.params.id, req.body || {}); return row ? res.json(row) : errorResponse(res, 404, 'NOT_FOUND', 'Cliente não encontrado ou sem campos para atualizar.'); }));
router.delete('/:id', adminOnly, asyncRoute(async (req, res) => { const result = await service.remove(req.params.id); return result.rowCount ? res.status(204).send() : errorResponse(res, 404, 'NOT_FOUND', 'Cliente não encontrado.'); }));

module.exports = router;