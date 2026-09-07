# Otimizador de enfesto e controle de sobras do Corte PCP

Data: 07/09/2026

## Objetivo

Transformar a selecao de pedidos da tela Corte PCP em um plano de corte operacional, pensado para reduzir o trabalho do cortador e o numero de enfestos. O sistema deve usar somente pedidos reais, respeitar o fio da malha, preencher o risco com producao util e registrar de forma auditavel o que foi atendido, consumido do estoque e produzido como sobra.

O desenho impresso e uma representacao operacional baseada nos envelopes retangulares das modelagens cadastradas. Ele nao afirma ser um encaixe industrial de contorno. Um encaixe preciso por contorno exigira futuramente os moldes reais em SVG ou DXF.

## Regras invariantes

- Nunca criar pedidos, grades ou medidas ficticias.
- Um plano so pode misturar itens com a mesma modelagem e com tecido realmente compativel: malha exata, variacao e cor.
- A navegacao pode continuar agrupada pela malha base, mas a validacao do plano usa o material exato.
- A mesa mede 180 cm de largura por no maximo 280 cm de comprimento.
- Nenhuma modelagem pode ser girada. Largura e altura permanecem na orientacao cadastrada por causa do fio da malha.
- Uma camisa completa usa uma frente, uma costa e duas mangas.
- Frente, costa e manga sao controladas separadamente. Manga e contada por unidade, nao por par.
- Tamanhos ou modelagens sem medidas cadastradas bloqueiam o calculo. O sistema nao estima medidas.
- Gerar ou imprimir o PDF nao altera pedido, estoque, historico ou status.
- Todo efeito permanente ocorre no servidor, dentro de transacao e com protecao contra clique duplicado.

## Fluxo do cortador

1. O cortador seleciona pedidos reais dentro de um mesmo material exato e modelagem.
2. O sistema soma a grade selecionada e consulta as pecas compativeis disponiveis no estoque de corte.
3. Se houver estoque, um SweetAlert mostra a quantidade por tamanho e tipo de peca e pergunta:
   - `Usar pecas do estoque`: desconta essas pecas da necessidade do novo corte.
   - `Cortar tudo novamente`: ignora o estoque neste plano e nao o movimenta.
4. A escolha apenas prepara a simulacao. Nenhuma baixa ocorre nesse momento.
5. O otimizador monta os enfestos, mostra o total solicitado, o que sera atendido pelo estoque, o que sera cortado e todas as sobras previstas.
6. O PDF gera exatamente uma pagina A4 por enfesto, com informacoes e desenho na mesma pagina.
7. Depois do corte real, o cortador aciona `Confirmar enfesto executado`.
8. Um segundo SweetAlert resume os efeitos permanentes e pede confirmacao final.
9. O servidor revalida os pedidos e o estoque. So entao registra o corte, consome estoque, adiciona sobras, atualiza o progresso e avanca pedidos completos.

Se o estoque mudar entre a simulacao e a confirmacao, a API responde com conflito (`409`) e a tela pede para recalcular o plano. Cancelar qualquer popup nao altera dados.

## Estrategia de otimizacao

O otimizador trabalha com repeticoes por camada. Em cada enfesto, o mesmo risco e repetido pela quantidade de camadas informada.

A prioridade da solucao e:

1. Atender toda a necessidade selecionada, considerando o estoque que o usuario escolheu usar.
2. Minimizar o numero de enfestos, pois cada novo enfesto aumenta o trabalho operacional.
3. Priorizar no espaco restante pecas necessarias por outros pedidos ativos e compativeis.
4. Preencher o risco restante com tamanhos que tenham o melhor aproveitamento, mesmo quando isso gerar sobra util.
5. Entre solucoes equivalentes, minimizar consumo total de tecido e quantidade de pecas excedentes sem demanda ativa.

Para cada quantidade candidata de camadas, o planejador calcula quantas frentes, costas e mangas de cada tamanho precisam aparecer no risco. As pecas sao encaixadas sem rotacao dentro de 180 x 280 cm. O calculo pode repetir tamanhos diferentes na mesma folha e pode produzir componentes a mais quando isso reduz enfestos ou completa melhor a folha.

As sobras devem ser explicitadas por tamanho e tipo de peca. A interface tambem pode derivar quantas camisas completas existem na sobra usando:

`min(frentes, costas, floor(mangas / 2))`

## Cenario obrigatorio de aceitacao

Para a grade agregada real:

`PP 6, P 11, M 18, G 12, GG 4`

o primeiro enfesto deve admitir a estrategia validada na operacao:

- 12 camadas.
- Por camada: uma frente e uma costa P; duas frentes e duas costas M; uma frente e uma costa G.
- Por camada: sete mangas no total, distribuidas para atender P, M e G.
- Resultado dos corpos: P 12, M 24 e G 12.
- O excedente de corpos de P e M deve aparecer na contagem de sobras; mangas devem ser contadas separadamente.
- PP e GG seguem em outro enfesto, preenchendo a folha mesmo que o melhor risco produza unidades adicionais para estoque.
- O exemplo completo deve resultar em no maximo dois enfestos e exatamente duas paginas A4.

O teste nao deve depender da ordem acidental dos objetos JavaScript. A mesma entrada deve sempre gerar o mesmo plano.

## PDF operacional

Cada pagina representa um unico enfesto e contem:

- numero do enfesto e numero da pagina;
- pedidos incluidos;
- modelagem, malha exata, variacao e cor;
- quantidade de camadas;
- dimensoes usadas do risco e limite da mesa;
- grade solicitada;
- pecas usadas do estoque, quando aplicavel;
- total produzido pelo enfesto;
- sobras por tamanho, frente, costa e manga;
- quantidade derivada de camisas completas em sobra;
- desenho do risco em escala, sem rotacao.

Nao deve existir uma pagina separada apenas para titulo ou resumo. Cabecalho, resumo e desenho precisam caber na mesma pagina A4. O numero de paginas deve ser igual ao numero de enfestos.

## Persistencia e auditoria

A implementacao sera aditiva, sem apagar nem reinterpretar historicos atuais.

### `corte_planos`

Registra a execucao confirmada de um plano:

- identificador;
- chave de idempotencia unica;
- usuario e data/hora;
- pedidos e linhas de produto selecionados;
- modelagem, malha base, malha exata, variacao e cor;
- snapshot JSON do plano confirmado;
- status da execucao.

### `corte_movimentos_estoque`

Livro-razão imutavel de movimentos. O saldo e a soma das quantidades assinadas, evitando duas fontes de verdade:

- plano de origem;
- pedido e linha de produto, quando houver;
- material exato, cor, modelagem, tamanho e tipo de peca;
- quantidade positiva para entrada e negativa para consumo;
- tipo do movimento (`sobra_corte`, `consumo`, `ajuste`);
- usuario e data/hora.

### `corte_progresso_pedido`

Controla permanentemente o atendimento por linha de produto, tamanho e componente:

- pedido e linha de produto;
- tamanho;
- tipo de peca (`frente`, `costas`, `mangas`);
- quantidade atendida;
- usuario e ultima atualizacao;
- unicidade por linha, tamanho e componente.

A consulta atual de pedidos do corte deve passar a retornar o identificador de `order_product_lines`. A tabela temporaria `corte_progresso` existente nao sera removida nesta entrega; a nova execucao usa o progresso permanente e preserva compatibilidade com os fluxos atuais.

## API e transacao

### Consulta de estoque

Um endpoint autenticado retorna somente o saldo positivo compativel com a modelagem, material exato, variacao e cor do plano.

### Confirmacao do plano

Um endpoint autenticado recebe o snapshot do plano e uma chave de idempotencia. Em uma unica transacao, o servidor:

1. valida permissao, pedidos, linhas de produto, status e compatibilidade do material;
2. valida tamanhos, componentes e quantidades inteiras nao negativas;
3. revalida o estoque escolhido e rejeita saldo insuficiente com `409`;
4. registra o plano uma unica vez;
5. cria movimentos negativos para estoque consumido;
6. cria movimentos positivos para sobras novas;
7. incrementa o progresso permanente dos pedidos;
8. verifica cada linha e cada pedido contra a grade completa;
9. avanca para `Costura Iniciada` apenas os pedidos integralmente atendidos;
10. grava no historico quem concluiu e quando.

Repetir a mesma requisicao com a mesma chave retorna o resultado ja registrado, sem duplicar corte, estoque, historico ou mudanca de status.

O botao atual de concluir um pedido continua funcional. Quando usado fora de um plano, ele registra o atendimento integral da grade daquele pedido, sem sobra, usando a mesma transacao e as mesmas regras de auditoria.

## Integracao com a tela atual

- Manter a busca de pedidos reais ja existente.
- Manter as abas por malha base e os grupos por modelagem.
- Bloquear selecao conjunta quando variacao ou cor forem incompativeis e explicar o motivo.
- Mostrar uma barra fixa e legivel no celular com pedidos selecionados, grade total e acao para calcular.
- Exibir cada enfesto como uma unidade operacional, com camadas, repeticoes por tamanho, pecas produzidas e sobra.
- Usar SweetAlert para escolha de estoque, confirmacao de execucao, sucesso e erros.
- Impedir novos cliques enquanto a confirmacao estiver em andamento.
- Nao criar uma tela separada de administracao de estoque nesta primeira entrega. O saldo necessario aparece dentro do fluxo do Corte PCP.

## Tratamento de falhas

- Falha ao consultar pedidos ou estoque: mostrar erro real e nao fabricar dados.
- Modelagem ou tamanho sem medida: bloquear o plano e listar exatamente o cadastro ausente.
- Plano geometricamente impossivel em 180 x 280 cm: bloquear e identificar as pecas que nao cabem.
- Conflito de estoque: nao fazer movimentacao parcial e solicitar novo calculo.
- Falha de banco ou API: rollback total da transacao.
- Clique duplo ou repeticao por rede: resposta idempotente, sem duplicidade.

## Testes obrigatorios

- Cenario de aceitacao `PP6 P11 M18 G12 GG4` com no maximo dois enfestos.
- Primeiro enfesto com 12 camadas, corpos P1/M2/G1 por camada e sete mangas por camada.
- Cobertura completa da demanda e igualdade contabil:
  `estoque usado + produzido = aplicado aos pedidos + sobra`.
- Nenhuma peca girada e nenhuma peca fora de 180 x 280 cm.
- Resultado deterministico para a mesma entrada.
- Bloqueio de tamanhos e modelagens sem medida.
- Compatibilidade exata de tecido, variacao, cor e modelagem.
- PDF com uma pagina por enfesto e sem pagina de resumo isolada.
- Confirmacao cancelada sem efeitos.
- Idempotencia em clique duplo.
- Conflito de estoque com rollback.
- Pedido parcial permanece no Corte PCP.
- Pedido completo avanca uma unica vez e gera historico com usuario e horario.
- Testes completos do cliente, servidor e build de producao.

## Implantacao segura

- Criar tabelas e indices com operacoes aditivas e `IF NOT EXISTS`.
- Nao alterar nem excluir pedidos, grades ou historicos existentes durante a migracao.
- Preservar as rotas atuais enquanto o novo fluxo e introduzido.
- Entregar primeiro o motor e os testes do cenario real; depois integrar persistencia, interface e PDF.
- Fazer commit e push apenas depois de todos os testes aplicaveis passarem.

## Fora do escopo desta entrega

- Encaixe industrial por contorno de moldes SVG/DXF.
- Giro automatico de qualquer molde.
- Cadastro visual de novas modelagens e medidas.
- Pagina administrativa completa de inventario e ajustes de estoque.
- Mistura de materiais, cores ou modelagens incompativeis no mesmo enfesto.
