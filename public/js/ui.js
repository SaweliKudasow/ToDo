import { TOKEN } from './config.js';

export const $ = (sel) => document.querySelector(sel);

export const ui = {
  flash: $('#flash'),
  auth: $('#authSection'),
  todos: $('#todoSection'),
  userBar: $('#userBar'),
  list: $('#todoList'),
  empty: $('#todoEmpty')
};

export function flash(msg, cls) {
  const text = msg == null ? '' : String(msg);
  ui.flash.textContent = text;
  ui.flash.className = 'flash' + (cls ? ` ${cls}` : '');
  ui.flash.classList.toggle('hidden', text.length === 0);
}

export function setSession(token) {
  if (token) localStorage.setItem(TOKEN, token);
  else localStorage.removeItem(TOKEN);
}

export function showAuth() {
  ui.auth.classList.remove('hidden');
  ui.todos.classList.add('hidden');
  ui.userBar.classList.add('hidden');
}

export function showApp(username) {
  ui.auth.classList.add('hidden');
  ui.todos.classList.remove('hidden');
  ui.userBar.classList.remove('hidden');
  $('#userName').textContent = username || '';
}
