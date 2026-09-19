# Portal do Cliente Mobile - Design de Homologacao

## Objetivo

Melhorar a experiencia mobile do Portal do Cliente sem alterar regras de negocio, contratos da API ou dados de pedidos. A nova interface deve ser operacional, clara e rapida, com uma rota publica de homologacao no sistema real para comparacao antes de substituir o portal oficial.

## Escopo

- Melhorar a entrada do portal, o cabecalho, a navegacao inferior e as cinco abas existentes.
- Preservar rastreio, financeiro, aprovacao de arte, grade e lista nominal.
- Preservar codigos completos, codigos numericos, links com token e mensagens de erro reais.
- Usar somente dados reais retornados pelas APIs existentes.
- Nao adicionar dependencias de interface ou animacao.
- Publicar apenas a rota separada de homologacao, sem substituir o portal oficial.

## Fora do Escopo

- Alterar endpoints, banco de dados, autenticacao por token ou regras de permissao.
- Alterar o fluxo de criacao, edicao ou impressao de pedidos.
- Criar dados de demonstracao, pedidos ficticios ou respostas falsas.
- Redesenhar telas administrativas do Oryon.

## Estrategia de Homologacao

A nova apresentacao sera acessada em `https://atosfardamentos.com.br/portal-preview`. Essa rota mostrara a entrada redesenhada e encaminhara o codigo informado para `/portal-preview/:code`, mantendo o token na URL quando existir.

As rotas de homologacao reutilizarao os mesmos servicos, hooks, componentes de abas e dados reais do portal atual. A diferenca ficara restrita a um modo visual de preview. As rotas oficiais `/portal` e `/portal/:code` continuarao apontando para a interface atual ate a aprovacao do usuario.

O preview sera publicado no mesmo servidor do Oryon para permitir testes em celulares reais. A tela exibira uma identificacao discreta de ambiente de teste. O deploy incluira somente a nova rota e seus estilos/componentes; `/portal` e `/portal/:code` permanecerao na interface atual ate a aprovacao visual.

Como o preview usa a API de producao, consultas e acoes de escrita atuam sobre dados reais. Nao havera dados de demonstracao. A publicacao da rota nao alterara links ja enviados aos clientes nem redirecionara acessos do portal oficial.

## Arquitetura da Interface

### Entrada

- Primeira tela compacta, centralizada e responsiva.
- Campo com `inputMode="numeric"`, sem autocorrecao e com tecla de acao adequada no celular.
- Botao principal com estado imediato de toque e estado de carregamento que nao desloca o layout.
- Erro de codigo invalido exibido de forma clara, restaurando o formulario e o foco sem deixar sobreposicao cinza ativa.
- Aceitar numero, codigo completo ou link completo, usando o parser atual.

### Portal Interno

- Cabecalho compacto com marca, cliente, codigo do pedido e prazo.
- Conteudo em uma coluna com largura maxima preservada no desktop.
- Navegacao inferior fixa com cinco areas de toque estaveis, area segura do dispositivo e estado ativo claro.
- Rotulos permanecem visiveis no celular; nao depender apenas de icones.
- Conteudo principal recebe espaco inferior suficiente para nunca ficar escondido pela navegacao.

### Abas

- Inicio: resumo do pedido, arte e acoes principais com hierarquia mais direta.
- Rastreio: etapa atual em destaque e historico legivel sem animacoes decorativas.
- Financeiro: total, pago e restante com contraste e formatacao existentes.
- Grade: tamanhos e quantidades em controles de toque grandes, sem cartoes aninhados desnecessarios.
- Nomes: formulario e lista agrupada por tamanho, preservando inclusao, edicao, exclusao e confirmacao atuais.

## Sistema Visual

- Manter azul institucional, verde de sucesso, amarelo de atencao e vermelho de erro.
- Reduzir gradientes, vidro, desfoque, sombras grandes e raios excessivos.
- Limitar raios de cartoes a 8px e usar cartoes somente para itens ou ferramentas realmente delimitados.
- Usar espacamento consistente, tipografia sem letter-spacing negativo e titulos proporcionais ao espaco.
- Animacoes apenas para feedback de entrada/saida necessario, abaixo de 300ms, usando `transform` e `opacity`.
- Respeitar `prefers-reduced-motion`.

## Comportamento Mobile

- Atualizar o viewport com `viewport-fit=cover` e `interactive-widget=resizes-content`.
- Usar `100dvh` ou `100svh` conforme a funcao da tela, evitando `100vh` no shell do portal.
- Manter inputs com pelo menos 16px em ponteiro de toque para impedir zoom involuntario.
- Aplicar `touch-action: manipulation` e resposta `:active` nos controles.
- Restringir efeitos `:hover` a dispositivos com mouse e ponteiro preciso.
- Aplicar areas seguras na navegacao fixa e nos modais.
- Manter textos e codigos selecionaveis; desabilitar selecao apenas nos controles.

## Dados e Fluxo

1. O cliente informa o codigo ou cola o link.
2. O parser atual normaliza a entrada.
3. `trackingService` consulta os endpoints atuais.
4. Em sucesso, a rota de preview abre o pedido real no modo de homologacao.
5. As abas recebem o mesmo objeto `order` e os mesmos itens atuais.
6. Inclusoes, edicoes, confirmacoes e aprovacao de arte continuam usando os endpoints atuais.

O preview nao interceptara, duplicara nem transformara dados. Como utiliza dados reais, acoes de escrita continuam reais e devem ser claramente identificadas na interface de homologacao.

## Erros e Estados

- Carregamento ocupa uma area estavel e informa a operacao em andamento.
- Pedido inexistente mostra erro acionavel e permite nova busca.
- Falha de rede nao sera apresentada como codigo invalido; tera mensagem propria para tentar novamente.
- Botoes de envio ficam bloqueados durante requisicoes para impedir repeticao.
- Falhas de salvamento preservam os dados digitados e informam o erro real.

## Arquivos Previstos

- `client/index.html`: viewport e cores do navegador.
- `client/src/App.jsx`: rotas publicas e separadas de homologacao.
- `client/src/pages/PortalHome.jsx`: suporte ao modo de preview sem duplicar regras.
- `client/src/pages/ClientPortal.jsx`: suporte ao modo de preview e estados da interface.
- `client/src/utils/ClientPortalStyles.js`: sistema visual e comportamento mobile do preview.
- Componentes em `client/src/components/tabs/`: apenas os ajustes necessarios de estrutura e classes.
- Testes do portal: cobertura da rota de preview, estados de busca e preservacao das rotas oficiais.

Se a separacao por modo deixar os arquivos atuais mais complexos que a duplicacao controlada, sera criado no maximo um pequeno componente de shell compartilhado. Nao sera criado um novo framework visual.

## Verificacao

- Executar os testes existentes do cliente e do servidor afetados pelo portal.
- Adicionar testes que provem que `/portal` continua oficial e `/portal-preview` permanece separado.
- Testar busca por numero, codigo completo, link com token, erro de pedido e erro de rede.
- Testar visualmente em 390x844, 430x932 e desktop.
- Conferir que nao ha sobreposicao com teclado, navegacao inferior, modais ou areas seguras.
- Publicar somente o preview e validar a URL real pelo celular antes de qualquer substituicao do portal oficial.

## Criterios de Aprovacao

- O portal oficial permanece visual e funcionalmente inalterado durante a homologacao.
- O link publico de preview usa dados reais e nao contem mocks.
- Todas as funcoes atuais continuam disponiveis no preview.
- A interface cabe no celular sem zoom, cortes, textos sobrepostos ou controles escondidos.
- O usuario aprova explicitamente o preview antes da integracao com as rotas oficiais.
