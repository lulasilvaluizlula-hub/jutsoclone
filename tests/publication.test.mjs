import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir } from 'node:fs/promises';
import { inflateRawSync } from 'node:zlib';
import { runInNewContext } from 'node:vm';
import path from 'node:path';
import { createAuthHandler } from '../lib/auth.mjs';
import { createProjectsHandler } from '../lib/projects.mjs';
import { createPublicationHandler, migrationRuntime, createZip } from '../lib/publication.mjs';
import { createFileStore } from '../lib/file-store.mjs';
const origin='https://jutsoclone.example';
const request=(route,method='GET',input,cookie,source=origin)=>new Request(origin+route,{method,headers:{Origin:source,...(input?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},...(input?{body:JSON.stringify(input)}:{})});
function unzip(buffer){
 const files={};let offset=0;
 while(buffer.readUInt32LE(offset)===0x04034b50){const method=buffer.readUInt16LE(offset+8),size=buffer.readUInt32LE(offset+18),originalSize=buffer.readUInt32LE(offset+22),nameLength=buffer.readUInt16LE(offset+26),extraLength=buffer.readUInt16LE(offset+28);const name=buffer.subarray(offset+30,offset+30+nameLength).toString('utf8'),start=offset+30+nameLength+extraLength,bytes=buffer.subarray(start,start+size);const raw=method===8?inflateRawSync(bytes):bytes;assert.equal(raw.length,originalSize);files[name]=raw.toString('utf8');offset=start+size;}
 assert.equal(buffer.readUInt32LE(offset),0x02014b50);assert.equal(buffer.readUInt32LE(buffer.length-22),0x06054b50);assert.equal(buffer.readUInt16LE(buffer.length-12),Object.keys(files).length);return files;
}
async function fixture(settings={}){
 await mkdir('.data/tests',{recursive:true});const directory=await mkdtemp(path.resolve('.data/tests/publication-')),store=createFileStore(directory),auth=createAuthHandler({store});
 const signup=async email=>(await auth(request('/api/auth/register','POST',{name:'Publicação',email,password:'TesteSenha123!'}))).headers.get('set-cookie').split(';')[0];
 const first=await signup('publisher@example.com'),second=await signup('other@example.com'),projects=createProjectsHandler({store}),publication=createPublicationHandler({store});
 const captureHtml='<h1>Página inicial própria</h1><a href="https://example.com/sobre#contato">Sobre</a><a href="https://checkout.original.example/oferta">Comprar agora</a><script>ORIGINAL_TRACKER()</script><button data-jutso-action="open-buy">Abrir compra</button><button data-jutso-action="checkout">Finalizar compra</button><img src="https://example.com/image.png"><details><summary>Dúvida</summary>Resposta</details>';
 const created=await projects(request('/api/projects','POST',{title:'Projeto de publicação',html:captureHtml,settings},first));assert.equal(created.status,201);let {project}=await created.json();const route='/api/projects/'+project.id;
 const added=await projects(request(route+'/pages','POST',{title:'Sobre',html:'<h1 id="contato">Sobre a minha marca</h1><a href="https://example.com/">Início</a>'},first));assert.equal(added.status,201);project=(await added.json()).project;
 // Source URLs are fixture evidence for testing internal-link migration, without network requests.
 project.pages[0].sourceUrl='https://example.com/';project.pages[1].sourceUrl='https://example.com/sobre';await store.setJSON(`projects/${project.owner}/${project.id}`,project);
 return{store,first,second,project,route,projects,publication};
}
test('ZIP real contém todas as páginas, links migrados e só checkout próprio',async()=>{
 const f=await fixture({checkoutUrl:'https://checkout.meunegocio.example/oferta',backRedirectUrl:'https://meunegocio.example/voltar'});
 assert.equal((await f.publication(request(f.route+'/export'))).status,401);assert.equal((await f.publication(request(f.route+'/export','GET',undefined,f.second))).status,404);
 const response=await f.publication(request(f.route+'/export','GET',undefined,f.first));assert.equal(response.status,200);assert.equal(response.headers.get('Content-Type'),'application/zip');assert.match(response.headers.get('Content-Disposition'),/attachment/);
 const files=unzip(Buffer.from(await response.arrayBuffer())),secondName='page-'+f.project.pages[1].id+'.html';assert.ok(files['index.html']);assert.ok(files[secondName]);assert.ok(files['LEIA-ME.txt']);
 assert.match(files['index.html'],new RegExp(secondName+'#contato'));assert.match(files[secondName],/href="index.html"/);assert.match(files['index.html'],/https:\/\/checkout.meunegocio.example\/oferta/);assert.match(files['index.html'],/https:\/\/meunegocio.example\/voltar/);
 assert.doesNotMatch(files['index.html'],/ORIGINAL_TRACKER|checkout\.original\.example/);assert.match(files['index.html'],/data-jutso-action="open-buy"/);assert.match(files['LEIA-ME.txt'],/pixels/);
});
test('publicação é snapshot, usa CSP sem same-origin, recompila links e revoga tokens',async()=>{
 const f=await fixture();assert.equal((await f.publication(request(f.route+'/publish','POST',{},f.first,'https://attacker.example'))).status,403);assert.equal((await f.publication(request(f.route+'/publish','POST',{},f.second))).status,404);
 const published=await f.publication(request(f.route+'/publish','POST',{},f.first));assert.equal(published.status,201);const {url,token}=await published.json();assert.match(token,/^[a-f0-9]{48}$/);
 const publicPage=await f.publication(request(url));assert.equal(publicPage.status,200);const csp=publicPage.headers.get('Content-Security-Policy');assert.match(csp,/sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox/);assert.doesNotMatch(csp,/allow-same-origin/);assert.equal(publicPage.headers.get('Referrer-Policy'),'no-referrer');
 const html=await publicPage.text();assert.match(html,new RegExp('/p/'+token+'/'+f.project.pages[1].id+'#contato'));assert.match(html,/data-jutso-checkout-disabled/);assert.doesNotMatch(html,/checkout\.original\.example|publisher@example.com|ORIGINAL_TRACKER/);assert.doesNotMatch(html,new RegExp(f.project.owner));
 const nonce=/nonce="([^"]+)"/.exec(html)?.[1];assert.ok(nonce);assert.ok(csp.includes("'nonce-"+nonce+"'"));
 assert.equal((await f.publication(request(url+'index.html'))).status,200);const other=await f.publication(request(url+f.project.pages[1].id));assert.match(await other.text(),/Sobre a minha marca/);
 await f.projects(request(f.route,'PUT',{html:'<h1>Conteúdo editado depois</h1>'},f.first));assert.doesNotMatch(await (await f.publication(request(url))).text(),/Conteúdo editado depois/);
 assert.equal((await f.publication(request(f.route+'/publish','DELETE',undefined,f.second))).status,404);assert.equal((await f.publication(request(url))).status,200);
 const republished=await f.publication(request(f.route+'/publish','POST',{},f.first));const secondUrl=(await republished.json()).url;assert.notEqual(secondUrl,url);assert.equal((await f.publication(request(url))).status,404);assert.match(await (await f.publication(request(secondUrl))).text(),/Conteúdo editado depois/);
 assert.equal((await f.publication(request(f.route+'/publish','DELETE',undefined,f.first))).status,200);assert.equal((await f.publication(request(secondUrl))).status,404);
});
test('runtime próprio usa só checkout configurado e atende modal/FAQ/favorito',()=>{
 const handlers={},opened=[],classes=new Set(),body={style:{overflow:'auto'}},modal={classList:{toggle:(name,value)=>value?classes.add(name):classes.delete(name)},setAttribute(){}};
 const context={document:{body,addEventListener:(event,handler)=>{handlers[event]=handler;},getElementById:id=>id==='buyModalOverlay'?modal:null,querySelectorAll:()=>[]},window:{open:(...args)=>opened.push(args)},alert:()=>opened.push('unavailable'),WeakMap};
 runInNewContext(migrationRuntime({checkoutUrl:'https://checkout.proprio.example/pagar'}),context);
 const click=action=>handlers.click({target:{closest:()=>({getAttribute:name=>name==='data-jutso-action'?action:null,hasAttribute:()=>false})},preventDefault(){}});
 click('open-buy');assert.equal(classes.has('active'),true);assert.equal(body.style.overflow,'hidden');click('close-buy');assert.equal(classes.has('active'),false);assert.equal(body.style.overflow,'auto');click('checkout');assert.equal(opened[0][0],'https://checkout.proprio.example/pagar');
 runInNewContext(migrationRuntime({checkoutUrl:'javascript:alert(1)'}),context);click('checkout');assert.equal(opened[1],'unavailable');
 const favoriteAttrs={'data-jutso-action':'favorite'},favoriteClasses=new Set(),favorite={getAttribute:name=>favoriteAttrs[name]??null,hasAttribute:()=>false,setAttribute:(name,value)=>{favoriteAttrs[name]=value;},classList:{toggle:(name,value)=>value?favoriteClasses.add(name):favoriteClasses.delete(name)}};
 handlers.click({target:{closest:()=>favorite},preventDefault(){}});assert.equal(favoriteAttrs['aria-pressed'],'true');assert.equal(favoriteClasses.has('active'),true);
 const faqAttrs={'data-jutso-action':'faq'},faqClasses=new Set(),answer={hidden:true},item={classList:{contains:name=>faqClasses.has(name),toggle:(name,value)=>value?faqClasses.add(name):faqClasses.delete(name)},querySelector:()=>answer},faq={getAttribute:name=>faqAttrs[name]??null,hasAttribute:()=>false,setAttribute:(name,value)=>{faqAttrs[name]=value;},closest:()=>item};
 handlers.click({target:{closest:()=>faq},preventDefault(){}});assert.equal(answer.hidden,false);assert.equal(faqAttrs['aria-expanded'],'true');handlers.click({target:{closest:()=>faq},preventDefault(){}});assert.equal(answer.hidden,true);
});
test('runtime redefine carrossel capturado e oferece swipe sem scripts originais',()=>{
 const events={},track={children:[{}, {}, {}],style:{transform:'translateX(-1920px)'},parentElement:{clientWidth:320},addEventListener:(name,handler)=>{events[name]=handler;}},document={body:{style:{}},querySelectorAll:selector=>selector.includes('carousel-track')?[track]:[],addEventListener(){}};
 runInNewContext(migrationRuntime(),{document,WeakMap});assert.equal(track.style.transform,'translateX(0px)');
 events.touchstart({changedTouches:[{clientX:220}]});events.touchend({changedTouches:[{clientX:80}]});assert.equal(track.style.transform,'translateX(-320px)');
 events.touchstart({changedTouches:[{clientX:80}]});events.touchend({changedTouches:[{clientX:220}]});assert.equal(track.style.transform,'translateX(-0px)');
});
test('ZIP preserva UTF-8 e cabeçalhos válidos em arquivos binários',()=>{
 const files=unzip(createZip({'ação.html':'<h1>Olá, português!</h1>','index.html':'<a href="ação.html">Ir</a>'}));assert.equal(files['ação.html'],'<h1>Olá, português!</h1>');
});
