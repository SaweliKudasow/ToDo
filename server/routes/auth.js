const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const createAuthMiddleware = require('../middleware/auth');

function readCredentials(req) {
  const username = String(req.body?.username || '').trim();
  const password = req.body?.password;
  if (!username || !password) return null;
  return { username, password };
}

module.exports = function createAuthRoutes({ pool, JWT_SECRET }) {
  const router = express.Router();
  const auth = createAuthMiddleware(JWT_SECRET);

  router.post('/register', async (req, res) => {
    const creds = readCredentials(req);
    if (!creds) return res.status(400).json({ error: 'Username and password required' });
    try {
      await pool.query('INSERT INTO users (username, password) VALUES (?, ?)', [
        creds.username,
        await bcrypt.hash(creds.password, 10)
      ]);
      res.status(201).json({ message: 'User created' });
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Username already taken' });
      res.status(400).json({ error: 'Database error' });
    }
  });

  router.post('/login', async (req, res) => {
    const creds = readCredentials(req);
    if (!creds) return res.status(400).json({ error: 'Username and password required' });
    try {
      const [rows] = await pool.query('SELECT id, username, password FROM users WHERE username = ?', [
        creds.username
      ]);
      const user = rows[0];
      if (!user || !(await bcrypt.compare(creds.password, user.password))) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }
      res.json({
        token: jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '8h' }),
        user: { id: user.id, username: user.username }
      });
    } catch (e) {
      console.error('Login DB error:', e);
      res.status(500).json({ error: 'Database error' });
    }
  });

  router.get('/me', auth, async (req, res) => {
    try {
      const [rows] = await pool.query('SELECT id, username FROM users WHERE id = ?', [req.userId]);
      if (!rows.length) return res.status(404).json({ error: 'User not found' });
      res.json({ user: rows[0] });
    } catch {
      res.status(500).json({ error: 'Database error' });
    }
  });

  return router;
};
