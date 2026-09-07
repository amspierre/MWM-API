const jwt = require('jsonwebtoken');

function errorResponse(res, status, code, message, details) {
  return res.status(status).json({ error: { code, message, ...(details ? { details } : {}) } });
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function auth() {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) return errorResponse(res, 401, 'UNAUTHENTICATED', 'Autenticação necessária.');
    try {
      req.user = jwt.verify(header.slice(7), process.env.JWT_SECRET || 'development-only-secret');
      return next();
    } catch {
      return errorResponse(res, 401, 'INVALID_TOKEN', 'Token inválido ou expirado.');
    }
  };
}

function adminOnly(req, res, next) {
  return req.user?.perfil === 'admin' ? next() : errorResponse(res, 403, 'FORBIDDEN', 'Permissão insuficiente.');
}

function pagination(query) {
  const page = Math.max(Number.parseInt(query.page || '1', 10), 1);
  const limit = Math.min(Math.max(Number.parseInt(query.limit || '20', 10), 1), 100);
  return { page, limit, offset: (page - 1) * limit };
}

function validateRequired(body, fields) {
  const details = {};
  for (const field of fields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') details[field] = ['Campo obrigatório.'];
  }
  return details;
}

module.exports = { errorResponse, asyncRoute, auth, adminOnly, pagination, validateRequired };