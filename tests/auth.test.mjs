import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { BlobsServer } from '@netlify/blobs/server';
import { createAuthHandler, getAuthenticatedUser } from '../lib/auth.mjs';
import { createFileStore } from '../lib/file-store.mjs';
import { createNetlifyStore } from '../lib/netlify-store.mjs';

const origin = 'https://jutsoclone.example';
function request(action, data, cookie, source = origin) {
  return new Request(origin + '/api/auth/' + action, { method: data ? 'POST' : 'GET', headers: { Origin: source, ...(data ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) }, ...(data ? { body: JSON.stringify(data) } : {}) });
}

test('leitor compartilhado ignora tokens inválidos e remove sessão na expiração exata', async () => {
  const token = randomBytes(32).toString('hex');
  const user = { name: 'Pessoa de teste', email: 'session@example.com' };
  let session = { user, expires: 2000 };
  let reads = 0;
  const deleted = [];
  const store = { get: async () => { reads++; return session; }, delete: async key => { deleted.push(key); session = null; } };
  assert.equal(await getAuthenticatedUser(request('session'), store, () => 1000), null);
  assert.equal(await getAuthenticatedUser(request('session', null, 'jutsoclone_session=invalid'), store, () => 1000), null);
  assert.equal(reads, 0);
  const authenticated = request('session', null, 'jutsoclone_session=' + token);
  assert.deepEqual(await getAuthenticatedUser(authenticated, store, () => 1999), user);
  assert.equal(deleted.length, 0);
  assert.equal(await getAuthenticatedUser(authenticated, store, () => 2000), null);
  assert.equal(deleted.length, 1);
  assert.match(deleted[0], /^sessions\/[a-f0-9]{64}$/);
  assert.equal(await getAuthenticatedUser(authenticated, store, () => 2001), null);
  assert.equal(deleted.length, 1);
});
async function verifyAccounts(makeStore) {
  let time = Date.now();
  let storeError;
  const newHandler = () => { const real = makeStore(); const store = {}; for (const method of ['get','setJSON','delete']) store[method] = async (...args) => { try { return await real[method](...args); } catch(error) { storeError = { method, code: error.code, message: error.message }; throw error; } }; return createAuthHandler({ store, now: () => time }); };
  const initial = newHandler();
  const input = { name: 'Conta de integração', email: randomBytes(8).toString('hex') + '@example.com', password: randomBytes(16).toString('hex') };
  assert.equal((await initial(request('register', input, null, 'https://foreign.example'))).status, 403);
  assert.equal((await initial(request('register', { ...input, password: 'short' }))).status, 400);
  const created = await initial(request('register', input));
  assert.equal(created.status, 201, JSON.stringify({ response: await created.clone().json(), storeError }));
  assert.equal((await created.json()).user.email, input.email);
  const header = created.headers.get('set-cookie');
  assert.match(header, /HttpOnly/); assert.match(header, /Secure/); assert.match(header, /SameSite=Strict/);
  const cookie = header.split(';')[0];
  // New instances share storage, like separate warm/cold serverless runtimes.
  assert.equal((await (await newHandler()(request('session', null, cookie))).json()).user.email, input.email);
  assert.equal((await newHandler()(request('register', input))).status, 409);
  assert.equal((await newHandler()(request('login', { ...input, password: randomBytes(16).toString('hex') }))).status, 401);
  assert.equal((await (await newHandler()(request('session', null, 'jutsoclone_session=' + 'a'.repeat(64)))).json()).user, null);
  const login = await newHandler()(request('login', input)); assert.equal(login.status, 200);
  const loginCookie = login.headers.get('set-cookie').split(';')[0];
  assert.equal((await newHandler()(request('logout', {}, loginCookie))).status, 200);
  assert.equal((await (await newHandler()(request('session', null, loginCookie))).json()).user, null);
  time += 9 * 60 * 60 * 1000;
  assert.equal((await (await newHandler()(request('session', null, cookie))).json()).user, null);
  assert.equal((await newHandler()(new Request(origin + '/api/auth/login', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: '{' }))).status, 400);
}

test('contas persistem no armazenamento de arquivos entre instâncias e sessões são revogadas', async () => {
  await mkdir('.data/tests', { recursive:true });
  const directory = await mkdtemp(path.resolve('.data/tests/auth-'));
  await verifyAccounts(() => createFileStore(directory));
  for (const name of await readdir(directory)) {
    const record = JSON.parse(await readFile(path.join(directory, name), 'utf8'));
    assert.equal(record.password, undefined);
  }
});

test('SDK Netlify Blobs real com servidor oficial: cadastro, login, sessão entre instâncias, logout e expiração', async () => {
  await mkdir('.data/tests', { recursive:true });
  const directory = await mkdtemp(path.resolve('.data/tests/blobs-'));
  const token = randomBytes(24).toString('hex');
  const server = new BlobsServer({ directory, token });
  const { port } = await server.start();
  try { await verifyAccounts(() => createNetlifyStore({ apiURL: `http://127.0.0.1:${port}`, siteID: 'local-integration-test', token })); }
  finally { await server.stop(); }
});

test('build contém rotas diretas e nenhum arquivo de backend, configuração privada ou documentação', async () => {
  const root = new URL('../dist/', import.meta.url);
  for (const route of ['', 'login/', 'register/', 'app/']) assert.match(await readFile(new URL(route + 'index.html', root), 'utf8'), /app.js/);
  const entries = await readdir(root);
  for (const prohibited of ['.env.local', '.data', 'server.mjs', 'lib', 'netlify', 'README.md', 'node_modules']) assert.equal(entries.includes(prohibited), false);
  const redirects = await readFile(new URL('_redirects', root), 'utf8');
  for (const route of ['login', 'register', 'app']) assert.match(redirects, new RegExp('/' + route + ' /index.html 200'));
});
