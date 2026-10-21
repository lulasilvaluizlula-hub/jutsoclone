# Jutsoclone

Implementação própria em português, inspirada na organização e nos comportamentos observados da referência. Interface HTML/CSS/JavaScript, servidor Node.js e Netlify Functions. A versão inclui contas, projetos persistentes, captura estática limitada, editor e exportação ZIP. Pagamentos, domínios próprios e indicações continuam pendentes.

## Executar

Requer Node.js 22.16 ou superior. Em um novo clone:

```powershell
npm install
npm run build
node server.mjs
```

Abra http://127.0.0.1:4173. Rotas: `/`, `/login`, `/register` e `/app`. Para encerrar o servidor, pressione Ctrl+C. Para os testes automatizados disponíveis: `npm test`.

## Contas e projetos

Cadastre uma conta para criar, listar, abrir, editar e excluir seus projetos. O painel e a API persistem os projetos por usuário. É possível começar com HTML próprio ou solicitar uma captura de página pública autorizada. No editor, ajuste textos, links, imagens, vídeos, URLs e HTML, salve o projeto e exporte o ZIP.

A captura importa HTML/CSS estático; não executa JavaScript nem acessa contas, formulários ou serviços privados da origem. Páginas dependentes de JavaScript podem não ser compatíveis. Imagens e outros recursos podem continuar externos: a exportação não deve ser tratada como cópia integral independente da origem. Revise os avisos de cada captura e use somente materiais próprios ou autorizados. O editor não publica automaticamente seu projeto.

O cadastro ainda não tem confirmação ou recuperação de senha por e-mail. Na Netlify, contas, sessões e projetos usam Netlify Blobs persistente; localmente, os dados ficam em `.data`, ignorado pelo Git. A conta legada configurada em `.env.local` é exclusivamente local. Não publique esses arquivos nem compartilhe credenciais.

## Hospedar na Netlify

`npm run build` executa `node scripts/build.mjs` e gera `dist` apenas com assets públicos. `.env`, `.env.local`, `.data`, servidor e documentação ficam fora da pasta publicada. `netlify.toml` define a publicação de `dist` e as funções em `netlify/functions`. Há regras `_redirects` e arquivos próprios para acesso direto a `/login`, `/register` e `/app`.

Use integração Git ou CLI da Netlify com envio das funções. Arrastar `dist` publica somente a interface estática; não instala as APIs de contas, projetos e captura. O fluxo completo exige Functions e Blobs.

Foi confirmado no navegador um 404 em https://serene-cuchufli-29657f.netlify.app/login antes da correção de hospedagem. Este documento não afirma teste online concluído da versão atual. Após o deploy, verificar rotas diretas, cadastro, sessão, logout e CRUD de projetos na URL final.

## Personalizar

Edite `brand.config.js` para nome, empresa, apresentação, logotipo, paleta, contatos e planos propostos. `logo: null` mantém o nome em texto. WhatsApp e e-mail não foram informados. O favicon está em `favicon.svg`; metadados iniciais estão em `index.html`. A paleta usa verde-lima, turquesa e grafite.

Os campos de integrações não implementam um servidor por si só. Consulte `INTEGRACOES.md`. Os planos comerciais são propostas e não têm checkout ativo.

## Evidências e limites

Leia `ANALISE.md` para observações da referência, limites e IDs REA disponíveis. As capturas e testes antigos da apresentação/editor demonstrativo não comprovam, por si, os novos fluxos autenticados. Não foram recuperados código-fonte privado, banco de dados ou lógica de servidor da referência. Não foram reutilizados logotipos, depoimentos ou imagens exclusivas da referência.

Permanecem pendentes: captura com execução de JavaScript, pagamento/assinaturas, domínios próprios, indicações, publicação de projetos e verificação/recuperação de e-mail. Nenhuma publicação adicional é autorizada por este documento.
