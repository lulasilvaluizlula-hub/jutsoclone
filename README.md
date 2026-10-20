# Jutsoclone

Implementação própria em português, inspirada na organização pública de clonuxy.com. Interface em HTML, CSS e JavaScript; servidor Node.js local e autenticação preparada para Netlify Functions. Editor e planos continuam demonstrativos: não há captura de sites remotos nem pagamento.

## Executar localmente

É necessário Node.js. Em um novo clone, na pasta do projeto:

```powershell
npm install
npm run build
node server.mjs
```

Abra http://127.0.0.1:4173. Para encerrar, pressione Ctrl+C no terminal. Rotas: `/`, `/login`, `/register` e `/app`.

O cadastro público permite criar uma conta, entrar e sair. Ainda não há verificação ou recuperação de senha por e-mail. O servidor local usa o mesmo handler de autenticação das funções, com armazenamento em `.data`, ignorado pelo Git. A conta legada configurada em `.env.local` continua disponível apenas no servidor local; não é uma conta de produção. Não publique esses arquivos nem compartilhe credenciais.

## Hospedar na Netlify

O build `node scripts/build.mjs` (também executado por `npm run build`) gera `dist` somente com arquivos públicos da interface. `.env`, armazenamento, código de servidor e documentação não pertencem à pasta publicada. `netlify.toml` define `publish = "dist"` e as funções em `netlify/functions`.

Faça o deploy pelo repositório Git conectado à Netlify ou pela CLI da Netlify com envio das funções. O envio de `dist` por arrastar e soltar serve as páginas e o editor demonstrativo, mas **não instala a API de autenticação**. Cadastro e login exigem Netlify Functions e armazenamento Netlify Blobs.

As rotas `/login`, `/register` e `/app` recebem arquivos próprios em `/rota/index.html` e regras em `_redirects`, permitindo abrir e atualizar esses endereços diretamente.

Foi confirmado no navegador um erro 404 em https://serene-cuchufli-29657f.netlify.app/login. A correção prepara o projeto para esse ambiente; a implantação corrigida ainda não foi verificada online. Depois do deploy, verificar abertura direta das três rotas, cadastro, login, sessão após atualizar a página e logout.

## Personalizar

Edite `brand.config.js`:

- `name`, `company`, `tagline` e `description`: identidade e apresentação.
- `logo`: imagem opcional; `null` mantém o nome em texto.
- `colors`: paleta proposta em verde-lima, turquesa e grafite.
- `email` e `whatsapp`: contatos ainda não informados.
- `plans`: propostas ilustrativas de planos e recursos.
- `integrations`: configuração de serviços; preencher URLs sozinho não implementa um servidor ou conector.

O favicon está em `favicon.svg`; os metadados iniciais estão em `index.html`. Para um logotipo próprio, coloque o arquivo entre os assets públicos e configure seu caminho. Consulte `INTEGRACOES.md` para autenticação, armazenamento e pendências.

## O que funciona

Navegação responsiva, menu móvel, perguntas frequentes, diálogos informativos e fluxo de contas; editor de exemplo próprio com título, descrição, cor e prévia ao vivo; salvamento do rascunho neste navegador; restauração do exemplo; exportação de ZIP real contendo `index.html`, `styles.css` e `LEIA-ME.txt`.

Na Netlify, contas e sessões usam armazenamento persistente Netlify Blobs com consistência forte. A implantação com as funções deve estar concluída para esse fluxo funcionar online. O rascunho do editor continua local ao navegador e não sincroniza entre dispositivos. A URL informada no editor não é acessada ou clonada. Os planos são propostas; não há checkout nem publicação de projetos pelo editor.

## Evidências e limites

REA verificou anteriormente a renderização desktop e o fluxo móvel de menu, FAQ, editor, edição, salvamento e acionamento da exportação, sem eventos de console ou erros de página nas capturas locais. A persistência do rascunho após recarregar foi confirmada no navegador. O REA cancela downloads por projeto; o ZIP foi validado separadamente pela função real em Node e descompactação com .NET, conferindo arquivos e UTF-8. Esses testes anteriores não comprovam a correção online de hospedagem ou os novos fluxos de autenticação.

Consulte `ANALISE.md` para IDs das evidências da referência e da interface. Em `referencias/` estão as capturas desktop e mobile. Não há integração com serviços privados do site de referência, nem reaproveitamento de seus logotipos, depoimentos ou imagens exclusivas.

Captura remota, pagamentos, publicação de projetos, recuperação/verificação de e-mail e informações legais permanecem pendentes. Nenhuma implantação online corrigida é afirmada por este documento.
