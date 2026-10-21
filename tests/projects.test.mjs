import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createAuthHandler } from '../lib/auth.mjs';
import { createProjectsHandler } from '../lib/projects.mjs';
import { createFileStore } from '../lib/file-store.mjs';
import { createNetlifyStore } from '../lib/netlify-store.mjs';
import { BlobsServer } from '@netlify/blobs/server';
import { randomBytes, createHash } from 'node:crypto';
import { validatePublicUrl, publicAddress, fetchPublic, sanitizeHtml, capturePublicPage } from '../lib/capture.mjs';
const origin = 'https://jutsoclone.example';
function req(route,method='GET',input,cookie,source=origin) { return new Request(origin+route,{method,headers:{Origin:source,...(input?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},...(input?{body:JSON.stringify(input)}:{})}); }
test('projetos reais persistem entre handlers e respeitam proprietário/origem',async()=>{
  await mkdir('.data/tests',{recursive:true}); const directory = await mkdtemp(path.resolve('.data/tests/projects-'));
  const store = () => createFileStore(directory), auth = createAuthHandler({store:store()});
  const signUp = async email => { const response=await auth(req('/api/auth/register','POST',{name:'Teste real',email,password:'PassTeste123!'})); assert.equal(response.status,201);return response.headers.get('set-cookie').split(';')[0]; };
  const first=await signUp('first@example.com'),second=await signUp('second@example.com');
  const handle = request => createProjectsHandler({store:store()})(request);
  assert.equal((await handle(req('/api/projects'))).status,401);
  const created=await handle(req('/api/projects','POST',{title:'Meu projeto',html:'<h1>Conteúdo real</h1><script>alert(1)</script>'},first)); assert.equal(created.status,201);
  const {project}=await created.json(); assert.match(project.id,/^[a-f0-9-]{36}$/);assert.doesNotMatch(project.html,/<script/i);
  const route='/api/projects/'+project.id;
  assert.equal((await handle(req(route,'GET',null,second))).status,404);
  assert.equal((await handle(req(route,'PUT',{html:'Roubo'},second))).status,404);
  assert.equal((await handle(req(route,'DELETE',null,second))).status,404);
  assert.deepEqual((await (await handle(req('/api/projects','GET',null,second))).json()).projects,[]);
  const list=(await (await handle(req('/api/projects','GET',null,first))).json()).projects; assert.equal(list.length,1);assert.equal(list[0].html,undefined);assert.equal(list[0].owner,undefined);
  assert.equal((await handle(req(route,'PUT',{html:'<h1>Não</h1>'},first,'https://attacker.example'))).status,403);
  assert.equal((await handle(req(route,'PUT',{title:'Editado',html:'<h1>Novo conteúdo</h1>'},first))).status,200);
  const saved=(await (await handle(req(route,'GET',null,first))).json()).project;assert.equal(saved.title,'Editado');assert.match(saved.html,/Novo conteúdo/);
  assert.equal((await handle(req(route,'DELETE',null,first))).status,200);assert.equal((await handle(req(route,'GET',null,first))).status,404);
});
test('validação pública recusa redes locais, formatos alternativos e credenciais',()=>{
  for(const url of ['file:///tmp/x','http://localhost','http://127.1','http://2130706433','http://0x7f000001','http://10.1.2.3','http://172.16.0.1','http://192.168.0.1','http://169.254.169.254','http://[::1]','http://[::ffff:127.0.0.1]','https://user:pass@example.com','https://example.com:8080','http://foo.internal'])assert.throws(()=>validatePublicUrl(url),url);
  assert.equal(publicAddress('8.8.8.8'),true);assert.equal(publicAddress('2606:4700:4700::1111'),true);assert.equal(publicAddress('fc00::1'),false);assert.equal(validatePublicUrl('https://example.com/path').hostname,'example.com');
});
test('DNS privado e redirecionamento interno são bloqueados antes da conexão',async()=>{
  await assert.rejects(fetchPublic('https://example.com',{resolver:async()=>[{address:'127.0.0.1',family:4}]}),/rede não permitida/);
  let calls=0;
  await assert.rejects(fetchPublic('https://example.com',{request:async()=>{calls++;return{status:302,headers:{location:'http://169.254.169.254/latest/meta-data'}};}}),/públicas/);assert.equal(calls,1);
});
test('sanitização usa parser, preserva layout e remove ações e conteúdo ativo',()=>{
  const html=sanitizeHtml('<h1 onclick="steal()">Minha página</h1><script src="evil"></script><iframe src="/login"></iframe><form action="/submit"><input type="password" value="secret"><button>Enviar</button></form><img src="/picture.png" onerror="evil()"><a href="jav&#x61;script:alert(1)">link</a><meta http-equiv="refresh" content="0;url=/logout">','https://example.com/path/');
  assert.doesNotMatch(html,/<(?:script|iframe|form|meta)\b|onclick|onerror|secret|javascript:/i);assert.match(html,/https:\/\/example.com\/picture.png/);assert.match(html,/disabled/);assert.match(html,/<h1>Minha página/);
});
test('captura incorpora CSS público e rejeita páginas vazias dependentes de JS',async()=>{
  const request=async url=>({status:200,headers:{'content-type':url.pathname.endsWith('.css')?'text/css':'text/html'},body:url.pathname.endsWith('.css')?'h1{color:green;background:url(./a.png)}':'<html><head><link rel="stylesheet" href="/main.css"></head><body><h1>Projeto próprio para importar e editar conteúdo estático.</h1><script>alert(1)</script></body></html>'});
  const captured=await capturePublicPage('https://example.com/',{request});assert.match(captured.html,/color:green/);assert.match(captured.html,/https:\/\/example.com\/a.png/);assert.doesNotMatch(captured.html,/<script/);assert.ok(captured.warnings.length);
  await assert.rejects(capturePublicPage('https://example.com/',{request:async()=>({status:200,headers:{'content-type':'text/html'},body:'<div id="root"></div><script src="app.js"></script>'})}),/depende de JavaScript/);
});
test('projetos e listagem funcionam pelo SDK Netlify com servidor Blobs oficial',async()=>{
  await mkdir('.data/tests',{recursive:true});const directory=await mkdtemp(path.resolve('.data/tests/project-blobs-'));
  const token=randomBytes(24).toString('hex'),server=new BlobsServer({directory,token}); const {port}=await server.start();
  // Use the edge protocol used by deployed Functions. The SDK's development
  // server API-URL parser mistakes a list query (?prefix=...) for the store name.
  const edgeURL=`http://127.0.0.1:${port}`;
  const store=()=>createNetlifyStore({edgeURL,uncachedEdgeURL:edgeURL,siteID:'projects-integration',token});
  try {
    const account=await createAuthHandler({store:store()})(req('/api/auth/register','POST',{name:'Netlify real',email:'netlify@example.com',password:'PassTeste123!'}));assert.equal(account.status,201);const cookie=account.headers.get('set-cookie').split(';')[0];
    const created=await createProjectsHandler({store:store()})(req('/api/projects','POST',{title:'Persistido',html:'<h1>Armazenamento real</h1>'},cookie));assert.equal(created.status,201);const {project}=await created.json();
    const list=await createProjectsHandler({store:store()})(req('/api/projects','GET',null,cookie));assert.equal(list.status,200);assert.equal((await list.json()).projects[0].id,project.id);
    const removed=await createProjectsHandler({store:store()})(req('/api/projects/'+project.id,'DELETE',null,cookie));assert.equal(removed.status,200);
    assert.deepEqual((await (await createProjectsHandler({store:store()})(req('/api/projects','GET',null,cookie))).json()).projects,[]);
  }finally{await server.stop();}
});

test('páginas múltiplas persistem, mantêm aliases e isolam proprietário',async()=>{
  await mkdir('.data/tests',{recursive:true});const directory=await mkdtemp(path.resolve('.data/tests/pages-'));
  const store=()=>createFileStore(directory),auth=createAuthHandler({store:store()});
  const signUp=async email=>(await auth(req('/api/auth/register','POST',{name:'Multipágina',email,password:'PassTeste123!'}))).headers.get('set-cookie').split(';')[0];
  const first=await signUp('pages@example.com'),second=await signUp('other-pages@example.com');
  const captured=[];
  const capture=async sourceUrl=>{captured.push(sourceUrl);return{html:'<h1>Página pública real</h1><script>evil()</script>',sourceUrl,warnings:['Captura estática de teste']};};
  const handle=request=>createProjectsHandler({store:store(),capture})(request);
  const created=await handle(req('/api/projects','POST',{title:'Site multipágina',sourceUrl:'https://example.com/inicio'},first));assert.equal(created.status,201);
  let project=(await created.json()).project;const route='/api/projects/'+project.id,entryId=project.pages[0].id;
  assert.equal(project.pages.length,1);assert.equal(project.html,project.pages[0].html);assert.equal(project.sourceUrl,project.pages[0].sourceUrl);assert.doesNotMatch(project.html,/<script/);
  const added=await handle(req(route+'/pages','POST',{title:'Sobre',html:'<h1>Sobre meu negócio</h1><iframe></iframe>'},first));assert.equal(added.status,201);
  const secondPage=(await added.json()).page;assert.equal(secondPage.title,'Sobre');assert.doesNotMatch(secondPage.html,/<iframe/);
  const imported=await handle(req(route+'/pages','POST',{title:'Contato',sourceUrl:'https://example.com/contato'},first));assert.equal(imported.status,201);assert.equal(captured.length,2);
  for(const [method,input] of [['GET',undefined],['PUT',{html:'Roubo'}],['DELETE',undefined]])assert.equal((await handle(req(route+'/pages/'+secondPage.id,method,input,second))).status,404);
  assert.equal((await handle(req(route+'/pages','POST',{html:'Outro'},second))).status,404);
  assert.equal((await handle(req(route+'/pages/'+secondPage.id,'PUT',{html:'Outro'},first,'https://attacker.example'))).status,403);
  assert.equal((await handle(req(route+'/pages','POST',{html:'<h1>Ambígua</h1>',sourceUrl:'https://example.com'},first))).status,400);
  assert.equal((await handle(req(route+'/pages/'+secondPage.id,'PUT',{html:null},first))).status,400);
  assert.equal((await handle(req(route+'/pages/'+secondPage.id,'PUT',{title:'Sobre atualizado',html:'<h1>Novo texto</h1>'},first))).status,200);
  project=(await (await handle(req(route,'GET',undefined,first))).json()).project;
  assert.equal(project.pages[1].title,'Sobre atualizado');assert.match(project.pages[1].html,/Novo texto/);assert.equal(project.html,project.pages[0].html);
  const list=(await (await handle(req('/api/projects','GET',undefined,first))).json()).projects;
  assert.equal(list[0].html,undefined);assert.equal(list[0].owner,undefined);assert.equal(list[0].pages.length,3);assert.ok(list[0].pages.every(page=>page.html===undefined));
  const saved=await handle(req(route,'PUT',{html:'<h1>Entrada pelo cliente antigo</h1>'},first));assert.equal(saved.status,200);
  project=(await saved.json()).project;assert.equal(project.html,project.pages[0].html);assert.match(project.html,/cliente antigo/);
  const removed=await handle(req(route+'/pages/'+entryId,'DELETE',undefined,first));assert.equal(removed.status,200);
  project=(await removed.json()).project;assert.equal(project.pages[0].id,secondPage.id);assert.equal(project.html,project.pages[0].html);assert.match(project.html,/Novo texto/);
  await handle(req(route+'/pages/'+project.pages[1].id,'DELETE',undefined,first));
  assert.equal((await handle(req(route+'/pages/'+secondPage.id,'DELETE',undefined,first))).status,409);
});

test('configurações de checkout e retorno validam URL, persistem e aceitam limpeza',async()=>{
  await mkdir('.data/tests',{recursive:true});const directory=await mkdtemp(path.resolve('.data/tests/settings-'));
  const store=()=>createFileStore(directory),auth=createAuthHandler({store:store()});
  const account=await auth(req('/api/auth/register','POST',{name:'Configurações',email:'settings@example.com',password:'PassTeste123!'}));const cookie=account.headers.get('set-cookie').split(';')[0];
  const handle=request=>createProjectsHandler({store:store()})(request);
  const created=await handle(req('/api/projects','POST',{title:'Meu checkout',html:'<h1>Oferta própria</h1>'},cookie));const {project}=await created.json(),route='/api/projects/'+project.id;
  const settings={checkoutUrl:'https://pagamento.example.com/oferta',backRedirectUrl:'https://example.com/voltar'};
  assert.equal((await handle(req(route,'PUT',{settings},cookie))).status,200);
  assert.deepEqual((await (await handle(req(route,'GET',undefined,cookie))).json()).project.settings,settings);
  for(const badUrl of ['javascript:alert(1)','http://127.0.0.1/','https://user:password@example.com','file:///tmp/test'])assert.equal((await handle(req(route,'PUT',{settings:{checkoutUrl:badUrl}},cookie))).status,400);
  assert.equal((await handle(req(route,'PUT',{settings:{checkoutUrl:null}},cookie))).status,400);
  assert.equal((await handle(req(route,'PUT',{settings:'invalid'},cookie))).status,400);
  const cleared=await handle(req(route,'PUT',{settings:{checkoutUrl:''}},cookie));assert.equal(cleared.status,200);assert.deepEqual((await cleared.json()).project.settings,{...settings,checkoutUrl:''});
});

test('projeto legado sem páginas é normalizado sem perder HTML ou proprietário',async()=>{
  await mkdir('.data/tests',{recursive:true});const directory=await mkdtemp(path.resolve('.data/tests/legacy-pages-'));
  const store=createFileStore(directory),auth=createAuthHandler({store});const email='legacy@example.com';
  const account=await auth(req('/api/auth/register','POST',{name:'Legado',email,password:'PassTeste123!'}));const cookie=account.headers.get('set-cookie').split(';')[0];
  const owner=createHash('sha256').update(email).digest('hex'),id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',timestamp=new Date().toISOString();
  await store.setJSON('projects/'+owner+'/'+id,{id,owner,title:'Antigo',html:'<h1>Texto antigo</h1>',sourceUrl:'https://example.com/',warnings:['Antigo'],createdAt:timestamp,updatedAt:timestamp});
  const handle=createProjectsHandler({store}),route='/api/projects/'+id;
  const read=await handle(req(route,'GET',undefined,cookie));assert.equal(read.status,200);let project=(await read.json()).project;assert.equal(project.pages[0].id,id);assert.equal(project.pages[0].html,project.html);
  const saved=await handle(req(route,'PUT',{settings:{backRedirectUrl:'https://example.com/voltar'}},cookie));assert.equal(saved.status,200);project=(await saved.json()).project;assert.equal(project.pages.length,1);assert.equal(project.html,'<h1>Texto antigo</h1>');
});
