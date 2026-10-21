# Jutsoclone

Aplicação própria em português para importar páginas públicas autorizadas, editar projetos com várias páginas, exportar ZIP e publicar um snapshot por confirmação explícita. Usa HTML/CSS/JavaScript, Node.js, Netlify Functions e Netlify Blobs. A interface e o runtime de interação são próprios; código privado, contas e serviços da origem não são transferidos.

## Executar

Requer Node.js 22.17 ou superior (ou 24+). No Windows, a captura renderizada também exige Google Chrome oficial instalado em um dos caminhos usuais de `Program Files`. Na Netlify/Linux, o navegador usa `@sparticuz/chromium` e `playwright-core`.

```powershell
npm install
npm run build
node server.mjs
```

Abra `http://127.0.0.1:4173`. Rotas: `/`, `/login`, `/register`, `/app`, `/projects`, `/novo`, `/editor?id=ID`, `/planos`, `/dominios` e `/indique`. `exemplo.html` é uma página estática original da marca para experimentar a importação. Encerre o servidor com Ctrl+C. Execute `npm test` para os testes automatizados.

## Importar, editar e exportar

Cadastre sua conta, abra **Novo projeto** e forneça uma URL pública autorizada ou HTML próprio. A captura renderiza JavaScript em navegador isolado antes de produzir um snapshot editável. Tenta incorporar imagens, fontes e estilos dentro dos limites disponíveis; recursos bloqueados, pesados ou incompatíveis são informados nos avisos da página.

No editor, adicione ou selecione páginas, altere textos, links, imagens, vídeos, URLs e HTML, e salve. A substituição de URLs percorre as páginas do projeto. **Baixar todas em ZIP** exporta a entrada como `index.html`, as demais páginas em arquivos separados e um `LEIA-ME.txt`. Links reconhecidos entre páginas importadas são reescritos para os arquivos locais. Recursos não incorporados continuam dependendo de seus endereços externos.

Limites: 20 páginas por projeto, 4 MB de HTML por página, 10 MB de HTML no conjunto e corpo JSON de até 5,5 MB. Requisições com `?meta=1` retornam metadados sem duplicar o HTML; o editor carrega separadamente a página selecionada. Esses limites não garantem compatibilidade com toda página ou serviço externo.

A captura não transfere scripts originais para a versão salva. A opção de testar interações e os arquivos exportados/publicados usam um runtime próprio, com suporte delimitado a âncoras, `details`, acordeões com atributos de acessibilidade e marcadores reconhecidos de FAQ, modal de compra, galeria, swipe, zoom, favorito, seleção visual de kit e controles de vídeo. Isso não reproduz JavaScript arbitrário nem a lógica privada da origem.

## Checkout e publicação

Em **Configurações**, informe seu próprio `checkoutUrl` e, opcionalmente, `backRedirectUrl`. Botões reconhecidos como compra não reutilizam o checkout original: sem destino próprio configurado, ficam indisponíveis. Configurar uma URL não cria cobrança, assinatura ou processamento de pagamento. A quantidade selecionada no exemplo não altera automaticamente os parâmetros de um checkout externo. O clique final de compra não foi executado nos testes.

**Publicar projeto** abre uma confirmação separada. Após confirmação, o servidor salva um snapshot e fornece um endereço público em `/p/TOKEN/`. Não há publicação automática ao importar ou salvar. Editar o projeto não altera um snapshot já publicado; publicar novamente gera outro token e revoga o anterior. A API permite revogar a publicação. Publicação usa páginas isoladas por CSP e um runtime próprio; domínio personalizado continua pendente.

Nenhuma publicação real do alvo de referência foi efetuada nesta etapa. Os testes de publicação usam apenas fixtures próprias.

## Contas e dados

Contas, sessões, projetos e snapshots usam Netlify Blobs no escopo do site, com consistência `strong`. Localmente, os dados ficam em `.data`, ignorado pelo Git. A configuração legada de `.env.local` vale exclusivamente para o ambiente local. Não copie configurações privadas, dados locais ou credenciais para o repositório ou `dist`.

Verificação de e-mail, recuperação de senha por e-mail, planos pagos, cobrança recorrente, domínios personalizados e programa de indicações continuam pendentes. Scripts de rastreamento e pixels da origem não são restaurados automaticamente; não há integração de pixels de conversão nesta versão.

## Netlify

Conecte o repositório com `netlify.toml`: build `npm run build`, publicação `dist`, funções em `netlify/functions`. O build inclui somente arquivos públicos e entradas das rotas; documentação, `.data`, `.env` e código do servidor ficam fora de `dist`. Arrastar somente `dist` não instala Functions, contas, captura ou publicação.

A versão anterior foi exercitada no endereço hospedado para login, sessão, captura do exemplo e edição. Em 21/10/2026 a nova versão foi verificada na Netlify com captura renderizada da oferta autorizada, edição no painel e download do ZIP. A captura preservou a página do produto e incorporou recursos. A publicação pública da oferta não foi acionada. Localmente também foi verificado projeto com duas páginas e modal/FAQ no ZIP extraído. O encerramento desta etapa registrou 33 testes aprovados, incluindo renderização com Chrome real. Consulte `ANALISE.md` para o escopo exato e as limitações.

## Personalizar

Edite `brand.config.js` para marca, empresa, apresentação, logotipo, paleta, contatos e planos propostos. `logo: null` mantém o nome em texto. WhatsApp e e-mail não foram informados. O favicon fica em `favicon.svg`; metadados iniciais, em `index.html`. A paleta própria usa verde-lima, turquesa e grafite.

Consulte `INTEGRACOES.md` para APIs e pendências. Use somente materiais próprios ou autorizados; recursos capturados de terceiros continuam sujeitos aos respectivos direitos. Os testes privados do alvo não são incorporados como material público do produto.

A importação por URL permite incluir automaticamente até quatro páginas internas detectadas, com filtros de conta/checkout, além de adicionar páginas manualmente no editor.
