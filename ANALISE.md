# Análise e evidências — Jutsoclone

A reconstrução usa a estrutura e os comportamentos observáveis da referência como orientação, com identidade Jutsoclone e implementação própria. A análise distingue divulgação pública, navegação autenticada autorizada, captura renderizada de teste e funcionalidades efetivamente implementadas. Nenhuma etapa recuperou banco de dados, código privado ou lógica de servidor da origem.

## Evidências públicas iniciais do REA

Inspeção inicial de `https://clonuxy.com/`, em desktop e celular:

- Desktop 1440 × 1000: Evidence ID `ev_cb34d15cd2ab4edbcee25102e3b9f29ec2c07a814041b2e9de232cdaca63bd80`.
- Mobile 390 × 844: Evidence ID `ev_c90e32816cc56541704d7cd840c151f4b4466f6800314a87be82c0d0edb42162`.
- Planos e alternância da FAQ: Evidence ID `ev_4a3e722bab0e062fc81b116d7b574cbe65f2956da8cd0acd2e2479e9981c8356`.
- Menus e páginas públicas de conta: Evidence ID `ev_7aa4942729f03c1cd66fbd1dc95ba5a2ca2bd72d9b7b6941a112975a094201ba`. Essa sessão registrou incompletude de eventos; não comprova ausência de erros ou cobertura integral da rede.

As capturas iniciais contêm DOM, acessibilidade, imagens e eventos de rede de seus próprios cenários. O estado `complete` significa que a captura solicitada terminou; não demonstra cobertura de todo o produto. Os testes públicos iniciais não enviaram formulários nem fizeram compras.

A apresentação observada usa cabeçalho fixo, hero, demonstração de editor, etapas, recursos, comparação, planos, FAQ e chamada final. O CSS público usa fundo quase preto, branco, texto cinza-azulado e destaques violeta/fúcsia, largura próxima de 1200 px, cartões arredondados e gradientes. Foram declaradas Inter, Space Grotesk e JetBrains Mono. Há adaptações em 960 e 720 px, menu móvel e preferência por movimento reduzido. A identidade própria da Jutsoclone usa outra paleta.

Menu móvel, revelação de seções, animações ilustrativas e FAQ foram observáveis no JavaScript público. As animações da apresentação não comprovam captura ou compactação de páginas reais. Promessas comerciais e depoimentos ilustrativos não foram tratados como prova de clientes, pagamento ou desempenho.

## Área autenticada autorizada

O usuário autorizou acesso à conta e um único clone de teste de página própria. A inspeção mostrou projetos, criação, editor em abas e restrições por plano. A interface informou consumo de uma das duas unidades disponíveis. Exportação paga, domínios e indicações não foram comprovados por esse teste e nenhuma compra foi feita.

A referência gerou um link automaticamente ao criar o projeto de teste. Isso descreve o comportamento observado; não comprova sua implementação interna nem autoriza publicação automática na Jutsoclone. A implementação própria exige confirmação separada para publicar. Credenciais, endereço privado do projeto e identificadores de conta ou indicação não são incluídos nesta documentação.

## Inspeção adicional do alvo autorizado

As chamadas ao MCP REA conectado excederam o tempo de espera, incluindo uma espera de 450 segundos. Foi usado o REA real pela CLI como alternativa. O registro local de trabalho é `work/rea-offer-current.json`, com Evidence ID `ev_f0cb50df3185f562d7f88e27a1fba5014e5f3eb00f83386c2b0bfb9b9fa7026e`, em viewport móvel 390 × 844.

Essa evidência corresponde ao alvo autorizado de teste e não à recuperação de código privado. O arquivo completo e o conteúdo comercial/de cliente desse alvo permanecem fora do repositório público; não são redistribuídos como assets da Jutsoclone.

A observação do DOM e dos atributos públicos identificou FAQ, abertura/fechamento de modal de compra, popup de presente, botões de checkout, favoritos, galeria com etapas e seleção visual de kits. Foram usados apenas esses sinais observáveis para criar novos handlers; o JavaScript e o rastreamento originais não foram transplantados. O fluxo de compra final não foi acionado. Não foi verificada lógica de preço, pagamento ou tratamento de pedidos no servidor original.

## Captura e migração próprias

A implementação agora renderiza a página pública em um navegador isolado: Chrome oficial via Playwright no Windows e `@sparticuz/chromium` com Playwright em Linux/Netlify. As requisições passam pelo transporte controlado do servidor, com validação de URLs/DNS/redirecionamentos, bloqueio de redes privadas e limites de tempo, requisições e bytes. Isso permite capturar DOM produzido por JavaScript público; não fornece cookies ou credenciais da origem nem transfere suas contas ou serviços privados.

No ensaio real do alvo autorizado, a captura gerou aproximadamente 2,17 MB de HTML, com 18 recursos incorporados. A inspeção contou 26 das 27 imagens com conteúdo incorporado, incluindo PNG/WebP; fontes também foram incorporadas. Um recurso SVG permaneceu externo; marcação SVG presente no DOM passa pela sanitização. Restaram recursos externos e avisos: esses números descrevem esse ensaio, não uma garantia de incorporação total de qualquer site. Vídeos, folhas, fontes ou imagens incompatíveis podem continuar dependentes da origem.

Após renderizar, o sistema remove scripts originais e atributos de eventos ativos, desativa formulários e sanitiza o HTML. Handlers públicos reconhecidos viram marcadores seguros para o runtime próprio. Scripts de rastreamento e pixels da origem não são restaurados automaticamente, e não há integração de pixels de conversão configurada. Isso não constitui uma auditoria de todo recurso externo nem garantia de funcionamento offline.

Projetos têm até 20 páginas, 4 MB de HTML por página e 10 MB no conjunto. O corpo JSON aceita até 5,5 MB. Metadados sem HTML são retornados com `?meta=1`; o HTML da página selecionada é obtido separadamente. O editor permite edição e substituição de URLs em várias páginas. A exportação contém todas as páginas e reescreve links internos reconhecidos.

O runtime próprio suporta `details`, âncoras, controles de vídeo, acordeões com `aria-controls`/`aria-expanded` e marcadores reconhecidos de FAQ, modal, presente, checkout, favorito e navegação de slides. No padrão de produto observado, suporta `#productCarouselTrack`, seleção visual `.kit-btn[data-qty][data-price]`, swipe e zoom do exemplo. Seletores e marcadores são uma compatibilidade delimitada: não reproduzem JavaScript arbitrário, integrações privadas, autenticação ou sistemas de pedidos.

Checkout exige URL própria configurada. Sem ela, os botões de compra identificados ficam indisponíveis. Selecionar um kit altera o estado visual e, quando encontrado, o preço no modal; não define parâmetros de quantidade do provedor de pagamento. O retorno é um link explícito configurado pelo proprietário. Pagamento e clique final de compra não foram testados.

## Verificações e pendências

Nesta etapa, o encerramento dos testes registrou 32 verificações automatizadas aprovadas e um teste separado aprovado com Chrome real. A cobertura inclui autenticação, isolamento entre contas, persistência, páginas, configurações, captura/rede controlada, sanitização, ZIP, links migrados e ciclo de publicação/revogação com fixtures próprias. Isso não equivale a uma auditoria completa de segurança, acessibilidade ou compatibilidade de todos os sites.

A publicação salva snapshot independente, usa token aleatório e exige confirmação do usuário. Publicar novamente revoga o token anterior; há API de revogação. Páginas publicadas usam CSP com sandbox, scripts próprios autorizados por nonce e sem permissão de mesma origem. Nenhuma publicação real do alvo foi efetuada nesta etapa.

Os testes anteriores da apresentação e do editor demonstrativo pertencem à versão anterior. A versão hospedada anterior teve login, sessão e edição verificados; a nova versão com renderização, múltiplas páginas e publicação ainda aguarda verificação no deploy final. Testes locais e uma captura REA de referência não comprovam entrega online da nova versão.

Continuam pendentes: confirmação/recuperação de e-mail, cobrança/assinaturas, domínio personalizado, indicações, pixels de conversão e compatibilidade adicional com interações fora dos seletores implementados. Não houve acesso a backend privado, contorno de autenticação ou compra no site de referência.
