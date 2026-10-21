import { createHash, randomBytes } from 'node:crypto';
import { deflateRawSync } from 'node:zlib';
import { parse, parseFragment, serialize } from 'parse5';
import { getAuthenticatedUser } from './auth.mjs';
import { sanitizeHtml, validatePublicUrl } from './capture.mjs';
const json=(status,data)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const ownerId=email=>createHash('sha256').update(email.toLowerCase()).digest('hex');
const TOKEN=/^[a-f0-9]{48}$/;
const checkoutPattern=/(checkout|comprar|finalizar|buy|adquirir)/i;
export function migrationRuntime(settings={}) {
 const config=JSON.stringify({checkoutUrl:safeSetting(settings.checkoutUrl)}).replace(/</g,'\\u003c');
 return `(()=>{'use strict';const config=${config},slides=new WeakMap();let oldOverflow='';
 const move=(track,delta)=>{if(!track||!track.children.length)return;const index=Math.max(0,Math.min(track.children.length-1,(slides.get(track)||0)+delta));slides.set(track,index);const width=track.parentElement.clientWidth||track.children[0].getBoundingClientRect().width;track.style.transform='translateX(-'+(index*width)+'px)';};
 document.querySelectorAll('[data-jutso-carousel-track],#productCarouselTrack').forEach(track=>{slides.set(track,0);track.style.transform='translateX(0px)';let start=null;track.addEventListener('touchstart',event=>{start=event.changedTouches[0]?.clientX??null;},{passive:true});track.addEventListener('touchend',event=>{const end=event.changedTouches[0]?.clientX;if(start!==null&&end!==undefined&&Math.abs(start-end)>40)move(track,start>end?1:-1);start=null;},{passive:true});});
 const buy=open=>{const modal=document.getElementById('buyModalOverlay');if(!modal)return;modal.classList.toggle('active',open);modal.setAttribute('aria-hidden',String(!open));if(open){oldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';}else document.body.style.overflow=oldOverflow;};
 const gift=()=>document.querySelectorAll('[data-jutso-gift],#giftPopupOverlay,#giftPopup,.gift-popup-overlay').forEach(node=>{node.classList.remove('active');node.hidden=true;});
 const checkout=()=>{if(config.checkoutUrl)window.open(config.checkoutUrl,'_blank','noopener,noreferrer');else alert('Compra indisponível. O responsável ainda não configurou um checkout próprio.');};
 document.addEventListener('keydown',event=>{if(event.key==='Escape')buy(false);});
 document.addEventListener('click',event=>{const trigger=event.target.closest('a,button,[aria-expanded],[data-jutso-action],.product-carousel-slide img,#imageZoomOverlay');if(!trigger)return;const action=trigger.getAttribute('data-jutso-action');
 if(trigger.tagName==='IMG'&&trigger.closest('.product-carousel-slide')){const overlay=document.getElementById('imageZoomOverlay'),image=overlay?.querySelector('img');if(overlay&&image){image.src=trigger.currentSrc||trigger.src;overlay.classList.add('active');overlay.setAttribute('aria-hidden','false');}return;}
 if(action==='close-zoom'||trigger.id==='imageZoomOverlay'&&event.target===trigger){const overlay=document.getElementById('imageZoomOverlay');if(overlay){overlay.classList.remove('active');overlay.setAttribute('aria-hidden','true');}return;}
 if(trigger.matches?.('.kit-btn[data-qty][data-price]')){event.preventDefault();document.querySelectorAll('.kit-btn[data-qty][data-price]').forEach(button=>{button.classList.toggle('active',button===trigger);button.setAttribute('aria-pressed',String(button===trigger));});const price=Number(trigger.getAttribute('data-price'));if(Number.isFinite(price))document.querySelectorAll('[data-jutso-selected-price],#modalPrice,#buyModalPrice,.modal-price').forEach(node=>{node.textContent=price.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});});return;}
 if(trigger.hasAttribute('data-jutso-checkout-disabled')||action==='checkout'){event.preventDefault();checkout();return;}
 if(action==='open-buy'||action==='close-buy'){event.preventDefault();buy(action==='open-buy');return;}
 if(action==='close-gift'||action==='accept-gift'){event.preventDefault();gift();if(action==='accept-gift')buy(true);return;}
 if(action==='faq'){const item=trigger.closest('.faq-item')||trigger;event.preventDefault();const open=!item.classList.contains('active');item.classList.toggle('active',open);trigger.setAttribute('aria-expanded',String(open));const answer=item.querySelector('.faq-answer,[data-jutso-answer]');if(answer)answer.hidden=!open;return;}
 if(action==='favorite'||action==='toggle-favorite'){event.preventDefault();const active=trigger.getAttribute('aria-pressed')!=='true';trigger.setAttribute('aria-pressed',String(active));trigger.classList.toggle('active',active);return;}
 if(action==='prev-slide'||action==='next-slide'){event.preventDefault();move(document.querySelector('[data-jutso-carousel-track],#productCarouselTrack'),action==='next-slide'?1:-1);return;}
 if(/compartilhar/i.test(trigger.getAttribute('aria-label')||'')&&navigator.share){event.preventDefault();navigator.share({title:document.title,url:location.href}).catch(()=>{});return;}
 if(/favoritar/i.test(trigger.getAttribute('aria-label')||'')){event.preventDefault();const active=trigger.getAttribute('aria-pressed')!=='true';trigger.setAttribute('aria-pressed',String(active));trigger.classList.toggle('active',active);return;}
 const controls=trigger.getAttribute('aria-controls'),expanded=trigger.getAttribute('aria-expanded');if(controls&&expanded!==null){const panel=document.getElementById(controls);if(panel){event.preventDefault();const open=expanded!=='true';trigger.setAttribute('aria-expanded',String(open));panel.hidden=!open;return;}}
 const href=trigger.getAttribute('href');if(href&&href.startsWith('#')&&href.length>1){let target;try{target=document.getElementById(decodeURIComponent(href.slice(1)));}catch{}if(target){event.preventDefault();target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}}});
 document.querySelectorAll('video').forEach(video=>{video.controls=true;video.autoplay=false;});document.querySelectorAll('details').forEach(details=>{const summary=details.querySelector('summary');if(summary){const sync=()=>summary.setAttribute('aria-expanded',String(details.open));details.addEventListener('toggle',sync);sync();}});})();`;
}
function attr(node,name){return node.attrs?.find(item=>item.name===name)?.value;}
function set(node,name,value){node.attrs=(node.attrs||[]).filter(item=>item.name!==name);if(value!==null)node.attrs.push({name,value:String(value)});}
function text(node){return node.nodeName==='#text'?node.value:(node.childNodes||[]).map(text).join(' ');}
function walk(node,fn){fn(node);for(const child of [...(node.childNodes||[])])walk(child,fn);}
function normalized(project){return project.pages?.length?project.pages:[{id:project.id,title:project.title,html:project.html,sourceUrl:project.sourceUrl,warnings:project.warnings||[]}];}
function safeSetting(value){if(!value)return '';try{return validatePublicUrl(value).href;}catch{return '';}}
function canonical(value){try{const url=new URL(value);url.hash='';url.pathname=url.pathname.replace(/\/$/,'')||'/';return url.href;}catch{return null;}}
function append(parent,html){for(const node of parseFragment(html).childNodes){node.parentNode=parent;parent.childNodes.push(node);}}
function preparePages(project,{mode,token}={}){
 const pages=normalized(project),entry=pages[0];
 if(pages.length>20||pages.reduce((sum,page)=>sum+Buffer.byteLength(page.html||''),0)>10_000_000)throw Error('PROJECT_TOO_LARGE');
 const target=page=>mode==='public'?`/p/${token}/${page.id===entry.id?'':page.id}`:page.id===entry.id?'index.html':`page-${page.id}.html`;
 const internal=new Map(pages.filter(page=>page.sourceUrl).map(page=>[canonical(page.sourceUrl),page]));
 const checkout=safeSetting(project.settings?.checkoutUrl),back=safeSetting(project.settings?.backRedirectUrl);
 return pages.map(page=>{
  const document=parse(sanitizeHtml(page.html||'',page.sourceUrl||undefined));let body;
  walk(document,node=>{
   if(node.tagName==='body')body=node;
   if(node.tagName==='video'){set(node,'controls','');set(node,'autoplay',null);}
   if(!['a','button'].includes(node.tagName))return;
   const custom=safeSetting(attr(node,'data-jutso-href'));if(custom){if(node.tagName==='button'){node.tagName='a';node.nodeName='a';}set(node,'href',custom);set(node,'disabled',null);set(node,'target','_blank');set(node,'rel','noopener noreferrer');}
   const href=attr(node,'href')||'',action=attr(node,'data-jutso-action'),looksCheckout=action==='checkout'||action!=='open-buy'&&(checkoutPattern.test(href+' '+text(node))||attr(node,'data-jutso-checkout')!==undefined);
   if(looksCheckout){
    if(checkout){if(node.tagName==='button'){node.tagName='a';node.nodeName='a';}set(node,'href',checkout);set(node,'disabled',null);set(node,'aria-disabled',null);set(node,'data-jutso-checkout','');set(node,'target','_blank');set(node,'rel','noopener noreferrer');}
    else{set(node,'href','#');set(node,'target',null);set(node,'aria-disabled','true');set(node,'data-jutso-checkout-disabled','');set(node,'title','Checkout próprio ainda não configurado.');}
    return;
   }
   if(node.tagName==='button'&&(attr(node,'aria-expanded')!==undefined||action||attr(node,'data-qty')!==undefined))set(node,'disabled',null);
   if(node.tagName!=='a'||!href||href.startsWith('#'))return;
   const destination=internal.get(canonical(href));
   if(destination){let hash='';try{hash=new URL(href).hash;}catch{}set(node,'href',target(destination)+hash);set(node,'target',null);set(node,'rel',null);}
  });
  if(back&&body){const link=parseFragment('<a data-jutso-back style="display:inline-block;margin:24px;padding:10px 16px;border:1px solid currentColor;border-radius:8px">Voltar ao endereço configurado</a>').childNodes[0];set(link,'href',back);set(link,'target','_blank');set(link,'rel','noopener noreferrer');link.parentNode=body;body.childNodes.push(link);}
  return{id:page.id,title:page.title||project.title,filename:page.id===entry.id?'index.html':`page-${page.id}.html`,html:serialize(document)};
 });
}
function documentWithRuntime(html,nonce,settings){
 const document=parse(html);let body;walk(document,node=>{if(node.tagName==='body')body=node;if(node.tagName==='head')append(node,'<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">');});
 if(body)append(body,`<script${nonce?` nonce="${nonce}"`:''}>${migrationRuntime(settings)}</script>`);
 return serialize(document);
}
const crcTable=Array.from({length:256},(_,value)=>{for(let bit=0;bit<8;bit++)value=value&1?0xedb88320^(value>>>1):value>>>1;return value>>>0;});
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes)crc=crcTable[(crc^byte)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
export function createZip(files){
 const local=[],central=[];let offset=0;
 for(const [filename,contents] of Object.entries(files)){
  const name=Buffer.from(filename),raw=Buffer.from(contents),compressed=deflateRawSync(raw),crc=crc32(raw),header=Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50,0);header.writeUInt16LE(20,4);header.writeUInt16LE(0x0800,6);header.writeUInt16LE(8,8);header.writeUInt16LE(33,12);header.writeUInt32LE(crc,14);header.writeUInt32LE(compressed.length,18);header.writeUInt32LE(raw.length,22);header.writeUInt16LE(name.length,26);
  local.push(header,name,compressed);const record=Buffer.alloc(46);record.writeUInt32LE(0x02014b50,0);record.writeUInt16LE(20,4);record.writeUInt16LE(20,6);record.writeUInt16LE(0x0800,8);record.writeUInt16LE(8,10);record.writeUInt16LE(33,14);record.writeUInt32LE(crc,16);record.writeUInt32LE(compressed.length,20);record.writeUInt32LE(raw.length,24);record.writeUInt16LE(name.length,28);record.writeUInt32LE(offset,42);central.push(record,name);offset+=header.length+name.length+compressed.length;
 }
 const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(Object.keys(files).length,8);end.writeUInt16LE(Object.keys(files).length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...local,directory,end]);
}
export function createPublicationHandler({store}){
 return async function publication(request){
  try{
   const url=new URL(request.url),publicMatch=/^\/p\/([a-f0-9]{48})(?:\/([a-f0-9-]{36}|index\.html|page-[a-f0-9-]{36}\.html))?\/?$/.exec(url.pathname);
   if(publicMatch){
    if(!['GET','HEAD'].includes(request.method))return json(405,{error:'Método não permitido.'});
    const snapshot=await store.get('published/'+publicMatch[1]);
    const page=publicMatch[2]&&publicMatch[2]!=='index.html'?snapshot?.pages?.find(page=>page.id===publicMatch[2]||page.filename===publicMatch[2]):snapshot?.pages?.[0];
    if(!page)return new Response('Página publicada não encontrada.',{status:404,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
    const nonce=randomBytes(18).toString('base64'),html=documentWithRuntime(page.html,nonce,snapshot.settings);
    return new Response(request.method==='HEAD'?null:html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':`sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox; default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline' https: http:; img-src https: http: data: blob:; media-src https: http: data: blob:; font-src https: http: data:; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'`}});
   }
   const match=/^\/api\/projects\/([a-f0-9-]{36})\/(export|publish)\/?$/.exec(url.pathname);
   if(!match)return json(404,{error:'Recurso não encontrado.'});
   const user=await getAuthenticatedUser(request,store);if(!user)return json(401,{error:'Entre na sua conta para continuar.'});
   const owner=ownerId(user.email),id=match[1],action=match[2],pointerKey=`publication/${owner}/${id}`;
   if(action==='export'&&request.method!=='GET'||action==='publish'&&!['GET','POST','DELETE'].includes(request.method))return json(405,{error:'Método não permitido.'});
   if(['POST','DELETE'].includes(request.method)&&request.headers.get('origin')!==url.origin)return json(403,{error:'Origem não autorizada.'});
   if(action==='publish'&&request.method==='DELETE'){
    const pointer=await store.get(pointerKey),ownedProject=await store.get(`projects/${owner}/${id}`);if(!pointer&&(!ownedProject||ownedProject.owner!==owner))return json(404,{error:'Projeto não encontrado.'});if(pointer?.token&&TOKEN.test(pointer.token))await store.delete('published/'+pointer.token);await store.delete(pointerKey);return json(200,{ok:true});
   }
   const project=await store.get(`projects/${owner}/${id}`);if(!project||project.owner!==owner)return json(404,{error:'Projeto não encontrado.'});
   if(action==='export'){
    const files={};for(const page of preparePages(project,{mode:'export'}))files[page.filename]=documentWithRuntime(page.html,undefined,project.settings);
    files['LEIA-ME.txt']=`Projeto exportado pela Jutsoclone.\nAbra index.html no navegador ou publique os arquivos em uma hospedagem.\nHTML/CSS e recursos capturados; imagens, fontes e estilos não incorporados ainda podem depender dos endereços originais.\nScripts do site original, autenticação, servidor, pixels e pagamentos não foram recuperados.\nInterações genéricas (acordeões, âncoras e controles de vídeo) usam um runtime original da Jutsoclone.\nBotões identificados como compra só utilizam o checkout próprio configurado; sem ele permanecem desativados.\nRevise direitos, páginas, links e destinos antes de publicar.\n`;
    const archive=createZip(files);let offset=0;const stream=new ReadableStream({pull(controller){if(offset>=archive.length){controller.close();return;}controller.enqueue(archive.subarray(offset,offset+65536));offset+=65536;}});
    return new Response(stream,{headers:{'Content-Type':'application/zip','Content-Disposition':`attachment; filename="jutsoclone-${id.slice(0,8)}.zip"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
   }
   if(request.method==='GET'){const pointer=await store.get(pointerKey);return json(200,{url:pointer?.token?`/p/${pointer.token}/`:null});}
   const token=randomBytes(24).toString('hex'),pages=preparePages(project,{mode:'public',token});
   const snapshot={title:project.title,pages,settings:{checkoutUrl:safeSetting(project.settings?.checkoutUrl)},createdAt:new Date().toISOString()};if(Buffer.byteLength(JSON.stringify(snapshot))>10_000_000)return json(400,{error:'A publicação excede o limite de 10 MB.'});
   const created=await store.setJSON('published/'+token,snapshot,{onlyIfNew:true});if(created?.modified===false)throw Error('TOKEN_COLLISION');
   const previous=await store.get(pointerKey);await store.setJSON(pointerKey,{token});if(previous?.token&&TOKEN.test(previous.token))await store.delete('published/'+previous.token);
   return json(201,{url:`/p/${token}/`,token});
  }catch(error){console.error('publication-failed',error?.name||'Error');return json(503,{error:'Não foi possível exportar ou publicar o projeto agora.'});}
 };
}
