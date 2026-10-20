import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadEnvFile } from 'node:process';
const root=path.dirname(fileURLToPath(import.meta.url));
try{loadEnvFile(path.join(root,'.env.local'))}catch(error){if(error.code!=='ENOENT')throw error}
const scrypt=promisify(scryptCallback);
const account={name:'Conta de teste',email:process.env.JUTSO_DEMO_EMAIL||''};
const configuredHash=process.env.JUTSO_DEMO_PASSWORD_HASH||'';
const passwordSalt=process.env.JUTSO_DEMO_PASSWORD_SALT||'';
const accountConfigured=Boolean(account.email&&passwordSalt&&/^[a-f0-9]{128}$/i.test(configuredHash));
const passwordHash=accountConfigured?Buffer.from(configuredHash,'hex'):null;
const sessions=new Map(), duration=8*60*60*1000, cookieName='jutsoclone_demo_session';
function json(res,status,data,headers={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(JSON.stringify(data))}
function cookie(req){return req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1)}
async function body(req){let text='';for await(const chunk of req){text+=chunk;if(text.length>2048)throw new Error('body_limit')}return JSON.parse(text)}
async function api(req,res,pathname){
  for(const [token,expires]of sessions)if(expires<=Date.now())sessions.delete(token);
  if(pathname==='/api/demo/session'&&req.method==='GET'){json(res,200,{user:sessions.has(cookie(req))?account:null,mode:'local-demo'});return}
  if(!['/api/demo/login','/api/demo/logout'].includes(pathname)||req.method!=='POST'){json(res,404,{error:'Endpoint não encontrado.'});return}
  if(req.headers.origin!==`http://${req.headers.host}`){json(res,403,{error:'Origem não autorizada.'});return}
  if(pathname==='/api/demo/logout'){sessions.delete(cookie(req));json(res,200,{ok:true},{'Set-Cookie':`${cookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`});return}
  if(!accountConfigured){json(res,503,{error:'Conta de teste não configurada. Execute node configurar-teste.mjs no computador do servidor.'});return}
  try{
    const input=await body(req);
    if(typeof input.email!=='string'||typeof input.password!=='string'||input.email.length>254||input.password.length>128){json(res,400,{error:'Informe e-mail e senha válidos.'});return}
    const supplied=await scrypt(input.password,passwordSalt,64);
    if(!timingSafeEqual(supplied,passwordHash)||input.email.trim().toLowerCase()!==account.email){json(res,401,{error:'E-mail ou senha incorretos para a conta de teste.'});return}
    sessions.delete(cookie(req));if(sessions.size>=32)sessions.delete(sessions.keys().next().value);
    const token=randomBytes(32).toString('hex');sessions.set(token,Date.now()+duration);
    json(res,200,{user:account,mode:'local-demo'},{'Set-Cookie':`${cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${duration/1000}`});
  }catch{json(res,400,{error:'Não foi possível validar os dados de acesso.'})}
}
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.md':'text/plain; charset=utf-8'};
const server=http.createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(pathname.startsWith('/api/')){await api(req,res,pathname);return}if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return}const route=['/','/login','/register','/app'].includes(pathname)?'/index.html':pathname;const file=path.resolve(root,'.'+route);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}if(!types[path.extname(file)]){res.writeHead(404).end();return}const data=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)],'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:data)}catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'}).end('Página não encontrada')}});
server.listen(4173,'127.0.0.1',()=>console.log('Jutsoclone: http://127.0.0.1:4173'));
