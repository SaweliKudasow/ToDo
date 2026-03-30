require('dotenv').config();
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
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

app.post('/register', async (req, res) => {
  const username = String(req.body.username || '').trim();
  const { password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  try {
    await pool.query('INSERT INTO users (username, password) VALUES (?, ?)', [
      username,
      await bcrypt.hash(password, 10)
    ]);
    res.status(201).json({ message: 'User created' });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Username already taken' });
    res.status(400).json({ error: 'Database error' });
  }
});

app.post('/login', async (req, res) => {
  const username = String(req.body.username || '').trim();
  const { password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  try {
    const [rows] = await pool.query('SELECT id, username, password FROM users WHERE username = ?', [username]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    res.json({
      token: jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '8h' }),
      user: { id: user.id, username: user.username }
    });
  } catch {
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

app.get('/todos', auth, async (req, res) => {
  try {
    const [todos] = await pool.query(
      'SELECT id, title, done FROM todos WHERE user_id = ? ORDER BY id DESC',
      [req.userId]
    );
    res.json({ todos });
  } catch (e) {
    todoDbError(res, e);
  }
});

app.post('/todos', auth, async (req, res) => {
  const title = String(req.body.title || '').trim();
  if (!title) return res.status(400).json({ error: 'Title required' });
  try {
    const [r] = await pool.query('INSERT INTO todos (user_id, title) VALUES (?, ?)', [req.userId, title]);
    res.status(201).json({ todo: { id: r.insertId, title, done: 0 } });
  } catch (e) {
    todoDbError(res, e);
  }
});

app.patch('/todos/:id', auth, async (req, res) => {
  const id = +req.params.id;
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid id' });
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

app.delete('/todos/:id', auth, async (req, res) => {
  const id = +req.params.id;
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid id' });
  try {
    const [r] = await pool.query('DELETE FROM todos WHERE id = ? AND user_id = ?', [id, req.userId]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Task not found' });
    res.json({ message: 'Deleted' });
  } catch (e) {
    todoDbError(res, e);
  }
});

const certPath = path.join(__dirname, '..', 'Proxy', 'certs');
const options = {
  key: fs.readFileSync(path.join(certPath, 'privkey.pem')),
  cert: fs.readFileSync(path.join(certPath, 'fullchain.pem'))
};

app.use(express.static(path.join(__dirname, 'public')));

http.createServer(app).listen(8080, () => console.log('HTTP http://localhost:8080'));
https.createServer(options, app).listen(8443, () => console.log('HTTPS https://localhost:8443'));
