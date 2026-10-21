import test from 'node:test';
import assert from 'node:assert/strict';
import {relatedCaptureUrls} from '../workspace.js';
const project=links=>({pages:[{sourceUrl:'https://offer.example/start/index.html',discoveredLinks:links}]});
test('descoberta mantém páginas públicas do site e exclui conta, checkout e URLs com credenciais',()=>{
 const links=['https://offer.example/login','/api/data','/checkout','/novo','/carrinho','https://other.example/next','https://user:pass@offer.example/next','javascript:alert(1)','/obrigado','/oferta-capivara'];
 assert.deepEqual(relatedCaptureUrls(project(links),'https://offer.example/start'),['https://offer.example/obrigado','https://offer.example/oferta-capivara']);
});
test('descoberta remove aliases da entrada, fragmentos, variações de consulta e limita quatro páginas',()=>{
 const links=['/start','/start/?utm=1','/start/index.html#x','/next#x','/next?utm=1','/three','/four','/five','/six'];
 assert.deepEqual(relatedCaptureUrls(project(links),'https://offer.example/start'),['https://offer.example/next','https://offer.example/three','https://offer.example/four','https://offer.example/five']);
});
