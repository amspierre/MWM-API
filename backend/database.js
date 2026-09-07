const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function query(text, values) {
  return pool.query(text, values);
}

async function findById(table, id) {
  const result = await query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
  return result.rows[0] || null;
}

async function removeById(table, id) {
  return query(`DELETE FROM ${table} WHERE id = $1`, [id]);
}

module.exports = { pool, query, findById, removeById };