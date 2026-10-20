# Análise pública e decisões — Jutsoclone

Inspeção em 20/10/2026 de https://clonuxy.com/, com REA e navegador Chromium 155.0.8059.85. O projeto adapta a hierarquia e os padrões observáveis à identidade Jutsoclone, com textos e elementos visuais próprios.

## Evidências REA

- Desktop, 1440 × 1000: `rea-desktop.json`, Evidence ID `ev_cb34d15cd2ab4edbcee25102e3b9f29ec2c07a814041b2e9de232cdaca63bd80`.
- Mobile, 390 × 844: `rea-mobile.json`, Evidence ID `ev_c90e32816cc56541704d7cd840c151f4b4466f6800314a87be82c0d0edb42162`.

As duas capturas contêm DOM, árvore de acessibilidade, screenshot, URL e eventos de rede. Os cenários básicos carregaram a página inicial e aguardaram sua renderização; não enviaram formulários nem realizaram compras. A indicação `complete` do REA descreve a completude da captura solicitada, não a cobertura de todo o produto.

## Observado no DOM e nos estilos públicos

A página inicial contém navegação fixa, apresentação principal com dois caminhos de ação, demonstração visual de um editor, sequência em três etapas, grade de recursos, comparação de abordagens, três opções comerciais, área explicitamente ilustrativa de depoimentos, perguntas frequentes, chamada final e rodapé. Os links de conta apontam para `/login` e `/register`, com parâmetros de plano em algumas chamadas. Alguns links institucionais do rodapé apontam apenas para `#`.

A referência usa fundo quase preto (`#050507`), branco para títulos, cinza azulado para texto secundário e violeta/fúcsia para destaque. O CSS declara Inter para texto e títulos principais, Space Grotesk para títulos de componentes e JetBrains Mono para exemplos técnicos. O conteúdo fica limitado a 1200 px, com seções amplas, cartões arredondados, bordas translúcidas, gradientes e luzes difusas. Títulos principais têm peso alto, caixa alta e itálico. Estes valores descrevem a referência; a implementação Jutsoclone usa uma identidade própria.

O JavaScript entregue publicamente inclui menu móvel, alteração do cabeçalho ao rolar, revelação de seções com IntersectionObserver, efeito de luz ao mover o ponteiro, faixa contínua, digitação automática e barras de progresso demonstrativas. A FAQ alterna um painel por vez e atualiza `aria-expanded`. O próprio código da apresentação produz as animações de captura e compactação; elas não provam processamento real de uma URL.

O CSS público contém adaptações abaixo de 960 e 720 px: menu recolhido, cartões em uma coluna, rodapé reorganizado, botões principais largos, barra lateral da ilustração escondida e redução de espaçamentos. Existe também regra para reduzir movimentos conforme a preferência do sistema. A captura mobile comprova acesso e renderização nesse tamanho; o teste de cada interação móvel deve ser registrado à parte.

A rede da captura inicial mostra carregamento do documento, fontes públicas do Google, ícone da marca e telemetria Cloudflare. Não foi observado um pedido de captura de páginas remotas nesse cenário. Corpos de requisições e respostas não foram retidos.

## Hipóteses e limites

A apresentação sugere um produto com projetos, edição visual, exportação, contas, planos e publicação. A eficácia dessas operações, as permissões por plano e o processamento de pagamento não são comprovados pela página de divulgação. Sua implementação interna, banco de dados e lógica privada não foram recuperados.

Não foram usados acessos restritos nem contornados controles de acesso. Além da página inicial, os formulários públicos de `/login` e `/register` foram inspecionados sem envio. Nenhuma área autenticada foi acessada. As promessas de fidelidade de captura e os depoimentos ilustrativos não foram tratados como evidência operacional ou clientes reais.

## Reconstrução própria

A versão Jutsoclone preserva a leitura por apresentação, demonstração, etapas, recursos, opções de uso e FAQ. A demonstração local edita conteúdo de exemplo e exporta um ZIP real com HTML, CSS e LEIA-ME; não oferece clonagem remota, pagamento, login ou hospedagem de produção. Dados da marca ficam centralizados em `brand.config.js`. Os valores comerciais, quando demonstrativos, devem estar identificados como tal.

## Verificação complementar

Desktop local, 1440 × 1000: Evidence ID `ev_199c2160f12fc627c20b6f8606acdb90e07ac15bea55d5bf5d770d88861f5e63`. Renderização capturada sem eventos de console ou erros de página.

Mobile local, 390 × 844: `referencias/testes-mobile-rea.json`, Evidence ID `ev_6c661c3397eb3318833876a46bac27844b98ba28c696f912ddf7e1f9559993a4`. Menu, âncora da FAQ, abertura de pergunta, navegação ao editor, edição do título, salvamento e acionamento da exportação concluíram seus passos sem eventos de console ou erros de página. Isso cobre esse fluxo, não todos os caminhos possíveis.

O navegador confirmou persistência do rascunho após salvar e recarregar. O REA cancela downloads por projeto; o teste móvel comprova o acionamento do botão, não a conclusão de download. A função real de geração do ZIP foi executada em Node e o resultado descompactado com .NET: `index.html`, `styles.css` e `LEIA-ME.txt` tiveram conteúdo idêntico ao esperado, incluindo UTF-8.

Referências visuais estão em `referencias/original-desktop.png`, `referencias/original-mobile.png`, `referencias/jutsoclone-desktop.png` e `referencias/jutsoclone-mobile.png`. Nenhuma aprovação de produção ou publicação está implícita nesta análise.

## Interações públicas adicionais da referência

Evidence ID `ev_4a3e722bab0e062fc81b116d7b574cbe65f2956da8cd0acd2e2479e9981c8356`: navegação pela âncora de planos e abertura da segunda pergunta da FAQ concluídas. A captura final mostra a primeira pergunta fechada e a segunda aberta. A reconstrução usa o agrupamento nativo `details name="faq"` para preservar esse comportamento. Recortes de todas as evidências originais estão em `referencias/evidencias-originais-rea.json`; imagens são representadas ali por hash e tamanho.

Validações adicionais da aplicação, verificadas pelo navegador: bloqueio de formulário vazio, rejeição de e-mail sem `@`, mensagem de serviço desconectado após dados válidos e remoção do rascunho ao restaurar o exemplo. A interface possui rótulos nos campos, foco visível, link de pular ao conteúdo, menu com estado expandido e preferência por movimento reduzido. Não foi realizada auditoria completa com leitor de tela.

Evidence ID `ev_7aa4942729f03c1cd66fbd1dc95ba5a2ca2bd72d9b7b6941a112975a094201ba`, registro `rea-interactions.json`: passos de menu e acesso às páginas públicas concluídos. `/login` apresenta e-mail e senha; `/register` apresenta nome, e-mail e senha. Nenhum formulário original foi enviado. A captura tem incompletude de eventos, embora os passos estejam concluídos; por isso não sustenta conclusão de ausência de erros nessa sessão nem cobertura integral da rede.
