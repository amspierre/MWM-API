const { query, findById, removeById } = require('../database');

const fields = ['nome', 'cargo', 'matricula'];

async function list({ page, limit, offset, search }) {
  const values = []; const where = search ? '(nome ILIKE $1 OR matricula ILIKE $1)' : '';
  if (search) values.push(`%${search}%`);
  const condition = where ? `WHERE ${where}` : '';
  const count = await query(`SELECT COUNT(*)::int AS total FROM funcionarios ${condition}`, values); values.push(limit, offset);
  const result = await query(`SELECT * FROM funcionarios ${condition} ORDER BY id LIMIT $${values.length - 1} OFFSET $${values.length}`, values);
  return { data: result.rows, total: count.rows[0].total };
}

async function create(input) {
  const result = await query(`INSERT INTO funcionarios (${fields.join(',')}) VALUES ($1,$2,$3) RETURNING *`, fields.map((field) => input[field]));
  return result.rows[0];
}

async function update(id, input) {
  const selected = fields.filter((field) => input[field] !== undefined); if (!selected.length) return null;
  const values = selected.map((field) => input[field]); values.push(id);
  const result = await query(`UPDATE funcionarios SET ${selected.map((field, index) => `${field} = $${index + 1}`).join(', ')} WHERE id = $${values.length} RETURNING *`, values);
  return result.rows[0] || null;
}

module.exports = { list, findById: (id) => findById('funcionarios', id), create, update, remove: (id) => removeById('funcionarios', id) };