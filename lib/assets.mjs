import { parse, serialize } from 'parse5';
import { fetchPublic, validatePublicUrl } from './capture.mjs';

const allowed = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif', 'image/bmp', 'image/x-icon', 'font/woff', 'font/woff2', 'application/font-woff', 'application/x-font-woff']);
const MAX_ASSET = 2_000_000, MAX_TOTAL = 8_000_000, MAX_REQUESTS = 30, TIMEOUT = 20_000;

// Input must already be sanitized. No scripts, forms or credentials are requested here.
export async function bundleAssets(html, baseUrl, { fetch = fetchPublic, now = Date.now } = {}) {
  const document = parse(html), warnings = new Set(), cache = new Map();
  const deadline = now() + TIMEOUT;
  let requests = 0, total = 0, assetCount = 0;
  const warn = message => warnings.add(message);
  function resolve(value, base) {
    if (!value || value.startsWith('#')) return value;
    try { return validatePublicUrl(new URL(value, base).href).href; }
    catch { warn('Um endereço de recurso não permitido foi removido.'); return ''; }
  }
  async function resource(url, kind) {
    const key = kind + ':' + url;
    if (cache.has(key)) return cache.get(key);
    const promise = (async () => {
      if (requests >= MAX_REQUESTS || total >= MAX_TOTAL || now() >= deadline) {
        warn('Limite de recursos, tamanho ou tempo atingido; alguns arquivos continuam externos.'); return null;
      }
      requests++;
      try {
        const result = await fetch(url, { binary: true, maxBytes: Math.min(MAX_ASSET, MAX_TOTAL - total), deadline, timeoutMs: Math.max(1, Math.min(8000, deadline - now())) });
        const type = String(result.headers?.get?.('content-type') || result.headers?.['content-type'] || '').split(';')[0].trim().toLowerCase();
        const body = Buffer.isBuffer(result.body) ? result.body : result.body instanceof Uint8Array ? Buffer.from(result.body) : Buffer.from(result.body || '', 'utf8');
        if (body.length > MAX_ASSET || total + body.length > MAX_TOTAL || now() > deadline) {
          warn('Um recurso excedeu os limites de tamanho ou tempo e continua externo.'); return null;
        }
        total += body.length;
        if (kind === 'css' ? type !== 'text/css' : !allowed.has(type)) {
          warn('Um recurso com formato não incorporável continua externo; SVG e vídeos não são empacotados.'); return null;
        }
        assetCount++;
        return { body, type, url: resolve(result.url || url, url) || url };
      } catch {
        warn('Um recurso não pôde ser baixado e continua dependente do site de origem.'); return null;
      }
    })();
    cache.set(key, promise);
    return promise;
  }
  async function embed(value, base) {
    if (value.startsWith('data:')) {
      const match = /^data:([^;,]+);base64,([a-z0-9+/]*={0,2})$/i.exec(value);
      if (match && allowed.has(match[1].toLowerCase()) && match[2].length <= Math.ceil(MAX_ASSET / 3) * 4 && Buffer.from(match[2], 'base64').length <= MAX_ASSET) return value;
      warn('Um recurso incorporado com formato ou tamanho não permitido foi removido.');
      return '';
    }
    const url = resolve(value, base);
    if (!url || url.startsWith('#')) return url;
    const result = await resource(url, 'asset');
    return result ? `data:${result.type};base64,${result.body.toString('base64')}` : url;
  }
  async function css(text, base) {
    // Imports are deliberately not followed recursively; every fetch stays budgeted.
    text = text.replace(/@import\s+(?:url\([^)]*\)|[^;]+);?/gi, () => { warn('Uma regra CSS @import foi removida; estilos adicionais podem faltar.'); return ''; });
    const pattern = /url\(\s*(['"]?)(.*?)\1\s*\)/gi;
    let result = '', cursor = 0;
    for (const match of text.matchAll(pattern)) {
      result += text.slice(cursor, match.index) + `url(${JSON.stringify(await embed(match[2], base))})`;
      cursor = match.index + match[0].length;
    }
    return (result + text.slice(cursor)).replace(/<\/style/gi, '<\\/style');
  }
  async function walk(node) {
    const attr = name => node.attrs?.find(item => item.name === name);
    if (node.tagName === 'link' && attr('rel')?.value.toLowerCase() === 'stylesheet') {
      const href = attr('href'), url = resolve(href?.value || '', baseUrl);
      if (href) href.value = url;
      const sheet = url && await resource(url, 'css');
      if (sheet) {
        node.tagName = 'style'; node.nodeName = 'style'; node.attrs = [];
        node.childNodes = [{ nodeName: '#text', value: await css(sheet.body.toString('utf8'), sheet.url), parentNode: node }];
      }
      return;
    }
    for (const item of node.attrs || []) {
      if (item.name === 'style') item.value = await css(item.value, baseUrl);
      else if (item.name === 'poster' || item.name === 'background' || (item.name === 'src' && node.tagName === 'img')) item.value = await embed(item.value, baseUrl);
      else if (item.name === 'src' && ['video', 'audio', 'source'].includes(node.tagName)) {
        item.value = resolve(item.value, baseUrl);
        warn('Vídeos e áudios continuam externos e precisam de arquivos próprios para uso offline.');
      }
    }
    if (node.tagName === 'style') {
      for (const child of node.childNodes || []) if (child.nodeName === '#text') child.value = await css(child.value, baseUrl);
      return;
    }
    for (const child of node.childNodes || []) await walk(child);
  }
  await walk(document);
  return { html: serialize(document), warnings: [...warnings], assetCount };
}
