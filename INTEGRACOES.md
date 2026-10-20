# Integrações e hospedagem

A interface e o editor são independentes da captura remota, cobrança e publicação de projetos. A autenticação tem um handler compartilhado entre o servidor Node.js local e Netlify Functions. As outras integrações descritas abaixo continuam propostas. Alterar URLs em `brand.integrations` não implementa um backend nem conecta automaticamente a interface a um novo provedor.

## Build e rotas públicas

Após `npm install`, execute `npm run build` ou `node scripts/build.mjs`. O build gera `dist` somente com assets públicos. Não deve incluir `.env`, `.env.local`, `.data`, código de servidor ou documentação. `netlify.toml` publica `dist` e registra `netlify/functions` como diretório de funções.

As páginas `/login`, `/register` e `/app` têm arquivos `/rota/index.html` e regras `_redirects`. Essa combinação permite acesso direto e atualização de página sem depender de navegação prévia pela home. O 404 em https://serene-cuchufli-29657f.netlify.app/login foi confirmado no navegador. O projeto está sendo preparado para corrigir esse cenário; não há verificação online concluída da versão corrigida.

Na Netlify, use integração Git ou CLI com deploy das funções. Arrastar `dist` para o serviço publica a interface estática e o editor, mas não a API. Não anunciar cadastro/login como disponíveis nessa modalidade de envio.

## Contas — API implementada para Netlify Functions

Rotas de autenticação:

- `POST /api/auth/register`: cadastro público com nome, e-mail e senha.
- `POST /api/auth/login`: entrada com e-mail e senha.
- `GET /api/auth/session`: consulta da sessão atual.
- `POST /api/auth/logout`: encerramento da sessão.

As rotas usam Netlify Functions. Contas e sessões persistem em `@netlify/blobs`, por `getStore` no escopo do site e consistência `strong`. O deploy deve disponibilizar as funções e seu contexto Netlify para que o armazenamento funcione. Credenciais ou arquivos locais de configuração não devem ser copiados para os assets públicos.

O cadastro não exige, nesta versão, confirmação por e-mail. Verificação de endereço e recuperação de senha por e-mail permanecem pendentes; não anunciar esses recursos como disponíveis. A existência de uma conta não ativa captura remota, plano pago ou hospedagem de projetos.

Localmente, `node server.mjs` executa o mesmo handler com armazenamento em `.data`, ignorado pelo Git. A conta legada de `.env.local` mantém login exclusivamente local. Nenhuma credencial deve constar na documentação, no repositório ou em `dist`.

Antes de considerar a implantação concluída, testar as rotas públicas por endereço direto e o ciclo cadastro → login → atualização/sessão → logout na URL final. Os testes da interface anteriores à correção não substituem essa verificação online.

## Captura remota — contrato proposto

Base sugerida: `/api/clone-jobs`. `POST /` autenticado recebe `{url}` e retorna 202 com `{id,status:"queued"}`. `GET /:id` retorna `{id,status,progress,projectId,error}`; estados: `queued`, `running`, `completed`, `failed`. Quando concluído, o servidor fornece um projeto pertencente ao usuário; assets e exportações exigem controle de acesso próprio.

Faltam fila, trabalhadores de navegador isolados, armazenamento de projetos, autorização, limites e conector da interface. O servidor deve bloquear destinos de rede interna e limitar redirecionamentos, tamanho e tempo. Capturar somente conteúdo público ou autorizado, sem contornar acessos. O editor atual não acessa sua URL de referência.

## Pagamento — contrato proposto

`POST /api/checkout` autenticado recebe `{planId}` e retorna `{checkoutUrl}`. Preços são resolvidos no servidor. Eventos assinados em `/api/billing/webhook` devem atualizar os direitos da conta com processamento idempotente; o retorno visual do checkout não comprova pagamento.

Faltam provedor, credenciais, produtos/preços comerciais, URLs de retorno, tratamento de eventos, cancelamento e conector da interface. Os planos exibidos permanecem propostas demonstrativas.

## Publicação de projetos — contrato proposto

Base sugerida: `/api/deployments`. `POST /` autenticado recebe `{projectId,domain?}` e retorna 202 com `{id,status:"queued"}`. `GET /:id` retorna `{id,status,url,error}`. Domínios próprios exigem verificação de propriedade e DNS; a URL pública só deve ser apresentada após conclusão.

Esta integração é diferente de hospedar a própria aplicação Jutsoclone na Netlify. Faltam armazenamento de projetos, processo de publicação, provedor, TLS/domínios, autorização, remoção e conector da interface. O editor não publica páginas. A exportação ZIP funciona localmente e independe dessas integrações.
