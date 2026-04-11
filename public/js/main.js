import { api } from './api.js';
import { $, ui, flash, setSession, showAuth, showApp } from './ui.js';
import { loadTodos, initSession } from './todos.js';

function creds(form) {
  const fd = new FormData(form);
  return {
    username: String(fd.get('username') || '').trim(),
    password: String(fd.get('password') || '')
  };
}

// Tabs
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
