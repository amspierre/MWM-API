const { query, findById, removeById } = require('../database');

const fields = ['nome', 'cpf_cnpj', 'email', 'telefone', 'endereco'];

async function list({ page, limit, offset, search }) {
  const values = []; const where = [];
  if (search) { values.push(`%${search}%`); where.push(`(nome ILIKE $1 OR cpf_cnpj ILIKE $1)`); }
  const condition = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const count = await query(`SELECT COUNT(*)::int AS total FROM clientes ${condition}`, values);
  values.push(limit, offset);
  const result = await query(`SELECT * FROM clientes ${condition} ORDER BY id LIMIT $${values.length - 1} OFFSET $${values.length}`, values);
  return { data: result.rows, total: count.rows[0].total };
}

async function create(input) {
  const selected = fields.filter((field) => input[field] !== undefined);
  const result = await query(`INSERT INTO clientes (${selected.join(',')}) VALUES (${selected.map((_, index) => `$${index + 1}`).join(',')}) RETURNING *`, selected.map((field) => input[field]));
  return result.rows[0];
}

async function update(id, input) {
  const selected = fields.filter((field) => input[field] !== undefined);
  if (!selected.length) return null;
  const values = selected.map((field) => input[field]); values.push(id);
  const result = await query(`UPDATE clientes SET ${selected.map((field, index) => `${field} = $${index + 1}`).join(', ')} WHERE id = $${values.length} RETURNING *`, values);
  return result.rows[0] || null;
}

module.exports = { list, findById: (id) => findById('clientes', id), create, update, remove: (id) => removeById('clientes', id) };