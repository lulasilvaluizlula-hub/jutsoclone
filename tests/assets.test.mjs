import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bundleAssets } from '../lib/assets.mjs';

const base = 'https://public.example/page/';
const response = (url, type, body) => ({ url, headers: { 'content-type': type }, body: Buffer.from(body) });

test('incorpora CSS, fontes e imagens binárias, resolve URLs e evita downloads duplicados', async () => {
  const calls = [];
  const result = await bundleAssets('<link rel="stylesheet" href="/main.css"><img src="/pic.png"><img src="/pic.png"><div style="background:url(/pic.png)"></div>', base, { fetch: async (url, options) => {
    calls.push(url); assert.equal(options.binary, true); assert.ok(options.maxBytes <= 2_000_000);
    if (url.endsWith('main.css')) return response('https://public.example/css/main.css', 'text/css; charset=utf-8', '@font-face{src:url(../font.woff2)} body{background:url(../pic.png)}');
    if (url.endsWith('font.woff2')) return response(url, 'font/woff2', Buffer.from([0, 255, 42]));
    return response(url, 'image/png', Buffer.from([137, 80, 0, 255]));
  }});
  assert.equal(calls.length, 3); assert.equal(result.assetCount, 3); assert.deepEqual(result.warnings, []);
  assert.match(result.html, /data:image\/png;base64,iVAA\/w==/);
  assert.match(result.html, /data:font\/woff2;base64,AP8q/);
  assert.doesNotMatch(result.html, /<link/);
});

test('não baixa vídeos ou endereços privados e avisa sobre SVG e falhas', async () => {
  const calls = [];
  const result = await bundleAssets('<img src="http://127.0.0.1/private"><img src="/icon.svg"><img src="/bad.png"><video src="/video.mp4" poster="/poster.png"></video>', base, { fetch: async url => {
    calls.push(url); if (url.endsWith('bad.png')) throw Error('unavailable');
    return response(url, url.endsWith('.svg') ? 'image/svg+xml' : 'image/png', 'test');
  }});
  assert.equal(calls.length, 3); assert.equal(result.assetCount, 1);
  assert.ok(calls.every(url => !url.includes('127.0.0.1') && !url.endsWith('.mp4')));
  assert.match(result.html, /src="https:\/\/public.example\/icon.svg"/);
  assert.match(result.html, /poster="data:image\/png/);
  assert.ok(result.warnings.some(w => w.includes('Vídeos')));
  assert.ok(result.warnings.some(w => w.includes('SVG')));
  assert.ok(result.warnings.some(w => w.includes('não permitido')));
});

test('limita a 30 solicitações e preserva referências externas excedentes', async () => {
  let requests = 0;
  const input = Array.from({ length: 35 }, (_, i) => `<img src="/${i}.png">`).join('');
  const result = await bundleAssets(input, base, { fetch: async url => { requests++; return response(url, 'image/png', 'x'); } });
  assert.equal(requests, 30); assert.equal(result.assetCount, 30);
  assert.match(result.html, /https:\/\/public.example\/34.png/);
  assert.ok(result.warnings.some(w => w.includes('Limite')));
});

test('aplica limites de bytes e orçamento global de tempo sem ampliar os limites do fetch', async () => {
  let time = 1000, calls = 0;
  const result = await bundleAssets('<img src="/huge.png"><img src="/late.png"><img src="/never.png">', base, { now: () => time, fetch: async (url, options) => {
    calls++; assert.equal(options.deadline, 21000);
    if (url.endsWith('huge.png')) return response(url, 'image/png', Buffer.alloc(2_000_001));
    time = 21001; return response(url, 'image/png', 'x');
  }});
  assert.equal(calls, 2); assert.equal(result.assetCount, 0);
  assert.ok(result.warnings.some(w => w.includes('limites')));
});

test('limite total de 8 MB e remoção de import CSS não iniciam solicitações adicionais', async () => {
  let calls = 0;
  const result = await bundleAssets('<style>@import url(/extra.css);p{background:url(/0.png)}</style>' + Array.from({length: 5}, (_, i) => `<img src="/${i}.png">`).join(''), base, { fetch: async (url, options) => {
    calls++; assert.ok(options.maxBytes <= 2_000_000); assert.ok(!url.endsWith('.css'));
    return response(url, 'image/png', Buffer.alloc(2_000_000));
  }});
  assert.equal(calls, 4); assert.equal(result.assetCount, 4);
  assert.doesNotMatch(result.html, /@import/);
  assert.ok(result.warnings.some(w => w.includes('@import')));
  assert.match(result.html, /https:\/\/public.example\/4.png/);
});

test('preserva recursos incorporados permitidos sem baixar e remove data HTML/SVG', async () => {
  const result = await bundleAssets('<img src="data:image/png;base64,eA=="><img src="data:image/svg+xml;base64,eA=="><img src="data:text/html;base64,eA==">', base, { fetch: async () => { throw Error('must not fetch'); } });
  assert.match(result.html, /data:image\/png;base64,eA==/);
  assert.doesNotMatch(result.html, /data:(?:image\/svg|text\/html)/);
  assert.equal(result.assetCount, 0);
  assert.ok(result.warnings.length);
});
