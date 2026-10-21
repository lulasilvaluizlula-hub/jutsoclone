# Integrações e hospedagem

Contas e projetos têm handlers compartilhados entre o servidor Node.js local e Netlify Functions. A captura atual importa apenas HTML/CSS público estático. Cobrança, domínios, indicações e publicação de projetos continuam pendentes. Alterar URLs em `brand.integrations` não implementa um backend nem conecta automaticamente a interface a um novo provedor.

## Build e rotas públicas

Após `npm install`, execute `npm run build` ou `node scripts/build.mjs`. O build gera `dist` somente com assets públicos. Não deve incluir `.env`, `.env.local`, `.data`, código de servidor ou documentação. `netlify.toml` publica `dist` e registra `netlify/functions` como diretório de funções.

As páginas `/login`, `/register` e `/app` têm arquivos `/rota/index.html` e regras `_redirects`. Essa combinação permite acesso direto e atualização de página sem depender de navegação prévia pela home. O 404 em https://serene-cuchufli-29657f.netlify.app/login foi confirmado no navegador. O projeto está sendo preparado para corrigir esse cenário; não há verificação online concluída da versão corrigida.

Na Netlify, use integração Git ou CLI com deploy das funções. Arrastar `dist` publica somente a interface estática; não instala as APIs de autenticação, projetos e captura. O fluxo completo exige deploy com funções.

## Contas — API implementada para Netlify Functions

Rotas de autenticação:

- `POST /api/auth/register`: cadastro público com nome, e-mail e senha.
- `POST /api/auth/login`: entrada com e-mail e senha.
- `GET /api/auth/session`: consulta da sessão atual.
- `POST /api/auth/logout`: encerramento da sessão.

As rotas usam Netlify Functions. Contas e sessões persistem em `@netlify/blobs`, por `getStore` no escopo do site e consistência `strong`. O deploy deve disponibilizar as funções e seu contexto Netlify para que o armazenamento funcione. Credenciais ou arquivos locais de configuração não devem ser copiados para os assets públicos.

O cadastro não exige, nesta versão, confirmação por e-mail. Verificação de endereço e recuperação de senha por e-mail permanecem pendentes; não anunciar esses recursos como disponíveis. A conta permite acesso aos projetos e à captura estática implementada, mas não ativa plano pago, domínio ou hospedagem de projetos.

Localmente, `node server.mjs` executa o mesmo handler com armazenamento em `.data`, ignorado pelo Git. A conta legada de `.env.local` mantém login exclusivamente local. Nenhuma credencial deve constar na documentação, no repositório ou em `dist`.

Antes de considerar a implantação concluída, testar as rotas públicas por endereço direto e o ciclo cadastro → login → atualização/sessão → logout na URL final. Os testes da interface anteriores à correção não substituem essa verificação online.

## Projetos e captura estática — implementados

A API autenticada usa `/api/projects`:

- `GET /api/projects`: lista os projetos da conta.
- `POST /api/projects`: cria um projeto com título e HTML próprio ou `sourceUrl` pública.
- `GET /api/projects/:id`: carrega um projeto pertencente à conta.
- `PUT /api/projects/:id`: salva título e HTML editados.
- `DELETE /api/projects/:id`: exclui o projeto da conta.

A sessão é validada pelo leitor compartilhado de autenticação. Projetos são separados por proprietário no armazenamento; usam Netlify Blobs no deploy e armazenamento local em `.data` no servidor Node.js. Alterações exigem origem autorizada.

A captura recebe uma página HTTP/HTTPS pública em portas padrão. Valida endereços e redirecionamentos, bloqueia redes internas e aplica limites de tempo e tamanho. Importa HTML e um conjunto limitado de folhas CSS; não executa JavaScript, não utiliza credenciais da origem e não acessa áreas restritas. Scripts, atributos de eventos e formulários ativos são removidos ou desativados. Páginas dependentes de JavaScript podem ser recusadas. Imagens e outros recursos podem permanecer externos, inclusive no ZIP exportado.

O editor permite ajustar textos, links, imagens, vídeos, URLs e HTML. O salvamento aplica novamente as regras de sanitização. A exportação não equivale a publicar a página nem garante que todos os assets da origem estejam incorporados. Captura com navegador executando JavaScript, tarefas assíncronas e empacotamento integral de assets exigiriam implementação adicional.

## Pagamento — contrato proposto

`POST /api/checkout` autenticado recebe `{planId}` e retorna `{checkoutUrl}`. Preços são resolvidos no servidor. Eventos assinados em `/api/billing/webhook` devem atualizar os direitos da conta com processamento idempotente; o retorno visual do checkout não comprova pagamento.

Faltam provedor, credenciais, produtos/preços comerciais, URLs de retorno, tratamento de eventos, cancelamento e conector da interface. Os planos exibidos permanecem propostas demonstrativas.

## Publicação de projetos — contrato proposto

Base sugerida: `/api/deployments`. `POST /` autenticado recebe `{projectId,domain?}` e retorna 202 com `{id,status:"queued"}`. `GET /:id` retorna `{id,status,url,error}`. Domínios próprios exigem verificação de propriedade e DNS; a URL pública só deve ser apresentada após conclusão.

Esta integração é diferente de hospedar a própria aplicação Jutsoclone na Netlify. Faltam armazenamento de projetos, processo de publicação, provedor, TLS/domínios, autorização, remoção e conector da interface. O editor não publica páginas. A exportação ZIP funciona localmente e independe dessas integrações.

## Domínios e indicações

Ainda não há integração de domínio próprio, gestão DNS ou programa de indicações. As restrições observadas na referência não foram contornadas nem convertidas em integrações privadas. Para implementar, faltam regras comerciais, armazenamento e autorização, provedor DNS/publicação e mecanismos de atribuição e eventual remuneração.

A geração automática de link observada no único teste autorizado da referência não foi tomada como autorização para publicação automática na Jutsoclone. O editor desta implementação não publica projetos.
