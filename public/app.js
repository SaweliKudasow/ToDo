const TOKEN = 'todo_token';
const API_BASE = window.location.pathname.startsWith('/todo') ? '/todo' : '';

const $ = (sel) => document.querySelector(sel);

const ui = {
  flash: $('#flash'),
  auth: $('#authSection'),
  todos: $('#todoSection'),
  userBar: $('#userBar'),
  list: $('#todoList'),
  empty: $('#todoEmpty')
};

function flash(msg, cls) {
  const text = msg == null ? '' : String(msg);
  ui.flash.textContent = text;
  ui.flash.className = 'flash' + (cls ? ` ${cls}` : '');
  ui.flash.classList.toggle('hidden', text.length === 0);
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Single entry for all API calls: JSON parsing + network error handling */
async function api(method, path, body) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const t = localStorage.getItem(TOKEN);
  if (t) headers.Authorization = `Bearer ${t}`;
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  } catch {
    return { ok: false, status: 0, data: {}, networkError: true };
  }
  let data = {};
  try {
    data = JSON.parse(await res.text());
  } catch {
    /* empty response body */
  }
  return { ok: res.ok, status: res.status, data, networkError: false };
}

function setSession(token) {
  if (token) localStorage.setItem(TOKEN, token);
  else localStorage.removeItem(TOKEN);
}

function showAuth() {
  ui.auth.classList.remove('hidden');
  ui.todos.classList.add('hidden');
  ui.userBar.classList.add('hidden');
}

function showApp(username) {
  ui.auth.classList.add('hidden');
  ui.todos.classList.remove('hidden');
  ui.userBar.classList.remove('hidden');
  $('#userName').textContent = username || '';
}

function creds(form) {
  const fd = new FormData(form);
  return {
    username: String(fd.get('username') || '').trim(),
    password: String(fd.get('password') || '')
  };
}

const isDone = (v) => v === true || v === 1 || v === '1';

function renderTodos(rows) {
  const list = Array.isArray(rows) ? rows : [];
  ui.empty.classList.toggle('hidden', list.length > 0);
  ui.list.innerHTML = list
    .map(
      (t) => `
    <li class="todo-item${isDone(t.done) ? ' done' : ''}" data-id="${t.id}">
      <input type="checkbox" data-done="${t.id}" ${isDone(t.done) ? 'checked' : ''} />
      <span class="todo-title">${escapeHtml(t.title)}</span>
      <button type="button" class="btn btn-danger" data-del="${t.id}">Delete</button>
    </li>`
    )
    .join('');
}

async function loadTodos() {
  const r = await api('GET', '/todos');
  if (r.networkError) return flash('Cannot reach the server', 'error');
  if (r.status === 401 || r.status === 403) {
    setSession(null);
    showAuth();
    return flash('Session expired — please sign in again.', 'error');
  }
  if (!r.ok) return flash(r.data.error || 'Could not load tasks', 'error');
  renderTodos(r.data.todos || []);
}

async function initSession() {
  const tokenAtStart = localStorage.getItem(TOKEN);
  if (!tokenAtStart) return showAuth();
  const r = await api('GET', '/me');
  if (localStorage.getItem(TOKEN) !== tokenAtStart) return;
  if (!r.ok) {
    setSession(null);
    showAuth();
    if (r.status === 401 || r.status === 403) flash('Please sign in again.', 'error');
    return;
  }
  showApp(r.data.user?.username);
  await loadTodos();
}

// --- Sign in / Register tabs ---
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
  const r = await api('POST', '/login', creds(e.target));
  if (r.networkError) return flash('Cannot reach the server', 'error');
  if (!r.ok) return flash(r.data.error || 'Could not sign in', 'error');
  if (!r.data.token) return flash('Server did not return a token', 'error');
  setSession(r.data.token);
  showApp(r.data.user?.username);
  e.target.reset();
  await loadTodos();
});

$('#registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  flash('');
  const body = creds(e.target);
  let r = await api('POST', '/register', body);
  if (r.networkError) return flash('Cannot reach the server', 'error');
  if (!r.ok) return flash(r.data.error || 'Registration failed', 'error');
  r = await api('POST', '/login', body);
  if (!r.ok) {
    flash('Account created. Please sign in.', 'success');
    document.querySelector('.tab[data-tab="login"]')?.click();
    return;
  }
  setSession(r.data.token);
  showApp(r.data.user?.username);
  e.target.reset();
  await loadTodos();
});

$('#logoutBtn').addEventListener('click', () => {
  setSession(null);
  showAuth();
  ui.list.innerHTML = '';
  flash('');
});

$('#addTodoForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  flash('');
  const title = String(new FormData(e.target).get('title') || '').trim();
  if (!title) return;
  const r = await api('POST', '/todos', { title });
  if (r.networkError) return flash('Cannot reach the server', 'error');
  if (!r.ok) return flash(r.data.error || 'Could not add task', 'error');
  e.target.reset();
  await loadTodos();
});

// Event delegation on the list: checkbox + delete button
ui.list.addEventListener('change', async (e) => {
  const id = e.target.dataset.done;
  if (!id || e.target.type !== 'checkbox') return;
  const r = await api('PATCH', `/todos/${id}`, { done: e.target.checked });
  if (!r.ok) flash(r.data.error || 'Could not update task', 'error');
  await loadTodos();
});

ui.list.addEventListener('click', async (e) => {
  const id = e.target.closest('[data-del]')?.dataset.del;
  if (!id) return;
  if (!confirm('Delete this task from the database?')) return;
  const r = await api('DELETE', `/todos/${id}`);
  if (!r.ok) return flash(r.data.error || 'Could not delete task', 'error');
  await loadTodos();
});

initSession();
