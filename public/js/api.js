import { TOKEN, API_BASE } from './config.js';

/** All HTTP calls: JSON + Bearer token; returns { ok, status, data, networkError } */
export async function api(method, path, body) {
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
    /* empty body */
  }
  return { ok: res.ok, status: res.status, data, networkError: false };
}
