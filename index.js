const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET;

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

function todoDbError(res, err) {
  console.error(err);
  if (err.code === 'ER_NO_SUCH_TABLE') {
    return res.status(500).json({ error: 'Create the todos table (see database.sql).' });
  }
  return res.status(500).json({ error: 'Database error' });
}

function auth(req, res, next) {
  const h = req.headers.authorization;
  const token = h?.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authorization: Bearer <token> header required' });
  try {
    req.userId = jwt.verify(token, JWT_SECRET).id;
    next();
  } catch {
    res.status(403).json({ error: 'Invalid or expired token' });
  }
}

function readCredentials(req) {
  const username = String(req.body?.username || '').trim();
  const password = req.body?.password;
  if (!username || !password) return null;
  return { username, password };
}

function parseTodoId(req) {
  const id = +req.params.id;
  return Number.isInteger(id) && id >= 1 ? id : null;
}

// --- Auth: no path prefix; the client calls /login, /register, /me ---
app.post('/register', async (req, res) => {
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

app.post('/login', async (req, res) => {
  const creds = readCredentials(req);
  if (!creds) return res.status(400).json({ error: 'Username and password required' });
  try {
    const [rows] = await pool.query('SELECT id, username, password FROM users WHERE username = ?', [creds.username]);
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

app.get('/me', auth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, username FROM users WHERE id = ?', [req.userId]);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ user: rows[0] });
  } catch {
    res.status(500).json({ error: 'Database error' });
  }
});

// --- Tasks: one Router; auth runs once for all /todos/* routes ---
const todos = express.Router();
todos.use(auth);

todos.get('/', async (req, res) => {
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

todos.post('/', async (req, res) => {
  const title = String(req.body?.title || '').trim();
  if (!title) return res.status(400).json({ error: 'Title required' });
  try {
    const [r] = await pool.query('INSERT INTO todos (user_id, title) VALUES (?, ?)', [req.userId, title]);
    res.status(201).json({ todo: { id: r.insertId, title, done: 0 } });
  } catch (e) {
    todoDbError(res, e);
  }
});

todos.patch('/:id', async (req, res) => {
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

todos.delete('/:id', async (req, res) => {
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

app.use('/todos', todos);

app.use(express.static(path.join(__dirname, 'public')));

module.exports = app;
