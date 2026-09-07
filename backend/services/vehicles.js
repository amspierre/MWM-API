const { query, findById, removeById } = require('../database');

const fields = ['cliente_id', 'placa', 'marca', 'modelo', 'cor', 'quilometragem', 'ultima_visita', 'carroceria'];

async function list({ page, limit, offset, search, cliente_id }) {
  const values = []; const where = [];
  if (search) { values.push(`%${search.toUpperCase()}%`); where.push(`placa ILIKE $${values.length}`); }
  if (cliente_id) { values.push(cliente_id); where.push(`cliente_id = $${values.length}`); }
  const condition = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const count = await query(`SELECT COUNT(*)::int AS total FROM veiculos ${condition}`, values); values.push(limit, offset);
  const result = await query(`SELECT * FROM veiculos ${condition} ORDER BY id LIMIT $${values.length - 1} OFFSET $${values.length}`, values);
  return { data: result.rows, total: count.rows[0].total };
}

async function create(input) {
  const data = { ...input, placa: String(input.placa).toUpperCase() };
  const selected = fields.filter((field) => data[field] !== undefined);
  const result = await query(`INSERT INTO veiculos (${selected.join(',')}) VALUES (${selected.map((_, index) => `$${index + 1}`).join(',')}) RETURNING *`, selected.map((field) => data[field]));
  return result.rows[0];
}

async function update(id, input) {
  const data = { ...input }; if (data.placa) data.placa = String(data.placa).toUpperCase();
  const selected = fields.filter((field) => data[field] !== undefined); if (!selected.length) return null;
  const values = selected.map((field) => data[field]); values.push(id);
  const result = await query(`UPDATE veiculos SET ${selected.map((field, index) => `${field} = $${index + 1}`).join(', ')} WHERE id = $${values.length} RETURNING *`, values);
  return result.rows[0] || null;
}

module.exports = { list, findById: (id) => findById('veiculos', id), create, update, remove: (id) => removeById('veiculos', id), byClient: (id) => query('SELECT * FROM veiculos WHERE cliente_id = $1 ORDER BY id', [id]) };