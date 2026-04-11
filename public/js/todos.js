import { TOKEN } from './config.js';
import { api } from './api.js';
import { ui, flash, showAuth, showApp, setSession } from './ui.js';

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const isDone = (v) => v === true || v === 1 || v === '1';

export function renderTodos(rows) {
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

export async function loadTodos() {
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

export async function initSession() {
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
