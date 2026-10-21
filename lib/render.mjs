import { existsSync } from 'node:fs';
import { fetchPublic, validatePublicUrl, sanitizeHtml, CaptureError } from './capture.mjs';
import { bundleAssets } from './assets.mjs';

const TYPES = new Set(['document', 'stylesheet', 'script', 'image', 'font', 'xhr', 'fetch']);
const MAX_REQUESTS = 100, MAX_BYTES = 15_000_000, MAX_ASSET = 2_000_000, MAX_CONCURRENT = 6;
const buffer = body => Buffer.isBuffer(body) ? body : Buffer.from(body || '');
const contentType = result => result.headers?.get?.('content-type') || result.headers?.['content-type'] || 'application/octet-stream';

// All browser networking is fulfilled through this Node transport, with no browser headers/cookies.
export function createRenderRequestPolicy({ fetch = fetchPublic, deadline = Date.now() + 35000, now = Date.now, warn = () => {}, onBlocked } = {}) {
  let requests = 0, bytes = 0, active = 0, exhausted = false;
  const queue = [];
  async function slot() { if (active < MAX_CONCURRENT) active++; else await new Promise(resolve => queue.push(resolve)); }
  function release() { const next = queue.shift(); if (next) next(); else active--; }
  async function load(value, type = 'document', method = 'GET') {
    if (method !== 'GET' || !TYPES.has(type)) throw new CaptureError('Método ou tipo de recurso bloqueado na captura.');
    const url = validatePublicUrl(value).href;
    if (requests >= MAX_REQUESTS || exhausted || now() >= deadline) throw new CaptureError('Limite de recursos ou tempo da renderização atingido.');
    requests++;
    await slot();
    try {
      if (exhausted || now() >= deadline) throw new CaptureError('Prazo de renderização esgotado.');
      const result = await fetch(url, { binary: true, maxBytes: Math.min(MAX_ASSET, MAX_BYTES - bytes), timeoutMs: Math.max(1, Math.min(5000, deadline - now())), deadline });
      const body = buffer(result.body);
      if (body.length > MAX_ASSET || bytes + body.length > MAX_BYTES) { exhausted = true; throw new CaptureError('Limite de tamanho da renderização atingido.'); }
      bytes += body.length;
      const finalUrl = validatePublicUrl(result.url || url).href;
      return { status: result.status || 200, contentType: contentType(result), body, url: finalUrl };
    } finally { release(); }
  }
  return {
    load,
    async route(route, preloaded) {
      const request = route.request();
      try {
        const result = preloaded || await load(request.url(), request.resourceType(), request.method());
        if (request.method() !== 'GET' || !TYPES.has(request.resourceType())) throw new CaptureError('Recurso bloqueado.');
        await route.fulfill({ status: result.status, contentType: result.contentType, body: result.body, headers: { 'Access-Control-Allow-Origin': '*' } });
      } catch {
        warn('Um pedido foi bloqueado ou não pôde ser carregado; a página pode ficar incompleta.');
        if (onBlocked) {
          // Never expose query parameters, credentials, cookies or response bodies in diagnostics.
          let safeUrl = '[invalid URL]';
          try { const url = new URL(request.url()); safeUrl = url.origin + url.pathname; } catch {}
          try { onBlocked({ url: safeUrl, resourceType: request.resourceType(), reason: 'blocked-or-unavailable' }); } catch {}
        }
        try { await route.abort('blockedbyclient'); } catch {}
      }
    },
    stats: () => ({ requests, bytes, active })
  };
}

async function launchBrowser(timeout) {
  const { chromium } = await import('playwright-core');
  const networkArgs = ['--disable-background-networking', '--disable-quic', '--dns-prefetch-disable', '--host-resolver-rules=MAP * ~NOTFOUND', '--force-webrtc-ip-handling-policy=disable_non_proxied_udp'];
  if (process.platform === 'linux') {
    const { default: runtime } = await import('@sparticuz/chromium');
    return chromium.launch({ args: [...runtime.args, ...networkArgs], executablePath: await runtime.executablePath(), headless: true, timeout });
  }
  if (process.platform === 'win32') {
    const executablePath = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'].find(existsSync);
    if (!executablePath) throw new CaptureError('Google Chrome não encontrado. Instale o Chrome oficial para renderizar páginas neste Windows.');
    return chromium.launch({ executablePath, headless: true, args: networkArgs, timeout });
  }
  throw new CaptureError('A renderização está preparada para Linux e Windows com Chrome oficial.');
}

async function within(promise, milliseconds) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new CaptureError('A renderização excedeu o prazo. Tente uma página mais leve.')), milliseconds); })]); }
  finally { clearTimeout(timer); }
}

export async function captureRenderedPage(sourceUrl, { bundle = true, thumbnail = false, fetch = fetchPublic, launch = launchBrowser, now = Date.now, onBlocked } = {}) {
  const warnings = new Set(['Captura de uma página renderizada. Contas, pagamentos e serviços privados da origem não são transferidos.']);
  const deadline = now() + 35000;
  const remaining = () => Math.max(1, deadline - now());
  const policy = createRenderRequestPolicy({ fetch, deadline, now, warn: message => warnings.add(message), onBlocked });
  let browser;
  try {
    // Resolve redirects safely before navigating, so relative assets use the final document URL.
    const initial = await policy.load(sourceUrl);
    if (!/^text\/html(?:;|$)/i.test(initial.contentType)) throw new CaptureError('A URL precisa retornar uma página HTML pública.');
    browser = await launch(remaining());
    const context = await browser.newContext({ viewport: { width: 1365, height: 900 }, locale: 'pt-BR', serviceWorkers: 'block', acceptDownloads: false, javaScriptEnabled: true });
    context.setDefaultTimeout(Math.min(8000, remaining()));
    if (typeof context.routeWebSocket !== 'function') throw new CaptureError('Atualize playwright-core para bloquear WebSockets antes de renderizar.');
    await context.routeWebSocket('**/*', socket => { socket.close(); warnings.add('Conexões WebSocket foram bloqueadas.'); });
    let mainDocument = true;
    await context.route('**/*', route => {
      const request = route.request();
      const cached = mainDocument && request.isNavigationRequest() && request.url() === initial.url && request.method() === 'GET';
      if (cached) mainDocument = false;
      return policy.route(route, cached ? initial : undefined);
    });
    const page = await context.newPage();
    context.on('page', popup => { if (popup !== page) { popup.close().catch(() => {}); warnings.add('Uma janela adicional foi bloqueada.'); } });
    await page.addInitScript(() => {
      // Defense in depth: route interception remains the network authority.
      window.open = () => null;
      for (const key of ['WebSocket', 'EventSource', 'RTCPeerConnection', 'webkitRTCPeerConnection']) {
        try { Object.defineProperty(window, key, { value: class { constructor() { throw Error('Not available in capture'); } }, configurable: false }); } catch {}
      }
    });
    await page.goto(initial.url, { waitUntil: 'domcontentloaded', timeout: remaining() });
    // SPA shells can redirect after hydration; DOMContentLoaded alone is not content readiness.
    try { await page.waitForLoadState('networkidle', { timeout: Math.min(8000, remaining()) }); }
    catch { warnings.add('A página manteve pedidos em andamento durante a espera de renderização.'); }
    try {
      await page.waitForFunction(() => {
        if (!document.body) return false;
        let text = document.body.innerText || '';
        for (const badge of document.querySelectorAll('[id*="lovable" i],[class*="lovable" i],[id*="badge" i],[class*="badge" i]')) {
          const badgeText = badge.innerText;
          if (badgeText) text = text.replace(badgeText, '');
        }
        return text.replace(/\s+/g, ' ').trim().length >= 120;
      }, null, { timeout: Math.min(15000, remaining()), polling: 250 });
    } catch { throw new CaptureError('A página não apresentou conteúdo visível suficiente após aguardar JavaScript e redirecionamentos. A captura foi interrompida para não salvar uma tela de carregamento.'); }
    const snapshot = await within(page.evaluate(async () => {
      await Promise.race([document.fonts?.ready || Promise.resolve(), new Promise(resolve => setTimeout(resolve, 2500))]);
      for (let index = 0; index < 8; index++) {
        window.scrollTo(0, index * window.innerHeight);
        await new Promise(resolve => setTimeout(resolve, 300));
        if ((index + 1) * window.innerHeight >= document.documentElement.scrollHeight) break;
      }
      window.scrollTo(0, 0);
      await new Promise(resolve => setTimeout(resolve, 600));
      const clone = document.documentElement.cloneNode(true);
      // CSS-in-JS can use insertRule without changing a style element's textContent.
      const sourceStyles = [...document.querySelectorAll('style')], copyStyles = [...clone.querySelectorAll('style')];
      sourceStyles.forEach((style, index) => { try { if (style.sheet && copyStyles[index]) copyStyles[index].textContent = [...style.sheet.cssRules].map(rule => rule.cssText).join('\n'); } catch {} });
      for (const sheet of document.adoptedStyleSheets || []) {
        try { const style = document.createElement('style'); style.textContent = [...sheet.cssRules].map(rule => rule.cssText).join('\n'); clone.querySelector('head')?.appendChild(style); } catch {}
      }
      const sourceImages = [...document.querySelectorAll('img')], copyImages = [...clone.querySelectorAll('img')];
      sourceImages.forEach((image, index) => { if (copyImages[index] && image.currentSrc) copyImages[index].setAttribute('src', image.currentSrc); });
      const originals = [...document.querySelectorAll('canvas')], copies = [...clone.querySelectorAll('canvas')];
      let canvasFailures = 0;
      originals.forEach((canvas, index) => { try { const image = document.createElement('img'); image.src = canvas.toDataURL('image/png'); image.width = canvas.width; image.height = canvas.height; image.style.cssText = canvas.style.cssText; copies[index].replaceWith(image); } catch { canvasFailures++; } });
      return { html: '<!doctype html>' + clone.outerHTML, title: document.title, url: location.href, links: [...document.querySelectorAll('a[href]')].map(anchor => anchor.href), canvasFailures };
    }), remaining());
    const finalUrl = validatePublicUrl(snapshot.url).href;
    const discoveredLinks = [...new Set(snapshot.links.flatMap(value => {
      try { const url = validatePublicUrl(value); url.hash = ''; return url.origin === new URL(finalUrl).origin && url.href !== finalUrl ? [url.href] : []; } catch { return []; }
    }))].slice(0, 10);
    if (snapshot.canvasFailures) warnings.add('Alguns elementos canvas não puderam ser convertidos em imagem.');
    let preview;
    if (thumbnail && now() < deadline) {
      try { preview = await page.screenshot({ type: 'jpeg', quality: 55, fullPage: false, timeout: Math.min(3000, remaining()) }); }
      catch { warnings.add('A miniatura não pôde ser gerada.'); }
    }
    let html = sanitizeHtml(snapshot.html, finalUrl), assetCount = 0;
    // Close the untrusted runtime before the separate bounded asset-packaging stage.
    await browser.close(); browser = undefined;
    if (bundle) { const packaged = await bundleAssets(html, finalUrl, { fetch, now }); html = packaged.html; assetCount = packaged.assetCount; packaged.warnings.forEach(message => warnings.add(message)); }
    return { html, title: String(snapshot.title || '').slice(0, 300), sourceUrl: finalUrl, discoveredLinks, warnings: [...warnings], assetCount, ...(preview ? { thumbnail: preview } : {}) };
  } catch (error) {
    if (error instanceof CaptureError) throw error;
    throw new CaptureError('Não foi possível renderizar esta página. Verifique o Chrome e as dependências de renderização; nenhum fallback estático foi aplicado.');
  } finally { if (browser) await browser.close().catch(() => {}); }
}
