import test from 'node:test';
import assert from 'node:assert/strict';
import {captureRenderedPage} from '../lib/render.mjs';

test('Chrome real executa JavaScript, incorpora imagem e CSS e bloqueia pedidos privados', {skip:process.env.RUN_BROWSER_TESTS!=='1',timeout:45000},async()=>{
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aFogAAAAASUVORK5CYII=','base64');
 const calls=[],blocked=[];
 const fetch=async(value)=>{
  calls.push(value);const url=new URL(value);
  if(url.pathname==='/pixel.png')return {url:value,status:200,headers:{'content-type':'image/png'},body:png};
  return {url:value,status:200,headers:{'content-type':'text/html'},body:Buffer.from(`<!doctype html><html><head><meta charset="utf-8"><title>Fixture renderizada</title></head><body><div id="root"></div><script>setTimeout(()=>{document.getElementById('root').innerHTML='<h1>Conteúdo renderizado por JavaScript para verificar que o motor não salva apenas a tela de carregamento e mantém todos os elementos esperados no documento final.</h1><img src="/pixel.png"><button onclick="toggleFaq(this)">Pergunta</button>';const style=document.createElement('style');document.head.append(style);style.sheet.insertRule('h1 { color: rgb(1, 2, 3); }');fetch('http://127.0.0.1/private').catch(()=>{});},400)</script></body></html>`)};
 };
 const result=await captureRenderedPage('https://capture.example.org/',{fetch,onBlocked:d=>blocked.push(d)});
 assert.match(result.html,/Conteúdo renderizado por JavaScript/);
 assert.match(result.html,/data:image\/png;base64/);
 assert.match(result.html,/rgb\(1, 2, 3\)/);
 assert.match(result.html,/data-jutso-action="faq"/);
 assert.doesNotMatch(result.html,/<script|onclick=/);
 assert.ok(blocked.some(d=>d.url==='http://127.0.0.1/private'));
 assert.ok(calls.every(url=>!url.includes('127.0.0.1')));
});
