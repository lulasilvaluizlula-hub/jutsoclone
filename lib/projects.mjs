import { createHash, randomUUID } from 'node:crypto';
import { getAuthenticatedUser } from './auth.mjs';
import { capturePublicPage, sanitizeHtml, validatePublicUrl, CaptureError } from './capture.mjs';
const json = (status, data) => Response.json(data, { status, headers: { 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' } });
const ownerId = email => createHash('sha256').update(email.toLowerCase()).digest('hex');
const summary = ({ html, owner, pages = [], ...value }) => ({ ...value, pages:pages.map(({html,...page}) => page) });
const defaults = '<!doctype html><html lang="pt-BR"><head><title>Novo projeto</title></head><body><h1>Meu novo projeto</h1><p>Edite este conteúdo para começar.</p></body></html>';
function normalize(project) {
  if (!project) return project;
  return { ...project, settings:{checkoutUrl:'',backRedirectUrl:'',...project.settings}, pages:project.pages?.length ? project.pages : [{id:project.id,title:project.title,html:project.html,sourceUrl:project.sourceUrl || null,warnings:project.warnings || []}] };
}
function validTitle(value,fallback='') {
  const title = value === undefined ? fallback : typeof value === 'string' ? value.trim() : '';
  if (!title || title.length > 120) throw new CaptureError('Informe um título com 1 a 120 caracteres.');
  return title;
}
function settingsFrom(input,existing={}) {
  if (input.settings !== undefined && (!input.settings || typeof input.settings !== 'object' || Array.isArray(input.settings))) throw new CaptureError('As configurações precisam ser um objeto.');
  const settings={checkoutUrl:'',backRedirectUrl:'',...existing};
  for (const field of ['checkoutUrl','backRedirectUrl']) {
    const value = input.settings && Object.hasOwn(input.settings,field) ? input.settings[field] : input[field];
    if (value === undefined) continue;
    if (typeof value !== 'string' || value.length > 2048) throw new CaptureError('Informe uma URL pública válida nas configurações.');
    settings[field]=value.trim() ? validatePublicUrl(value.trim()).href : '';
  }
  return settings;
}
function sync(project) {
  const first=project.pages[0];
  return {...project,html:first.html,sourceUrl:first.sourceUrl,warnings:first.warnings};
}
async function inputJSON(request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new CaptureError('Envie os dados em JSON.');
  const reader=request.body?.getReader();if (!reader) throw new CaptureError('Informe os dados do projeto.');
  const chunks=[];let size=0;
  while (true) {const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>5_500_000){await reader.cancel();throw new CaptureError('O projeto excede o limite de 4 MB.');}chunks.push(value);}
  try {const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!input || Array.isArray(input) || typeof input!=='object')throw Error();return input;}catch{throw new CaptureError('JSON inválido.');}
}
export function createProjectsHandler({store,capture=capturePublicPage,now=Date.now}) {
  async function makePage(input,existing,allowCapture=true) {
    const title=validTitle(input.title,existing?.title || 'Nova página');
    if(input.html!==undefined && typeof input.html!=='string')throw new CaptureError('O HTML precisa ser texto.');
    let html=input.html ?? existing?.html ?? defaults,sourceUrl=existing?.sourceUrl || null,warnings=existing?.warnings || [],discoveredLinks=existing?.discoveredLinks || [],assetCount=existing?.assetCount || 0;
    if (input.sourceUrl!==undefined && input.sourceUrl!=='') {
      if (!allowCapture) throw new CaptureError('Para importar outra URL, adicione uma nova página.');
      if (input.html!==undefined || typeof input.sourceUrl!=='string' || input.sourceUrl.length>2048) throw new CaptureError('Informe somente uma URL pública ou o HTML da página.');
      validatePublicUrl(input.sourceUrl);
      const captured=await capture(input.sourceUrl);html=captured.html;sourceUrl=captured.sourceUrl;warnings=captured.warnings || [];discoveredLinks=captured.discoveredLinks || [];assetCount=captured.assetCount || 0;
    }
    if(typeof html!=='string')throw new CaptureError('O HTML precisa ser texto.');
    if(Buffer.byteLength(html)>4_000_000)throw new CaptureError('O HTML excede o limite de 2 MB.');
    html=sanitizeHtml(html,sourceUrl || undefined);
    if(Buffer.byteLength(html)>4_000_000)throw new CaptureError('O HTML excede o limite de 4 MB após a preparação.');
    return {id:existing?.id || randomUUID(),title,sourceUrl,html,warnings,discoveredLinks,assetCount};
  }
  async function save(project,timestamp) {
    if(project.pages.reduce((bytes,page)=>bytes+Buffer.byteLength(page.html),0)>10_000_000)throw new CaptureError('O conjunto de páginas excede o limite de 10 MB.');
    project=sync({...project,updatedAt:timestamp});await store.setJSON(`projects/${project.owner}/${project.id}`,project);return project;
  }
  return async function handle(request) {
    const meta=new URL(request.url).searchParams.get("meta")==="1";
    const reply=(status,data)=>json(status,meta?{...data,...(data.project?{project:summary(data.project)}:{}),...(data.page?{page:(({html,...rest})=>rest)(data.page)}:{})}:data);
    try {
      const url=new URL(request.url),match=/^\/api\/projects(?:\/([a-f0-9-]{36})(?:\/(pages)(?:\/([a-f0-9-]{36}))?)?)?\/?$/.exec(url.pathname);
      if(!match)return reply(404,{error:'Projeto não encontrado.'});
      const user=await getAuthenticatedUser(request,store,now);
      if(!user)return reply(401,{error:'Entre na sua conta para acessar os projetos.'});
      const [,id,pagesRoute,pageId]=match,owner=ownerId(user.email),prefix=`projects/${owner}/`;
      if(!['GET','POST','PUT','DELETE'].includes(request.method))return reply(405,{error:'Método não permitido.'});
      if(request.method!=='GET' && request.headers.get('origin')!==url.origin)return reply(403,{error:'Origem não autorizada.'});
      const key=id ? prefix+id:null;
      if(request.method==='GET' && !id){
        const records=await Promise.all((await store.listPrefix(prefix)).map(key=>store.get(key)));
        return reply(200,{projects:records.filter(p=>p?.owner===owner).map(normalize).map(summary).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))});
      }
      const existing=normalize(key ? await store.get(key):null);
      if(id && (!existing || existing.owner!==owner))return reply(404,{error:'Projeto não encontrado.'});
      const timestamp=new Date(now()).toISOString();
      if(pagesRoute){
        const pageIndex=pageId ? existing.pages.findIndex(page=>page.id===pageId):-1;
        if(pageId && pageIndex<0)return reply(404,{error:'Página não encontrada.'});
        if(request.method==='GET')return reply(200,pageId ? {page:existing.pages[pageIndex]}:{pages:existing.pages});
        if(request.method==='DELETE' && pageId){
          if(existing.pages.length===1)return reply(409,{error:'O projeto precisa manter pelo menos uma página.'});
          existing.pages.splice(pageIndex,1);return reply(200,{ok:true,project:await save(existing,timestamp)});
        }
        if(!(request.method==='POST' && !pageId || request.method==='PUT' && pageId))return reply(405,{error:'Método não permitido para este endereço.'});
        if(request.method==='POST' && existing.pages.length>=20)return reply(400,{error:'O projeto atingiu o limite de 20 páginas.'});
        const input=await inputJSON(request);
        if(request.method==='POST' && !input.sourceUrl && typeof input.html!=='string')throw new CaptureError('Informe uma URL pública ou o HTML da página.');
        const page=await makePage(input,pageId ? existing.pages[pageIndex]:null,!pageId);
        if(pageId)existing.pages[pageIndex]=page;else existing.pages.push(page);
        return reply(pageId ? 200:201,{page,project:await save(existing,timestamp)});
      }
      if(request.method==='GET')return reply(200,{project:existing});
      if(request.method==='DELETE'){if(!key)return reply(405,{error:'Selecione um projeto.'});await store.delete(key);return reply(200,{ok:true});}
      if(request.method==='POST' && id || request.method==='PUT' && !id)return reply(405,{error:'Método não permitido para este endereço.'});
      const input=await inputJSON(request),title=validTitle(input.title,existing?.title || '');
      const settings=settingsFrom(input,existing?.settings);
      if(existing){
        // Older clients edit the entry page through top-level html/title fields.
        if(input.html!==undefined)existing.pages[0]=await makePage({html:input.html},existing.pages[0],false);
        return reply(200,{project:await save({...existing,title,settings},timestamp)});
      }
      const page=await makePage({...input,title});
      const project={id:randomUUID(),owner,title,settings,pages:[page],createdAt:timestamp,updatedAt:timestamp};
      return reply(201,{project:await save(project,timestamp)});
    }catch(error){
      if(error instanceof CaptureError)return reply(400,{error:error.message});
      console.error('projects-failed',error?.name || 'Error');
      return reply(503,{error:'Não foi possível acessar os projetos agora. Tente novamente em instantes.'});
    }
  };
}
