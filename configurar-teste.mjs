import { randomBytes, scryptSync } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const email='teste@jutsoclone.local';
const password=randomBytes(18).toString('base64url');
const salt=randomBytes(24).toString('hex');
const hash=scryptSync(password,salt,64).toString('hex');
try{
  await writeFile(fileURLToPath(new URL('.env.local',import.meta.url)),`JUTSO_DEMO_EMAIL=${email}\nJUTSO_DEMO_PASSWORD_HASH=${hash}\nJUTSO_DEMO_PASSWORD_SALT=${salt}\n`,{flag:'wx',mode:0o600});
  console.log(`Conta de teste local criada.\nE-mail: ${email}\nSenha: ${password}\nGuarde a senha. Ela não será exibida novamente.\nInicie a prévia com node server.mjs. Não envie .env.local ao GitHub.`);
}catch(error){if(error.code==='EEXIST'){console.error('Já existe uma configuração local. Ela foi preservada.');process.exitCode=1}else throw error}
