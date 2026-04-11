const express = require('express');
const createAuthMiddleware = require('../middleware/auth');

function todoDbError(res, err) {
  console.error(err);
  if (err.code === 'ER_NO_SUCH_TABLE') {
    return res.status(500).json({ error: 'Create the todos table (see database.sql).' });
  }
  return res.status(500).json({ error: 'Database error' });
}

function parseTodoId(req) {
  const id = +req.params.id;
  return Number.isInteger(id) && id >= 1 ? id : null;
}

module.exports = function createTodosRoutes({ pool, JWT_SECRET }) {
  const router = express.Router();
  router.use(createAuthMiddleware(JWT_SECRET));

  router.get('/', async (req, res) => {
    try {
      const [rows] = await pool.query(
        'SELECT id, title, done FROM todos WHERE user_id = ? ORDER BY id DESC',
        [req.userId]
      );
      res.json({ todos: rows });
    } catch (e) {
      todoDbError(res, e);
    }
  });

  router.post('/', async (req, res) => {
    const title = String(req.body?.title || '').trim();
    if (!title) return res.status(400).json({ error: 'Title required' });
    try {
      const [r] = await pool.query('INSERT INTO todos (user_id, title) VALUES (?, ?)', [req.userId, title]);
      res.status(201).json({ todo: { id: r.insertId, title, done: 0 } });
    } catch (e) {
      todoDbError(res, e);
    }
  });

  router.patch('/:id', async (req, res) => {
    const id = parseTodoId(req);
    if (id == null) return res.status(400).json({ error: 'Invalid id' });
    const { done, title } = req.body;
    let sql;
    let params;
    if (typeof done === 'boolean') {
      sql = 'UPDATE todos SET done = ? WHERE id = ? AND user_id = ?';
      params = [done ? 1 : 0, id, req.userId];
    } else if (title != null && String(title).trim() !== '') {
      sql = 'UPDATE todos SET title = ? WHERE id = ? AND user_id = ?';
      params = [String(title).trim(), id, req.userId];
    } else {
      return res.status(400).json({ error: 'Send done (boolean) or title (string)' });
    }
    try {
      const [r] = await pool.query(sql, params);
      if (!r.affectedRows) return res.status(404).json({ error: 'Task not found' });
      res.json({ message: 'Updated' });
    } catch (e) {
      todoDbError(res, e);
    }
  });

  router.delete('/:id', async (req, res) => {
    const id = parseTodoId(req);
    if (id == null) return res.status(400).json({ error: 'Invalid id' });
    try {
      const [r] = await pool.query('DELETE FROM todos WHERE id = ? AND user_id = ?', [id, req.userId]);
      if (!r.affectedRows) return res.status(404).json({ error: 'Task not found' });
      res.json({ message: 'Deleted' });
    } catch (e) {
      todoDbError(res, e);
    }
  });

  return router;
};
