require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const clientsRoutes = require('./backend/routes/clients');
const staffRoutes = require('./backend/routes/staff');
const vehiclesRoutes = require('./backend/routes/vehicles');
const serviceOrdersRoutes = require('./backend/routes/service-orders');

const app = express();
const port = Number(process.env.PORT || 3000);
const jwtSecret = process.env.JWT_SECRET || 'development-only-secret';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5500').split(',').map((origin) => origin.trim());

app.use(helmet());
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '1mb' }));

// Resource routes are mounted separately. Legacy handlers remain for compatibility.
app.use('/api/v1/clientes', clientsRoutes);
app.use('/api/v1/funcionarios', staffRoutes);
app.use('/api/v1/veiculos', vehiclesRoutes);
app.use('/api/v1/ordens-servico', serviceOrdersRoutes);
app.use('/api/v1/clients', clientsRoutes);
app.use('/api/v1/staff', staffRoutes);
app.use('/api/v1/vehicles', vehiclesRoutes);
app.use('/api/v1/service-orders', serviceOrdersRoutes);

const statuses = ['em_andamento', 'finalizado', 'pendente'];

function errorResponse(res, status, code, message, details) {
  return res.status(status).json({ error: { code, message, ...(details ? { details } : {}) } });
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function validateBody(body, fields) {
  const details = {};
  for (const [field, rule] of Object.entries(fields)) {
    if (rule.required && (body[field] === undefined || body[field] === null || body[field] === '')) details[field] = ['This field is required.'];
    else if (body[field] !== undefined && rule.type && typeof body[field] !== rule.type) details[field] = [`Must be of type ${rule.type}.`];
  }
  return details;
}

function pagination(query) {
  const page = Math.max(Number.parseInt(query.page || '1', 10), 1);
  const limit = Math.min(Math.max(Number.parseInt(query.limit || '20', 10), 1), 100);
  return { page, limit, offset: (page - 1) * limit };
}

function auth(required = true) {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) return required ? errorResponse(res, 401, 'UNAUTHENTICATED', 'Authentication required.') : next();
    try { req.user = jwt.verify(header.slice(7), jwtSecret); return next(); } catch { return errorResponse(res, 401, 'INVALID_TOKEN', 'Invalid or expired token.'); }
  };
}

function adminOnly(req, res, next) {
  return req.user?.perfil === 'admin' ? next() : errorResponse(res, 403, 'FORBIDDEN', 'Insufficient permissions.');
}

async function findById(table, id) {
  const result = await pool.query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
  return result.rows[0];
}

function publicUser(user) {
  return { id: user.id, nome: user.nome, email: user.email, perfil: user.perfil };
}

app.get('/health', asyncRoute(async (req, res) => { await pool.query('SELECT 1'); res.json({ status: 'ok', database: 'ok' }); }));

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true });
app.post('/api/v1/auth/login', loginLimiter, asyncRoute(async (req, res) => {
  const { email, senha } = req.body || {};
  if (!email || !senha) return errorResponse(res, 422, 'VALIDATION_ERROR', 'Email and password are required.');
  const result = await pool.query('SELECT * FROM usuarios WHERE email = $1 AND ativo = TRUE', [email]);
  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(senha, user.senha_hash))) return errorResponse(res, 401, 'INVALID_CREDENTIALS', 'Invalid credentials.');
  const token = jwt.sign({ id: user.id, nome: user.nome, email: user.email, perfil: user.perfil }, jwtSecret, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });
  res.json({ access_token: token, token_type: 'Bearer', usuario: publicUser(user) });
}));
app.get('/api/v1/auth/me', auth(), asyncRoute(async (req, res) => { const user = await findById('usuarios', req.user.id); if (!user || !user.ativo) return errorResponse(res, 401, 'UNAUTHENTICATED', 'Invalid user.'); res.json({ usuario: publicUser(user) }); }));
app.post('/api/v1/auth/logout', auth(), (req, res) => res.status(204).send());

const simpleResources = {
  clientes: { table: 'clientes', fields: ['nome', 'cpf_cnpj', 'email', 'telefone', 'endereco'], required: ['nome', 'cpf_cnpj'] },
  funcionarios: { table: 'funcionarios', fields: ['nome', 'cargo', 'matricula'], required: ['nome', 'cargo', 'matricula'], admin: true },
  veiculos: { table: 'veiculos', fields: ['cliente_id', 'placa', 'marca', 'modelo', 'cor', 'quilometragem', 'ultima_visita', 'carroceria'], required: ['cliente_id', 'placa', 'marca', 'modelo'] }
};

for (const [resource, config] of Object.entries(simpleResources)) {
  const base = `/api/v1/${resource}`;
  app.get(base, auth(), asyncRoute(async (req, res) => {
    const { page, limit, offset } = pagination(req.query); const values = []; const where = [];
    if (req.query.search) { values.push(`%${req.query.search}%`); const searchField = resource === 'veiculos' ? 'placa' : resource === 'clientes' ? 'cpf_cnpj' : 'matricula'; where.push(`(nome ILIKE $${values.length} OR ${searchField} ILIKE $${values.length})`); }
    if (resource === 'veiculos' && req.query.cliente_id) { values.push(req.query.cliente_id); where.push(`cliente_id = $${values.length}`); }
    const condition = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const count = await pool.query(`SELECT COUNT(*)::int AS total FROM ${config.table} ${condition}`, values); values.push(limit, offset);
    const rows = await pool.query(`SELECT * FROM ${config.table} ${condition} ORDER BY id LIMIT $${values.length - 1} OFFSET $${values.length}`, values);
    res.json({ data: rows.rows, meta: { page, limit, total: count.rows[0].total, pages: Math.ceil(count.rows[0].total / limit) } });
  }));
  app.get(`${base}/:id`, auth(), asyncRoute(async (req, res) => { const row = await findById(config.table, req.params.id); return row ? res.json(row) : errorResponse(res, 404, 'NOT_FOUND', 'Record not found.'); }));
  app.post(base, auth(), config.admin ? adminOnly : (req, res, next) => next(), asyncRoute(async (req, res) => {
    const details = validateBody(req.body || {}, Object.fromEntries(config.required.map((field) => [field, { required: true }]))); if (Object.keys(details).length) return errorResponse(res, 422, 'VALIDATION_ERROR', 'Invalid data.', details);
    const input = { ...req.body }; if (resource === 'veiculos') input.placa = String(input.placa).toUpperCase(); const fields = config.fields.filter((field) => input[field] !== undefined); const values = fields.map((field) => input[field]);
    const result = await pool.query(`INSERT INTO ${config.table} (${fields.join(',')}) VALUES (${fields.map((_, i) => `$${i + 1}`).join(',')}) RETURNING *`, values); res.status(201).json(result.rows[0]);
  }));
  app.patch(`${base}/:id`, auth(), config.admin ? adminOnly : (req, res, next) => next(), asyncRoute(async (req, res) => {
    const input = { ...req.body }; if (resource === 'veiculos' && input.placa) input.placa = String(input.placa).toUpperCase(); const fields = config.fields.filter((field) => input[field] !== undefined); if (!fields.length) return errorResponse(res, 422, 'VALIDATION_ERROR', 'No fields to update.');
    const values = fields.map((field) => input[field]); values.push(req.params.id); const result = await pool.query(`UPDATE ${config.table} SET ${fields.map((field, i) => `${field} = $${i + 1}`).join(', ')} WHERE id = $${values.length} RETURNING *`, values); return result.rows[0] ? res.json(result.rows[0]) : errorResponse(res, 404, 'NOT_FOUND', 'Record not found.');
  }));
  app.delete(`${base}/:id`, auth(), config.admin ? adminOnly : (req, res, next) => next(), asyncRoute(async (req, res) => { const result = await pool.query(`DELETE FROM ${config.table} WHERE id = $1`, [req.params.id]); return result.rowCount ? res.status(204).send() : errorResponse(res, 404, 'NOT_FOUND', 'Record not found.'); }));
}

app.get('/api/v1/clientes/:cliente_id/veiculos', auth(), asyncRoute(async (req, res) => { const result = await pool.query('SELECT * FROM veiculos WHERE cliente_id = $1 ORDER BY id', [req.params.cliente_id]); res.json({ data: result.rows, meta: { total: result.rowCount } }); }));

async function validateOrderReferences(body) {
  const details = validateBody(body, { titulo: { required: true }, cliente_id: { required: true }, veiculo_id: { required: true }, responsavel_id: { required: true } });
  if (body.status !== undefined && !statuses.includes(body.status)) details.status = ['Invalid status.'];
  for (const [field, table] of [['cliente_id', 'clientes'], ['veiculo_id', 'veiculos'], ['responsavel_id', 'funcionarios']]) if (body[field] !== undefined && !(await findById(table, body[field]))) details[field] = ['Related record not found.'];
  if (body.cliente_id && body.veiculo_id) { const vehicle = await findById('veiculos', body.veiculo_id); if (vehicle && Number(vehicle.cliente_id) !== Number(body.cliente_id)) details.veiculo_id = ['The vehicle does not belong to the specified client.']; }
  return details;
}

function orderEntries(body) { return ['titulo', 'cliente_id', 'veiculo_id', 'responsavel_id', 'status', 'observacao', 'data_inicio', 'valor'].filter((field) => body[field] !== undefined).map((field) => [field, body[field]]); }

app.get('/api/v1/ordens-servico', auth(), asyncRoute(async (req, res) => {
  const { page, limit, offset } = pagination(req.query); const values = []; const where = [];
  for (const [key, expression] of [['responsavel_id', 'responsavel_id ='], ['cliente_id', 'cliente_id ='], ['veiculo_id', 'veiculo_id ='], ['status', 'status ='], ['valor_min', 'valor >='], ['valor_max', 'valor <=']]) if (req.query[key] !== undefined) { values.push(req.query[key]); where.push(`${expression} $${values.length}`); }
  if (req.query.data_inicio_de) { values.push(req.query.data_inicio_de); where.push(`data_inicio >= $${values.length}`); } if (req.query.data_inicio_ate) { values.push(`${req.query.data_inicio_ate} 23:59:59`); where.push(`data_inicio <= $${values.length}`); }
  const order = { data_inicio_asc: 'data_inicio ASC', valor_desc: 'valor DESC', valor_asc: 'valor ASC' }[req.query.sort] || 'data_inicio DESC'; const condition = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const count = await pool.query(`SELECT COUNT(*)::int AS total FROM ordens_servico ${condition}`, values); values.push(limit, offset); const rows = await pool.query(`SELECT * FROM ordens_servico ${condition} ORDER BY ${order} NULLS LAST LIMIT $${values.length - 1} OFFSET $${values.length}`, values);
  res.json({ data: rows.rows, meta: { page, limit, total: count.rows[0].total, pages: Math.ceil(count.rows[0].total / limit) } });
}));
app.get('/api/v1/ordens-servico/:id', auth(), asyncRoute(async (req, res) => { const row = await findById('ordens_servico', req.params.id); return row ? res.json(row) : errorResponse(res, 404, 'NOT_FOUND', 'Record not found.'); }));

async function saveOrder(req, res) {
  const existing = req.params.id ? await findById('ordens_servico', req.params.id) : null; if (req.params.id && !existing) return errorResponse(res, 404, 'NOT_FOUND', 'Service order not found.');
  const body = existing ? { ...existing, ...req.body } : req.body || {}; const details = await validateOrderReferences(body); if (Object.keys(details).length) return errorResponse(res, 422, 'VALIDATION_ERROR', 'Invalid data.', details);
  const entries = orderEntries(req.body || {}); if (req.params.id && !entries.length) return errorResponse(res, 422, 'VALIDATION_ERROR', 'No fields to update.');
  if (req.params.id && req.body.status === 'finalizado' && existing.status !== 'finalizado') { const end = req.body.data_fim || new Date().toISOString(); entries.push(['data_fim', end], ['tempo_decorrido_minutos', Math.max(0, Math.round((new Date(end) - new Date(body.data_inicio)) / 60000))]); }
  if (req.params.id && req.body.status && req.body.status !== 'finalizado') entries.push(['data_fim', null], ['tempo_decorrido_minutos', 0]);
  const fields = entries.map(([field]) => field); const values = entries.map(([, value]) => value);
  if (!req.params.id) { const result = await pool.query(`INSERT INTO ordens_servico (${fields.join(',')}) VALUES (${fields.map((_, i) => `$${i + 1}`).join(',')}) RETURNING *`, values); return res.status(201).json(result.rows[0]); }
  values.push(req.params.id); const result = await pool.query(`UPDATE ordens_servico SET ${fields.map((field, i) => `${field} = $${i + 1}`).join(', ')} WHERE id = $${values.length} RETURNING *`, values); return res.json(result.rows[0]);
}
app.post('/api/v1/ordens-servico', auth(), asyncRoute(saveOrder)); app.patch('/api/v1/ordens-servico/:id', auth(), asyncRoute(saveOrder)); app.patch('/api/v1/ordens-servico/:id/status', auth(), asyncRoute((req, res) => saveOrder({ ...req, body: { status: req.body?.status } }, res)));
app.delete('/api/v1/ordens-servico/:id', auth(), asyncRoute(async (req, res) => { const result = await pool.query('DELETE FROM ordens_servico WHERE id = $1', [req.params.id]); return result.rowCount ? res.status(204).send() : errorResponse(res, 404, 'NOT_FOUND', 'Service order not found.'); }));

app.get('/api/v1/dashboard/resumo', auth(), asyncRoute(async (req, res) => {
  const from = req.query.de || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10); const to = req.query.ate || new Date().toISOString().slice(0, 10);
  const result = await pool.query(`SELECT (SELECT COUNT(*) FROM ordens_servico WHERE status = 'em_andamento')::int AS ordens_abertas, (SELECT COUNT(*) FROM veiculos)::int AS veiculos_total, (SELECT COALESCE(SUM(valor), 0) FROM ordens_servico WHERE data_inicio >= $1 AND data_inicio < ($2::date + INTERVAL '1 day'))::numeric AS receita_periodo, (SELECT COUNT(DISTINCT cliente_id) FROM veiculos)::int AS clientes_ativos`, [from, to]);
  res.json({ ...result.rows[0], periodo: { de: from, ate: to }, receita_periodo: Number(result.rows[0].receita_periodo) });
}));

app.use((req, res) => errorResponse(res, 404, 'NOT_FOUND', 'Route not found.'));
app.use((error, req, res, next) => { console.error(error); if (error.code === '23505') return errorResponse(res, 409, 'CONFLICT', 'Duplicate record.'); if (error.code === '23503') return errorResponse(res, 422, 'VALIDATION_ERROR', 'Related record not found.'); return errorResponse(res, 500, 'INTERNAL_ERROR', 'Internal server error.'); });

if (require.main === module) app.listen(port, () => console.log(`MWM API available at http://localhost:${port}`));
module.exports = { app, pool };
