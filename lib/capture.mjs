import http from 'node:http';
import https from 'node:https';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { parse, serialize } from 'parse5';

const MAX_HTML = 2_000_000;
export class CaptureError extends Error {}
export function publicAddress(address) {
  if (isIP(address) === 4) {
    const [a,b,c] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) || (a === 198 && (b === 18 || b === 19 || b === 51)) || (a === 203 && b === 0 && c === 113));
  }
  // Only globally routable unicast IPv6; rejects mapped IPv4 and local ranges.
  if (isIP(address) !== 6 || !/^[23][0-9a-f]{0,3}:/i.test(address)) return false;
  const groups = address.split(':').map(part => parseInt(part || '0',16));
  return !(groups[0] === 0x2002 || (groups[0] === 0x2001 && (groups[1] < 0x200 || groups[1] === 0xdb8)) || (groups[0] === 0x3fff && groups[1] < 0x1000));
}
export function validatePublicUrl(value) {
  let url; try { url = new URL(value); } catch { throw new CaptureError('Informe uma URL pública válida.'); }
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!['http:','https:'].includes(url.protocol) || url.username || url.password || !host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || (!isIP(host) && !host.includes('.')) || (isIP(host) && !publicAddress(host)) || (url.port && !['80','443'].includes(url.port))) throw new CaptureError('Somente páginas HTTP/HTTPS públicas nas portas padrão são permitidas.');
  return url;
}
async function fetchPinned(url, { resolver = lookup, timeoutMs = 8000, maxBytes = MAX_HTML } = {}) {
  const host = url.hostname.replace(/^\[|\]$/g, '');
  let dnsTimer;
  const addresses = await Promise.race([resolver(host, { all: true, verbatim: true }), new Promise((_, reject) => { dnsTimer = setTimeout(() => reject(new CaptureError('Não foi possível resolver o endereço no tempo permitido.')), timeoutMs); })]).finally(() => clearTimeout(dnsTimer));
  if (!addresses.length || addresses.some(item => !publicAddress(item.address))) throw new CaptureError('O endereço resolve para uma rede não permitida.');
  const pinned = addresses[0];
  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = error => { if (!settled) { settled = true; reject(error); } };
    const transport = url.protocol === 'https:' ? https : http;
    const request = transport.get(url, { headers: { 'User-Agent':'Jutsoclone-StaticPreview/1.0', Accept:'text/html,text/css;q=0.8' }, lookup: (_host, options, callback) => options?.all ? callback(null, [pinned]) : callback(null, pinned.address, pinned.family) }, response => {
      const chunks = []; let size = 0;
      response.on('data', chunk => { size += chunk.length; if (size > maxBytes) request.destroy(new CaptureError('A página excede o limite de tamanho.')); else chunks.push(chunk); });
      response.on('end', () => { if (!settled) { settled = true; resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks).toString('utf8') }); } });
      response.on('error', fail);
    });
    const timer = setTimeout(() => request.destroy(new CaptureError('O site demorou demais para responder.')), timeoutMs);
    request.on('close', () => clearTimeout(timer)); request.on('error', fail);
  });
}
export async function fetchPublic(value, { request = fetchPinned, ...options } = {}) {
  let url = validatePublicUrl(value);
  for (let hops = 0; hops <= 4; hops++) {
    if (options.deadline && Date.now() >= options.deadline) throw new CaptureError('A captura excedeu o tempo permitido.');
    if (options.deadline) options.timeoutMs = Math.max(1,Math.min(options.timeoutMs || 8000, (options.deadline - Date.now()) / 2));
    let response; try { response = await request(url, options); } catch (error) { if (error instanceof CaptureError) throw error; throw new CaptureError('Não foi possível acessar esta página pública.'); }
    if ([301,302,303,307,308].includes(response.status)) {
      if (!response.headers.location || hops === 4) throw new CaptureError('O site redirecionou muitas vezes.');
      url = validatePublicUrl(new URL(response.headers.location, url).href); continue;
    }
    if (response.status < 200 || response.status >= 300) throw new CaptureError('O site não disponibilizou esta página pública.');
    return { ...response, url: url.href };
  }
}
function assetUrl(value, base) {
  if (value.startsWith('#')) return value;
  try { return validatePublicUrl(new URL(value, base).href).href; } catch { return null; }
}
function cleanCss(css, base) {
  return css.replace(/<\/style/gi, '<\\/style').replace(/@import\s+(?:url\([^)]*\)|[^;]+);?/gi, '').replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi, (_match,_quote,url) => { const safe = assetUrl(url,base); return safe ? `url(${JSON.stringify(safe)})` : 'url("")'; });
}
export function sanitizeHtml(html, base = 'https://jutsoclone.example/') {
  const document = parse(html);
  const blocked = new Set(['script','iframe','frame','frameset','object','embed','applet','base','meta','svg','math','template','portal']);
  function walk(node) {
    if (node.attrs) {
      node.attrs = node.attrs.filter(attr => !attr.name.startsWith('on') && !['srcdoc','nonce','integrity','formaction','action','srcset','ping','download'].includes(attr.name));
      for (const attr of node.attrs) {
        if (['href','src','poster','background'].includes(attr.name)) attr.value = assetUrl(attr.value, base) || '';
        if (attr.name === 'style') attr.value = cleanCss(attr.value,base);
        if (['input','textarea'].includes(node.tagName) && ['value','placeholder'].includes(attr.name) && /password|hidden/i.test(node.attrs.find(a => a.name === 'type')?.value || '')) attr.value = '';
      }
      if (node.tagName === 'a') { node.attrs = node.attrs.filter(a => !['target','rel'].includes(a.name)); node.attrs.push({ name:'target', value:'_blank' },{ name:'rel',value:'noopener noreferrer' }); }
      if (['button','input','select','textarea'].includes(node.tagName)) node.attrs.push({ name:'disabled',value:'' });
      if (node.tagName === 'link' && node.attrs.find(a => a.name === 'rel')?.value !== 'stylesheet') return false;
    }
    if (node.tagName === 'style') for (const child of node.childNodes || []) if (child.value) child.value = cleanCss(child.value,base);
    if (node.childNodes) node.childNodes = node.childNodes.filter(child => !blocked.has(child.tagName) && walk(child) !== false).flatMap(child => child.tagName === 'form' ? child.childNodes || [] : [child]);
  }
  walk(document);
  return serialize(document);
}
export async function capturePublicPage(sourceUrl, options = {}) {
  options = { ...options, deadline: Date.now() + 18000 };
  const response = await fetchPublic(sourceUrl, options);
  if (!/^text\/html(?:;|$)/i.test(response.headers['content-type'] || '')) throw new CaptureError('A URL precisa retornar uma página HTML pública.');
  let html = sanitizeHtml(response.body, response.url);
  // Fetch a bounded set of public stylesheets and inline them for an editable static snapshot.
  const document = parse(html), links = [];
  let visibleText = '', visuals = 0;
  function visible(node) { if (['style','head'].includes(node.tagName)) return; if (node.nodeName === '#text') visibleText += node.value || ''; if (['img','video','canvas'].includes(node.tagName)) visuals++; for (const child of node.childNodes || []) visible(child); }
  visible(document);
  if (visibleText.trim().length < 40 && !visuals) throw new CaptureError('Esta página depende de JavaScript e não oferece conteúdo estático suficiente. A captura atual importa somente HTML/CSS público; use uma página estática ou importe seu próprio HTML.');
  function find(node) { if (node.tagName === 'link') links.push(node); for (const child of node.childNodes || []) find(child); }
  find(document);
  const warnings = ['Captura estática de HTML/CSS. JavaScript, login, formulários e serviços do site original não são executados. Imagens podem depender do site de origem.'];
  for (const link of links.slice(0,4)) {
    const href = link.attrs.find(a => a.name === 'href')?.value;
    if (!href) continue;
    try { const css = await fetchPublic(href, { ...options, maxBytes: 500_000, timeoutMs:4000 }); if (!/^text\/css(?:;|$)/i.test(css.headers['content-type'] || '')) continue; const node = parse(`<style></style>`).childNodes.find(n => n.tagName === 'html').childNodes.find(n => n.tagName === 'head').childNodes[0]; node.childNodes = [{ nodeName:'#text',value:cleanCss(css.body,css.url),parentNode:node }]; const siblings = link.parentNode.childNodes; siblings.splice(siblings.indexOf(link),1,node); node.parentNode = link.parentNode; } catch { warnings.push('Uma folha de estilos não pôde ser incorporada.'); }
  }
  html = serialize(document);
  return { html, sourceUrl: response.url, warnings };
}
