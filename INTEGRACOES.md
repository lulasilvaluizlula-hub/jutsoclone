# Integrações, APIs e hospedagem

A aplicação tem backend próprio em Node.js e Netlify Functions. Autenticação, projetos, páginas, captura renderizada, exportação e publicação compartilham Netlify Blobs no deploy e armazenamento `.data` no servidor local. Alterar URLs em `brand.integrations` não cria integrações por si só.

## Executar e hospedar

Use Node.js 22.16 ou superior, `npm install`, `npm run build` e `node server.mjs`. No Windows, a captura real exige Chrome oficial em `Program Files`; em Linux/Netlify, usa `@sparticuz/chromium` com `playwright-core`.

`netlify.toml` define build `npm run build`, pasta pública `dist` e funções em `netlify/functions`. Use integração Git ou CLI com envio de funções. Arrastar apenas `dist` não instala APIs ou armazenamento. O build exclui `.env`, `.env.local`, `.data`, servidor e documentação. As rotas da aplicação têm entradas estáticas e rewrites para acesso direto.

A verificação online da versão nova ainda está pendente. Após o deploy, testar cadastro/login/sessão/logout, rotas diretas, captura, editor, múltiplas páginas, ZIP e publicação apenas de material próprio autorizado. Testes locais não demonstram que o código atualizado já está na hospedagem.

## Contas

- `POST /api/auth/register`: nome, e-mail e senha.
- `POST /api/auth/login`: e-mail e senha.
- `GET /api/auth/session`: sessão atual.
- `POST /api/auth/logout`: revoga a sessão.

Contas e sessões usam armazenamento no escopo do site com consistência `strong`. Sessões usam cookie HttpOnly; alterações exigem origem autorizada. No ambiente local, a configuração legada de `.env.local` não cria uma conta de produção. Não publique arquivos privados ou credenciais.

Verificação de e-mail e recuperação de senha por e-mail não estão integradas. Autenticar-se não ativa pagamento, domínio próprio ou plano comercial.

## Projetos e páginas

- `GET /api/projects`: lista os projetos da conta, sem HTML e sem proprietário nas respostas de resumo.
- `POST /api/projects`: cria projeto com `{title, sourceUrl}` pública autorizada ou `{title, html}` próprio.
- `GET /api/projects/:id`: carrega um projeto da conta.
- `PUT /api/projects/:id`: atualiza título, HTML da entrada ou `{settings:{checkoutUrl,backRedirectUrl}}`.
- `DELETE /api/projects/:id`: exclui o projeto.
- `POST /api/projects/:id/pages`: adiciona `{title, sourceUrl}` ou `{title, html}`.
- `GET /api/projects/:id/pages`: consulta páginas da conta.
- `GET /api/projects/:id/pages/:pageid`: carrega `{page}` com o HTML selecionado.
- `PUT /api/projects/:id/pages/:pageid`: atualiza `{title?,html?}`.
- `DELETE /api/projects/:id/pages/:pageid`: remove página quando existir outra no projeto.

Use `?meta=1` nas operações de projeto e mutações de página para receber apenas metadados, sem repetir o HTML grande nas respostas. Carregue o HTML pelo endpoint específico da página. `html`, `sourceUrl` e `warnings` no formato legado espelham a primeira página. Excluir a entrada promove a seguinte.

Limites: 20 páginas, 4 MB de HTML por página, 10 MB de HTML por projeto e JSON de até 5,5 MB. O tamanho efetivo do JSON inclui escapes e outros campos. Contas diferentes não podem carregar ou alterar os projetos umas das outras.

## Captura renderizada e recursos

A captura executa o JavaScript público em navegador isolado e transforma o DOM renderizado em HTML editável. Requisições de rede são atendidas por um transporte Node controlado, com DNS/conexão fixados, validação a cada redirecionamento e bloqueio de endereços privados. Pedidos não autorizados, métodos de alteração, WebSockets, service workers e janelas adicionais são bloqueados. Tempo e recursos têm limites; páginas sem conteúdo suficiente ou incompatíveis retornam erro em vez de uma falsa captura concluída.

O empacotamento tenta incorporar imagens, CSS e fontes permitidos. No ensaio privado autorizado, foram incorporados 18 recursos e a inspeção contou 26 de 27 imagens incorporadas; isso não garante captura total. Vídeos ou outros recursos podem permanecer externos. Examine os avisos por página e os direitos sobre os materiais.

Scripts de origem e atributos ativos de eventos são removidos depois da renderização; formulários ficam desativados. Marcadores conhecidos alimentam somente o runtime próprio. Rastreamento e pixels não são restaurados automaticamente. A captura não transfere login, credenciais, banco de dados, APIs privadas ou servidor da origem.

## Exportação e interações

`GET /api/projects/:id/export` exige sessão e retorna ZIP real, transmitido em blocos de 64 KB. Inclui `index.html`, arquivos das outras páginas e `LEIA-ME.txt`. Links internos reconhecidos apontam para os arquivos exportados. Incorporar parte dos recursos não elimina dependências externas nem cria backend de pagamento ou autenticação.

O runtime próprio suporta âncoras, `details`, acordeões com acessibilidade, controles de vídeo e marcadores delimitados de FAQ, modal de compra, popup, favorito, galeria, swipe, zoom e seleção visual de kit do padrão observado. Não é execução do JavaScript original nem compatibilidade universal. A seleção de kit não acrescenta automaticamente quantidade à URL do checkout.

`settings.checkoutUrl` precisa ser um destino próprio HTTP/HTTPS público. Botões identificados como compra usam esse destino; sem configuração, ficam indisponíveis e não reutilizam o checkout original. `settings.backRedirectUrl` adiciona um link explícito de retorno; não manipula o histórico do editor. Configurar esses destinos não conecta processamento de pagamento. Não houve clique final de compra nos testes.

## Publicação por snapshot

- `GET /api/projects/:id/publish`: consulta o endereço publicado ou `null`.
- `POST /api/projects/:id/publish`: com sessão e origem autorizada, cria snapshot e retorna `{url,token}`.
- `DELETE /api/projects/:id/publish`: revoga a publicação da conta.
- `GET /p/:token/`: entrada pública do snapshot.
- `GET /p/:token/:pageid`: outra página publicada.

O editor pede confirmação separada antes do POST. Importar, editar, salvar ou exportar não publica automaticamente. Publicar novamente substitui a referência privada e revoga o token anterior. Alterações posteriores no projeto não atualizam um snapshot existente sem nova publicação. A API permite revogar o snapshot mesmo após excluir o projeto, enquanto sua referência privada existir; excluir o projeto não deve ser confundido com revogação da publicação.

As páginas públicas não expõem registros de conta ou campos de proprietário. Usam `Cache-Control: no-store`, `nosniff`, referrer restrito e CSP com sandbox sem `allow-same-origin`; apenas o runtime próprio recebe nonce de script. O snapshot publicado aceita até 10 MB serializados. Isso é diferente de hospedar o aplicativo Jutsoclone e de conectar domínio personalizado.

Os testes de publicação usaram somente fixtures próprias. Nenhuma publicação real do alvo de referência foi realizada nesta etapa.

## Serviços ainda pendentes

Cobrança recorrente e planos comerciais exigem provedor, produtos/preços do servidor, credenciais, checkout, retorno e webhooks assinados/idempotentes. Um link de checkout do projeto não implementa assinatura da plataforma nem comprova pagamento.

Domínio próprio exige configuração de provedor, comprovação de propriedade, DNS, TLS e associação autorizada ao snapshot. O endereço `/p/TOKEN/` não equivale a essa integração.

Indicações exigem regras comerciais, atribuição, persistência e eventual remuneração. Pixels de conversão exigem configuração própria e tratamento adequado de consentimento; scripts da referência não são copiados como integração. Verificação/recuperação de e-mail exige provedor e fluxo com tokens. Nenhum desses recursos deve ser anunciado como concluído.

## Validação desta etapa

Foram registrados 32 testes automatizados aprovados e um teste separado aprovado com Chrome real. O conjunto cobre contratos e cenários específicos; não substitui verificação no deploy novo nem auditoria integral. Evidências REA, limites observados e distinção entre testes antigos e atuais estão em `ANALISE.md`. Credenciais e registros privados completos do alvo não integram esta documentação ou o repositório.
