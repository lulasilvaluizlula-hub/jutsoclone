# Jutsoclone

Implementação própria em português, inspirada na organização pública de clonuxy.com. HTML, CSS e JavaScript sem dependências de aplicação. A prévia funciona localmente; o site não foi implantado em hospedagem.

## Executar

### Conta de teste local

Depois de clonar, execute `node configurar-teste.mjs` para gerar sua conta local. O comando mostra o e-mail e a senha uma vez e salva apenas o hash com salt em `.env.local`, ignorado pelo Git. Depois inicie o servidor e abra `http://127.0.0.1:4173/login`. Uma configuração já existente é preservada. Nenhuma senha ou hash de acesso faz parte deste repositório.

O servidor verifica a senha e cria uma sessão local de oito horas em cookie HttpOnly. O botão **Sair da conta** encerra a sessão. Reiniciar o servidor também encerra as sessões. Essa conta é exclusiva da demonstração; o cadastro público e as contas de produção continuam pendentes. O editor demonstrativo também permanece disponível sem conta.

É necessário Node.js. Na pasta deste projeto, execute:

```powershell
node server.mjs
```

Abra http://127.0.0.1:4173. Para encerrar, pressione Ctrl+C no terminal. Rotas disponíveis: `/` (apresentação), `/login`, `/register` e `/app` (editor demonstrativo).

## Personalizar

No Windows, você também pode abrir `Executar.cmd`. Se a prévia já estiver aberta, use o servidor existente para não ocupar a mesma porta duas vezes.

A paleta proposta combina verde elétrico `#b5f66b`, ciano `#55ddd2` e grafite `#090c0b`. Para usar um arquivo de logotipo próprio, coloque-o na pasta do projeto e configure, por exemplo, `logo: '/logo.svg'`.

Edite `brand.config.js`:

- `name`, `company`, `tagline` e `description`: identidade e apresentação.
- `logo`: imagem opcional; `null` mantém o nome em texto.
- `colors`: paleta proposta em verde-lima, turquesa e fundo grafite.
- `email` e `whatsapp`: contatos ainda não informados.
- `plans`: propostas ilustrativas de planos e recursos.
- `integrations`: endereços reservados para serviços futuros; preenchê-los sozinho não conecta um servidor.

O favicon está em `favicon.svg`; os metadados iniciais estão em `index.html`. Consulte `INTEGRACOES.md` antes de conectar serviços reais.

## O que funciona

Navegação responsiva, menu móvel, perguntas frequentes e diálogos informativos; login e saída com conta fixa de teste local, sessão em cookie HttpOnly e validação de campos; editor do exemplo próprio com título, descrição, cor e prévia ao vivo; salvamento do rascunho neste navegador; restauração do exemplo; exportação de ZIP real contendo `index.html`, `styles.css` e `LEIA-ME.txt`. O cadastro público permanece desconectado.

A URL informada no editor é apenas uma referência local e não é acessada. O rascunho não sincroniza entre dispositivos. O conteúdo demonstrativo e os planos propostos não representam um serviço de produção. Não há pagamentos ou publicação.

## Verificação

REA verificou a renderização desktop e a sequência móvel de menu, FAQ, editor, alteração de título, salvamento e acionamento da exportação, sem eventos de console ou erros de página nas capturas locais. A persistência após salvar e recarregar foi confirmada no navegador. O REA cancela downloads por projeto; o ZIP foi validado separadamente pela função real de geração em Node e descompactação com .NET, conferindo arquivos e conteúdo UTF-8.

Consulte `ANALISE.md` para IDs de evidência e limites. Em `referencias/` estão as imagens `original-desktop.png`, `original-mobile.png`, `jutsoclone-desktop.png` e `jutsoclone-mobile.png`, além do registro móvel dos testes locais.

## Integrações pendentes

Autenticação de produção, captura de sites remotos, pagamentos e hospedagem exigem implementação de servidor e conectores, provedores e credenciais. Contatos e documentos legais dependem de informações do responsável pela marca. Os contratos de produção em `INTEGRACOES.md` são propostas; somente os endpoints locais `/api/demo/*` estão ativos.

Não há integração com serviços privados do site de referência. Não foram reaproveitados logotipos, depoimentos ou imagens exclusivas da referência.
