const { query, findById, removeById } = require('../database');

const statuses = ['em_andamento', 'finalizado', 'pendente'];
const fields = ['titulo', 'cliente_id', 'veiculo_id', 'responsavel_id', 'status', 'observacao', 'data_inicio', 'valor'];

async function validateReferences(input, requireMainFields = false) {
  const details = {};
  for (const field of ['titulo', 'cliente_id', 'veiculo_id', 'responsavel_id']) {
    if (requireMainFields && (input[field] === undefined || input[field] === null || input[field] === '')) details[field] = ['Campo obrigatório.'];
  }
  if (input.status !== undefined && !statuses.includes(input.status)) details.status = ['Status inválido.'];
  for (const [field, table] of [['cliente_id', 'clientes'], ['veiculo_id', 'veiculos'], ['responsavel_id', 'funcionarios']]) {
    if (input[field] !== undefined && !(await findById(table, input[field]))) details[field] = ['Registro relacionado não encontrado.'];
  }
  if (input.cliente_id !== undefined && input.veiculo_id !== undefined) {
    const vehicle = await findById('veiculos', input.veiculo_id);
    if (vehicle && Number(vehicle.cliente_id) !== Number(input.cliente_id)) details.veiculo_id = ['O veículo não pertence ao cliente informado.'];
  }
  return details;
}

async function list({ page, limit, offset, filters }) {
  const values = []; const where = [];
  const equalFilters = ['responsavel_id', 'cliente_id', 'veiculo_id', 'status'];
  for (const field of equalFilters) if (filters[field] !== undefined) { values.push(filters[field]); where.push(`${field} = $${values.length}`); }
  for (const [field, operator, queryName] of [['valor', '>=', 'valor_min'], ['valor', '<=', 'valor_max'], ['data_inicio', '>=', 'data_inicio_de']]) if (filters[queryName]) { values.push(filters[queryName]); where.push(`${field} ${operator} $${values.length}`); }
  if (filters.data_inicio_ate) { values.push(`${filters.data_inicio_ate} 23:59:59`); where.push(`data_inicio <= $${values.length}`); }
  const condition = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const sort = { data_inicio_asc: 'data_inicio ASC', valor_desc: 'valor DESC', valor_asc: 'valor ASC' }[filters.sort] || 'data_inicio DESC';
  const count = await query(`SELECT COUNT(*)::int AS total FROM ordens_servico ${condition}`, values); values.push(limit, offset);
  const result = await query(`SELECT * FROM ordens_servico ${condition} ORDER BY ${sort} NULLS LAST LIMIT $${values.length - 1} OFFSET $${values.length}`, values);
  return { data: result.rows, total: count.rows[0].total };
}

async function create(input) {
  const details = await validateReferences(input, true); if (Object.keys(details).length) return { details };
  const selected = fields.filter((field) => input[field] !== undefined);
  const result = await query(`INSERT INTO ordens_servico (${selected.join(',')}) VALUES (${selected.map((_, index) => `$${index + 1}`).join(',')}) RETURNING *`, selected.map((field) => input[field]));
  return { row: result.rows[0] };
}

async function update(id, input) {
  const current = await findById('ordens_servico', id); if (!current) return { notFound: true };
  const merged = { ...current, ...input }; const details = await validateReferences(merged); if (Object.keys(details).length) return { details };
  const selected = fields.filter((field) => input[field] !== undefined); if (!selected.length) return { empty: true };
  const values = selected.map((field) => input[field]);
  if (input.status === 'finalizado' && current.status !== 'finalizado') {
    const end = input.data_fim || new Date().toISOString(); selected.push('data_fim', 'tempo_decorrido_minutos'); values.push(end, Math.max(0, Math.round((new Date(end) - new Date(merged.data_inicio)) / 60000)));
  } else if (input.status && input.status !== 'finalizado') { selected.push('data_fim', 'tempo_decorrido_minutos'); values.push(null, 0); }
  values.push(id);
  const result = await query(`UPDATE ordens_servico SET ${selected.map((field, index) => `${field} = $${index + 1}`).join(', ')} WHERE id = $${values.length} RETURNING *`, values);
  return { row: result.rows[0] };
}

module.exports = { list, findById: (id) => findById('ordens_servico', id), create, update, remove: (id) => removeById('ordens_servico', id) };