import { createHash, randomUUID } from 'node:crypto';
import { getAuthenticatedUser } from './auth.mjs';
import { capturePublicPage, sanitizeHtml, CaptureError } from './capture.mjs';
const json = (status, data) => Response.json(data, { status, headers: { 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' } });
const ownerId = email => createHash('sha256').update(email.toLowerCase()).digest('hex');
const summary = ({ html, owner, ...value }) => value;
async function inputJSON(request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new CaptureError('Envie os dados em JSON.');
  const reader = request.body?.getReader(); if (!reader) throw new CaptureError('Informe os dados do projeto.');
  const chunks = []; let size = 0;
  while (true) { const {done,value} = await reader.read(); if (done) break; size += value.byteLength; if (size > 2_100_000) { await reader.cancel(); throw new CaptureError('O projeto excede o limite de 2 MB.'); } chunks.push(value); }
  try { const input = JSON.parse(Buffer.concat(chunks).toString('utf8')); if (!input || Array.isArray(input) || typeof input !== 'object') throw Error(); return input; } catch { throw new CaptureError('JSON inválido.'); }
}
export function createProjectsHandler({ store, capture = capturePublicPage, now = Date.now }) {
  return async function handle(request) {
    try {
      const url = new URL(request.url);
      const match = /^\/api\/projects(?:\/([a-f0-9-]{36}))?\/?$/.exec(url.pathname);
      if (!match) return json(404,{error:'Projeto não encontrado.'});
      const user = await getAuthenticatedUser(request,store,now);
      if (!user) return json(401,{error:'Entre na sua conta para acessar os projetos.'});
      const id = match[1], owner = ownerId(user.email), prefix = `projects/${owner}/`;
      if (!['GET','POST','PUT','DELETE'].includes(request.method)) return json(405,{error:'Método não permitido.'});
      if (request.method !== 'GET' && request.headers.get('origin') !== url.origin) return json(403,{error:'Origem não autorizada.'});
      const key = id ? prefix + id : null;
      if (request.method === 'GET' && !id) {
        const keys = await store.listPrefix(prefix);
        const records = await Promise.all(keys.map(key => store.get(key)));
        return json(200,{projects:records.filter(p => p?.owner === owner).map(summary).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt))});
      }
      const existing = key ? await store.get(key) : null;
      if (id && (!existing || existing.owner !== owner)) return json(404,{error:'Projeto não encontrado.'});
      if (request.method === 'GET') return json(200,{project:existing});
      if (request.method === 'DELETE') { if (!key) return json(405,{error:'Selecione um projeto.'}); await store.delete(key); return json(200,{ok:true}); }
      if (request.method === 'POST' && id || request.method === 'PUT' && !id) return json(405,{error:'Método não permitido para este endereço.'});
      const input = await inputJSON(request);
      const title = typeof input.title === 'string' ? input.title.trim() : existing?.title || '';
      if (!title || title.length > 120) return json(400,{error:'Informe um título com 1 a 120 caracteres.'});
      let html, sourceUrl = existing?.sourceUrl || null, warnings = existing?.warnings || [];
      if (request.method === 'POST' && input.sourceUrl) {
        if (typeof input.sourceUrl !== 'string' || input.sourceUrl.length > 2048) return json(400,{error:'URL inválida.'});
        const captured = await capture(input.sourceUrl); html = captured.html; sourceUrl = captured.sourceUrl; warnings = captured.warnings;
      } else {
        if (input.html !== undefined && typeof input.html !== 'string') return json(400,{error:'O HTML precisa ser texto.'});
        html = sanitizeHtml(input.html ?? existing?.html ?? '<!doctype html><html lang="pt-BR"><head><title>Novo projeto</title></head><body><h1>Meu novo projeto</h1><p>Edite este conteúdo para começar.</p></body></html>',sourceUrl || undefined);
      }
      if (Buffer.byteLength(html) > 2_000_000) return json(400,{error:'O HTML excede o limite de 2 MB.'});
      // Apply the same security rules to custom capture adapters and edits.
      html = sanitizeHtml(html,sourceUrl || undefined);
      const timestamp = new Date(now()).toISOString();
      const project = { id:id || randomUUID(), owner, title, sourceUrl, html, warnings, createdAt:existing?.createdAt || timestamp, updatedAt:timestamp };
      await store.setJSON(prefix + project.id,project);
      return json(existing ? 200 : 201,{project});
    } catch (error) {
      if (error instanceof CaptureError) return json(400,{error:error.message});
      console.error('projects-failed',error?.name || 'Error');
      return json(503,{error:'Não foi possível acessar os projetos agora. Tente novamente em instantes.'});
    }
  };
}
