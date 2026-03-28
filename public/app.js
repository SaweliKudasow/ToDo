const TOKEN = 'todo_token';

const $ = (s) => document.querySelector(s);
const flashEl = $('#flash');
const authEl = $('#authSection');
const todoEl = $('#todoSection');
const userBar = $('#userBar');

function flash(msg, cls) {
  if (!flashEl) return;
  const text = msg == null ? '' : String(msg);
  flashEl.textContent = text;
  flashEl.className = 'flash' + (cls ? ` ${cls}` : '');
  flashEl.classList.toggle('hidden', text.length === 0);
}

async function api(path, { method = 'GET', body } = {}) {
  const headers = {};
  if (body != null) headers['Content-Type'] = 'application/json';
  const t = localStorage.getItem(TOKEN);
  if (t) headers.Authorization = `Bearer ${t}`;
  const res = await fetch(path, { method, headers, body: body != null ? JSON.stringify(body) : undefined });
  let data = {};
  try {
    data = JSON.parse(await res.text());
  } catch {
    /* empty body */
  }
  return { res, data };
}

function showAuth() {
  authEl.classList.remove('hidden');
  todoEl.classList.add('hidden');
  userBar.classList.add('hidden');
}

function showApp(name) {
  authEl.classList.add('hidden');
  todoEl.classList.remove('hidden');
  userBar.classList.remove('hidden');
  $('#userName').textContent = name || '';
}

function session(token) {
  if (token) localStorage.setItem(TOKEN, token);
  else localStorage.removeItem(TOKEN);
}

document.querySelectorAll('.tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('hidden', p.dataset.panel !== tab));
    flash('');
  });
});

$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  flash('');
  try {
    const fd = new FormData(e.target);
    const { res, data } = await api('/login', {
      method: 'POST',
      body: { username: String(fd.get('username') || '').trim(), password: String(fd.get('password') || '') }
    });
    if (!res.ok) return flash(data.error || 'Could not sign in', 'error');
    if (!data.token) return flash('Server did not return a token', 'error');
    session(data.token);
    showApp(data.user?.username);
    e.target.reset();
    await loadTodos();
  } catch {
    flash('Cannot reach the server', 'error');
  }
});

$('#registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  flash('');
  const fd = new FormData(e.target);
  const creds = {
    username: String(fd.get('username') || '').trim(),
    password: String(fd.get('password') || '')
  };
  let { res, data } = await api('/register', { method: 'POST', body: creds });
  if (!res.ok) return flash(data.error || 'Registration failed', 'error');
  ({ res, data } = await api('/login', { method: 'POST', body: creds }));
  if (!res.ok) {
    flash('Account created. Please sign in.', 'success');
    document.querySelector('.tab[data-tab="login"]')?.click();
    return;
  }
  session(data.token);
  showApp(data.user?.username);
  e.target.reset();
  await loadTodos();
});

$('#logoutBtn').addEventListener('click', () => {
  session(null);
  showAuth();
  $('#todoList').innerHTML = '';
  flash('');
});

const done = (v) => v === true || v === 1 || v === '1';

function renderTodos(todos) {
  const rows = Array.isArray(todos) ? todos : [];
  const list = $('#todoList');
  const empty = $('#todoEmpty');
  list.innerHTML = '';
  empty.classList.toggle('hidden', rows.length > 0);
  for (const t of rows) {
    const d = done(t.done);
    const li = document.createElement('li');
    li.className = 'todo-item' + (d ? ' done' : '');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = d;
    cb.onchange = () => patchTodo(t.id, cb.checked);
    const span = document.createElement('span');
    span.className = 'todo-title';
    span.textContent = t.title;
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'btn btn-danger';
    del.textContent = 'Delete';
    del.onclick = () => removeTodo(t.id);
    li.append(cb, span, del);
    list.appendChild(li);
  }
}

async function loadTodos() {
  const { res, data } = await api('/todos');
  if (res.status === 401 || res.status === 403) {
    session(null);
    showAuth();
    return flash('Session expired — please sign in again.', 'error');
  }
  if (!res.ok) return flash(data.error || 'Could not load tasks', 'error');
  renderTodos(data.todos || []);
}

async function patchTodo(id, isDone) {
  const { res, data } = await api(`/todos/${id}`, { method: 'PATCH', body: { done: isDone } });
  if (!res.ok) {
    flash(data.error || 'Could not update task', 'error');
  }
  await loadTodos();
}

async function removeTodo(id) {
  if (!confirm('Delete this task from the database?')) return;
  const { res, data } = await api(`/todos/${id}`, { method: 'DELETE' });
  if (!res.ok) return flash(data.error || 'Could not delete task', 'error');
  await loadTodos();
}

$('#addTodoForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  flash('');
  const title = String(new FormData(e.target).get('title') || '').trim();
  if (!title) return;
  const { res, data } = await api('/todos', { method: 'POST', body: { title } });
  if (!res.ok) return flash(data.error || 'Could not add task', 'error');
  e.target.reset();
  await loadTodos();
});

// On reload: restore session from token.
// After await, compare token to the one at start — otherwise a stale /me response
// can finish after a new login and clear the new session.
async function initSession() {
  const tokenAtStart = localStorage.getItem(TOKEN);
  if (!tokenAtStart) return showAuth();
  const { res, data } = await api('/me');
  if (localStorage.getItem(TOKEN) !== tokenAtStart) return;
  if (!res.ok) {
    session(null);
    showAuth();
    if (res.status === 401 || res.status === 403) flash('Please sign in again.', 'error');
    return;
  }
  const u = data.user && data.user.username;
  showApp(u);
  await loadTodos();
}

initSession();
