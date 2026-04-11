const jwt = require('jsonwebtoken');

module.exports = function createAuth(JWT_SECRET) {
  return function auth(req, res, next) {
    const h = req.headers.authorization;
    const token = h?.startsWith('Bearer ') ? h.slice(7) : null;
    if (!token) {
      return res.status(401).json({ error: 'Authorization: Bearer <token> header required' });
    }
    try {
      req.userId = jwt.verify(token, JWT_SECRET).id;
      next();
    } catch {
      res.status(403).json({ error: 'Invalid or expired token' });
    }
  };
};
