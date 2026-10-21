import { createHash, randomBytes, scrypt as derive, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(derive);
const lifetime = 8 * 60 * 60 * 1000;
const cookieName = 'jutsoclone_session';
const digest = value => createHash('sha256').update(value).digest('hex');
const publicUser = account => ({ name: account.name, email: account.email });
const json = (status, data, headers = {}) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers } });
const cookie = request => request.headers.get('cookie')?.split(';').map(v => v.trim()).find(v => v.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
const sessionKey = token => 'sessions/' + digest(token);
const sessionCookie = (request, token, age) => `${cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`;

async function readJSON(request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) return null;
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks = []; let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      bytes += value.length;
      if (bytes > 4096) { await reader.cancel(); return null; }
      chunks.push(value);
    }
    const all = new Uint8Array(bytes); let offset = 0;
    for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.length; }
    const value = JSON.parse(new TextDecoder().decode(all));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch { return null; }
}

// Store contract: get(key), setJSON(key, value, {onlyIfNew}), delete(key).
// The same handlers run locally and in Netlify Functions; credentials never reach the static build.
export async function getAuthenticatedUser(request, store, now = Date.now) {
  const token = cookie(request);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const key = sessionKey(token);
  const session = await store.get(key);
  if (!session) return null;
  if (session.expires <= now()) {
    await store.delete(key);
    return null;
  }
  return session.user ?? null;
}

export function createAuthHandler({ store, legacy = {}, now = Date.now }) {
  const attempts = new Map();
  return async function handle(request, { ip = 'local' } = {}) {
    const url = new URL(request.url), action = url.pathname.replace(/\/$/, '').split('/').at(-1);
    try {
      if (action === 'session' && request.method === 'GET') {
        const token = cookie(request);
        const user = await getAuthenticatedUser(request, store, now);
        if (!user) {
          return json(200, { user: null, registrationAvailable: true }, token ? { 'Set-Cookie': sessionCookie(request, '', 0) } : {});
        }
        return json(200, { user, registrationAvailable: true });
      }
      if (!['login', 'register', 'logout'].includes(action)) return json(404, { error: 'Serviço não encontrado.' });
      if (request.method !== 'POST') return json(405, { error: 'Método não permitido.' }, { Allow: 'POST' });
      if (request.headers.get('origin') !== url.origin) return json(403, { error: 'Origem não autorizada.' });
      if (action === 'logout') {
        const token = cookie(request);
        if (token && /^[a-f0-9]{64}$/.test(token)) await store.delete(sessionKey(token));
        return json(200, { ok: true }, { 'Set-Cookie': sessionCookie(request, '', 0) });
      }
      const minute = Math.floor(now() / 60000), key = ip + ':' + minute;
      for (const [k, value] of attempts) if (value.minute !== minute) attempts.delete(k);
      if (attempts.size > 1024 || (attempts.get(key)?.count || 0) >= 20) return json(429, { error: 'Muitas tentativas. Aguarde um minuto e tente novamente.' }, { 'Retry-After': '60' });
      attempts.set(key, { minute, count: (attempts.get(key)?.count || 0) + 1 });
      const input = await readJSON(request);
      const email = typeof input?.email === 'string' ? input.email.trim().toLowerCase() : '';
      const password = input?.password;
      if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof password !== 'string' || password.length < 8 || password.length > 128) return json(400, { error: 'Informe um e-mail válido e uma senha com 8 a 128 caracteres.' });
      const accountKey = 'accounts/' + digest(email);
      let account;
      if (action === 'register') {
        const name = typeof input.name === 'string' ? input.name.trim() : '';
        if (name.length < 2 || name.length > 80) return json(400, { error: 'Informe um nome com 2 a 80 caracteres.' });
        if (legacy.email === email) return json(409, { error: 'Este e-mail já tem uma conta. Entre pela tela de login.' });
        const salt = randomBytes(24).toString('hex');
        const passwordHash = (await scrypt(password, salt, 64)).toString('hex');
        account = { name, email, salt, passwordHash, createdAt: new Date(now()).toISOString() };
        const result = await store.setJSON(accountKey, account, { onlyIfNew: true });
        if (!result.modified) return json(409, { error: 'Este e-mail já tem uma conta. Entre pela tela de login.' });
      } else {
        account = await store.get(accountKey);
        if (!account && legacy.email === email && /^[a-f0-9]{128}$/i.test(legacy.passwordHash || '') && legacy.salt) account = { name: 'Conta de teste', email, salt: legacy.salt, passwordHash: legacy.passwordHash };
        const computed = await scrypt(password, account?.salt || 'invalid-account', 64);
        const expected = account && /^[a-f0-9]{128}$/i.test(account.passwordHash) ? Buffer.from(account.passwordHash, 'hex') : Buffer.alloc(64);
        if (!timingSafeEqual(computed, expected) || !account) return json(401, { error: 'E-mail ou senha incorretos. Se você usava a conta local, crie uma conta neste site.' });
      }
      const previous = cookie(request);
      if (previous && /^[a-f0-9]{64}$/.test(previous)) await store.delete(sessionKey(previous));
      const token = randomBytes(32).toString('hex');
      await store.setJSON(sessionKey(token), { user: publicUser(account), expires: now() + lifetime });
      return json(action === 'register' ? 201 : 200, { user: publicUser(account) }, { 'Set-Cookie': sessionCookie(request, token, lifetime / 1000) });
    } catch (error) {
      console.error('auth-storage-failed', error?.name || 'Error');
      return json(503, { error: 'O serviço de contas está indisponível no momento. Tente novamente em instantes.', code: 'AUTH_STORAGE_UNAVAILABLE' });
    }
  };
}
