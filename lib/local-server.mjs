import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadEnvFile } from 'node:process';
import { createAuthHandler } from './auth.mjs';
import { createFileStore } from './file-store.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
try { loadEnvFile(path.join(root, '.env.local')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const auth = createAuthHandler({ store: createFileStore(path.join(root, '.data')), legacy: {
  email: process.env.JUTSO_DEMO_EMAIL, passwordHash: process.env.JUTSO_DEMO_PASSWORD_HASH, salt: process.env.JUTSO_DEMO_PASSWORD_SALT
} });
const assets = { '/app.js': 'text/javascript', '/brand.config.js': 'text/javascript', '/styles.css': 'text/css', '/favicon.svg': 'image/svg+xml' };
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith('/api/')) {
      const chunks = []; let length = 0;
      for await (const chunk of req) { length += chunk.length; if (length > 4096) { res.writeHead(413, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Dados muito extensos.' })); return; } chunks.push(chunk); }
      const request = new Request(url, { method: req.method, headers: req.headers, ...(!['GET', 'HEAD'].includes(req.method) ? { body: Buffer.concat(chunks) } : {}) });
      const response = await auth(request, { ip: req.socket.remoteAddress });
      res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer())); return;
    }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
    const route = url.pathname.replace(/\/$/, '') || '/';
    const isPage = ['/', '/login', '/register', '/app'].includes(route);
    if (!isPage && !assets[route]) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Página não encontrada'); return; }
    const data = await readFile(path.join(root, isPage ? 'index.html' : route.slice(1)));
    res.writeHead(200, { 'Content-Type': (isPage ? 'text/html' : assets[route]) + '; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch { res.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Não foi possível atender esta solicitação.' })); }
});
server.listen(4173, '127.0.0.1', () => console.log('Jutsoclone: http://127.0.0.1:4173'));
