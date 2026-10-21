import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRenderRequestPolicy, captureRenderedPage } from '../lib/render.mjs';

const origin = 'https://public.example/';
const response = (url, body = '<html><body>Conteúdo público</body></html>') => ({ url, status: 200, headers: { 'content-type': 'text/html' }, body: Buffer.from(body) });

test('política bloqueia rede privada, POST e mídia antes de fazer pedidos', async () => {
  let calls = 0;
  const policy = createRenderRequestPolicy({ fetch: async url => { calls++; return response(url); } });
  for (const [url,type,method] of [['http://127.0.0.1/','document','GET'], [origin,'fetch','POST'], [origin,'media','GET']]) await assert.rejects(policy.load(url,type,method));
  assert.equal(calls, 0);
  await policy.load(origin, 'script'); assert.equal(calls, 1);
});

test('fulfill usa CORS público próprio, status, tipo e bytes, sem cookies nem headers da origem', async () => {
  let supplied, fulfilled, aborted;
  const policy = createRenderRequestPolicy({ fetch: async (url, options) => { supplied = options; return { ...response(url), headers: { 'content-type':'text/html', 'set-cookie':'not-forwarded' } }; } });
  await policy.route({ request: () => ({ url:()=>origin, resourceType:()=> 'document', method:()=> 'GET' }), fulfill: async options => { fulfilled = options; }, abort: async reason => { aborted = reason; } });
  assert.deepEqual(Object.keys(fulfilled).sort(), ['body','contentType','headers','status']); assert.ok(Buffer.isBuffer(fulfilled.body));
  assert.deepEqual(fulfilled.headers, { 'Access-Control-Allow-Origin': '*' });
  assert.equal(supplied.binary, true); assert.equal(supplied.maxBytes, 2_000_000); assert.equal(supplied.timeoutMs, 5000);
  assert.equal(supplied.headers, undefined); assert.equal(aborted, undefined);
});

test('concorrência máxima seis e limite de cem requisições', async () => {
  let current = 0, peak = 0;
  const policy = createRenderRequestPolicy({ fetch: async url => { current++; peak = Math.max(peak,current); await new Promise(resolve => setTimeout(resolve, 1)); current--; return response(url); } });
  await Promise.all(Array.from({length:100}, (_,index) => policy.load(origin+index, 'image')));
  assert.equal(peak, 6); assert.equal(policy.stats().active, 0);
  await assert.rejects(policy.load(origin+'overflow'));
});

test('limites de bytes por recurso, total e prazo são aplicados mesmo ao fetch injetado', async () => {
  const huge = createRenderRequestPolicy({ fetch: async url => response(url, Buffer.alloc(2_000_001)) });
  await assert.rejects(huge.load(origin));
  const total = createRenderRequestPolicy({ fetch: async url => response(url, Buffer.alloc(2_000_000)) });
  for (let index=0; index<7; index++) await total.load(origin+index);
  await assert.rejects(total.load(origin+'limit'));
  let calls = 0;
  const expired = createRenderRequestPolicy({ deadline:100, now:()=>100, fetch:async () => { calls++; } });
  await assert.rejects(expired.load(origin)); assert.equal(calls,0);
});

function mockBrowser({ fail = false, missingWebsocket = false, insufficient = false } = {}) {
  const state = { closed:0, init:false, sockets:false, routes:false };
  const page = { addInitScript:async () => {state.init=true;}, goto:async url => {state.url=url; if(fail) throw Error('navigation failed');}, waitForLoadState:async (name,options)=>{state.waitState=name;assert.ok(options.timeout<=8000);}, waitForFunction:async (_predicate,_argument,options)=>{state.readiness=true;assert.ok(options.timeout<=15000);if(insufficient)throw Error('timeout');}, evaluate:async () => ({html:'<!doctype html><html><body><h1>Renderizado</h1><script>private()</script></body></html>', title:'Página renderizada',url:origin,links:[origin+'a',origin+'a#x','https://foreign.example/a',origin+'b'],canvasFailures:0}), screenshot:async ()=>Buffer.from('thumbnail') };
  const context = {setDefaultTimeout:()=>{},routeWebSocket:missingWebsocket ? undefined : async()=>{state.sockets=true;},route:async()=>{state.routes=true;},newPage:async()=>page,on:()=>{}};
  return { state, browser:{newContext:async options=>{state.context=options;return context;},close:async()=>{state.closed++;}} };
}

test('captura mock renderizada retorna título/links limitados e fecha navegador, sem fallback estático', async () => {
  const {state,browser}=mockBrowser();
  const result=await captureRenderedPage(origin,{bundle:false,thumbnail:true,fetch:async url=>response(url),launch:async()=>browser});
  assert.equal(result.title,'Página renderizada'); assert.deepEqual(result.discoveredLinks,[origin+'a',origin+'b']);
  assert.doesNotMatch(result.html, /private\(\)/); assert.equal(state.closed,1);
  assert.equal(state.context.serviceWorkers,'block'); assert.equal(state.context.acceptDownloads,false);
  assert.deepEqual(state.context.viewport,{width:1365,height:900});
  assert.ok(state.init&&state.sockets&&state.routes); assert.ok(Buffer.isBuffer(result.thumbnail));
  assert.equal(state.waitState,'networkidle');assert.equal(state.readiness,true);
});

test('recusa explicitamente shell sem conteúdo em vez de salvar captura vazia', async () => {
  const {state,browser}=mockBrowser({insufficient:true});
  await assert.rejects(captureRenderedPage(origin,{bundle:false,fetch:async url=>response(url),launch:async()=>browser}), /conteúdo visível suficiente.*tela de carregamento/);
  assert.equal(state.closed,1);
});

test('diagnóstico de pedidos bloqueados omite query, credenciais e fragmentos', async () => {
  const diagnostics=[];
  const policy=createRenderRequestPolicy({onBlocked:value=>diagnostics.push(value)});
  await policy.route({request:()=>({url:()=> 'https://user:password@public.example/api?token=secret#private',resourceType:()=> 'fetch',method:()=> 'POST'}),abort:async()=>{},fulfill:async()=>assert.fail('must abort')});
  assert.deepEqual(diagnostics,[{url:'https://public.example/api',resourceType:'fetch',reason:'blocked-or-unavailable'}]);
});

test('erros de navegação e ausência de bloqueio WebSocket sempre fecham navegador e produzem erro claro', async () => {
  for (const settings of [{fail:true},{missingWebsocket:true}]) {
    const {state,browser}=mockBrowser(settings);
    await assert.rejects(captureRenderedPage(origin,{bundle:false,fetch:async url=>response(url),launch:async()=>browser}), /renderizar|WebSockets/);
    assert.equal(state.closed,1);
  }
});
