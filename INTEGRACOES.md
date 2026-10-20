# Integrações propostas

Estes contratos são um ponto de partida para serviços de produção. O servidor local já oferece uma conta fixa de teste por `/api/demo/login`, `/api/demo/session` e `/api/demo/logout`, sem serviços externos. A sessão é mantida na memória, com cookie HttpOnly/SameSite=Strict e duração máxima de oito horas. Os campos `brand.integrations` em `brand.config.js` continuam reservados para serviços futuros: preencher URLs não ativa contas de produção, captura, cobrança ou publicação.

## Contas — `authEndpoint`

Proposta: base `/api/auth`. `POST /register` recebe `{name,email,password}`; `POST /login` recebe `{email,password}`; `POST /logout` encerra a sessão; `GET /session` retorna `{user:{id,name,email}}` ou 401. Sucesso de cadastro/acesso devolve usuário e sessão em cookie seguro HttpOnly. Erros usam `{error:{code,message}}`, sem expor detalhes internos.

Para produção, faltam provedor ou armazenamento de contas, recuperação e verificação de e-mail, política de senhas, limitação de tentativas e conexão do cadastro. A tela de login já verifica a conta fixa de teste no servidor local; o cadastro público permanece desconectado. Nenhuma senha é guardada no navegador.

## Captura remota — `cloneEndpoint`

Proposta: base `/api/clone-jobs`. `POST /` autenticado recebe `{url}` e retorna 202 com `{id,status:"queued"}`. `GET /:id` retorna `{id,status,progress,projectId,error}`; estados: `queued`, `running`, `completed`, `failed`. Quando concluído, o servidor fornece um projeto pertencente ao usuário; assets e exportações precisam de endpoints de acesso autorizados próprios.

Faltam fila, trabalhadores de navegador isolados, armazenamento, propriedade dos projetos e tratamento de falhas. O servidor deve limitar destinos, redirecionamentos, tamanho e tempo de captura e bloquear acesso a redes internas. Só capturar conteúdos públicos ou autorizados, sem contornar controles de acesso. A URL da demo não inicia tarefa alguma.

## Pagamento — `checkoutEndpoint`

Proposta: `POST /api/checkout` autenticado recebe `{planId}` e retorna `{checkoutUrl}`. Preços e plano são resolvidos no servidor; o navegador não decide o valor cobrado. O servidor recebe eventos assinados em `/api/billing/webhook`, processa-os de forma idempotente e atualiza os direitos da conta. O retorno visual do checkout não comprova pagamento.

Faltam provedor, credenciais, produtos/preços reais, URLs de retorno, eventos de pagamento e cancelamento, cobrança recorrente e definição comercial. Os planos exibidos são propostas; não há checkout ativo.

## Publicação — `hostingEndpoint`

Proposta: base `/api/deployments`. `POST /` autenticado recebe `{projectId,domain?}` e retorna 202 com `{id,status:"queued"}`. `GET /:id` retorna `{id,status,url,error}`. Domínios próprios exigem verificação separada de propriedade e configuração DNS; o endereço público só deve aparecer após publicação concluída.

Faltam armazenamento, processo de publicação, provedor de hospedagem, TLS, gestão de domínio, autorização por projeto e operação de remoção. A aplicação atual não publica páginas. A exportação ZIP local funciona de forma independente dessas integrações.

## Antes de ativar

Definir políticas de acesso por usuário e limites de uso no servidor; manter credenciais fora dos arquivos públicos; testar respostas de erro e estados pendentes na interface; revisar privacidade, termos, contatos e condições comerciais. Publicação externa depende de autorização do responsável pela marca.
