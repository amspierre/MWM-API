const router = require('express').Router();
const service = require('../services/vehicles');
const { asyncRoute, auth, errorResponse, pagination, validateRequired } = require('../http');

router.use(auth());
router.get('/', asyncRoute(async (req, res) => { const paginationData = pagination(req.query); const result = await service.list({ ...paginationData, search: req.query.search, cliente_id: req.query.cliente_id }); res.json({ data: result.data, meta: { page: paginationData.page, limit: paginationData.limit, total: result.total, pages: Math.ceil(result.total / paginationData.limit) } }); }));
router.get('/:id', asyncRoute(async (req, res) => { const row = await service.findById(req.params.id); return row ? res.json(row) : errorResponse(res, 404, 'NOT_FOUND', 'Vehicle not found.'); }));
router.post('/', asyncRoute(async (req, res) => { const details = validateRequired(req.body || {}, ['cliente_id', 'placa', 'marca', 'modelo']); if (Object.keys(details).length) return errorResponse(res, 422, 'VALIDATION_ERROR', 'Invalid data.', details); res.status(201).json(await service.create(req.body)); }));
router.patch('/:id', asyncRoute(async (req, res) => { const row = await service.update(req.params.id, req.body || {}); return row ? res.json(row) : errorResponse(res, 404, 'NOT_FOUND', 'Vehicle not found or no fields to update.'); }));
router.delete('/:id', asyncRoute(async (req, res) => { const result = await service.remove(req.params.id); return result.rowCount ? res.status(204).send() : errorResponse(res, 404, 'NOT_FOUND', 'Vehicle not found.'); }));

module.exports = router;