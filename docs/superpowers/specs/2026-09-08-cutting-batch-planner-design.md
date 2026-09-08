# Planejador de enfestos por lotes do Corte PCP

Data: 08/09/2026

Status: aprovado em conversa, aguardando revisao do documento

Este documento substitui as regras de otimizacao e o cenario de aceitacao de
`2026-09-07-cutting-optimizer-surplus-design.md`. As regras de seguranca,
compatibilidade de material, auditoria e ausencia de dados ficticios daquele
documento continuam validas quando nao conflitarem com esta especificacao.

## Objetivo

Gerar um plano de corte operacional a partir dos pedidos reais selecionados,
sem limitar artificialmente a quantidade de enfestos e sem produzir grandes
sobras apenas para reduzir paginas. O cortador escolhe entre economizar malha
ou reduzir trabalho depois de ver o resultado real das duas estrategias.

O plano continua usando os envelopes retangulares das medidas cadastradas.
Ele nao substitui um encaixe industrial por contorno SVG ou DXF.

## Regras invariantes

- Nunca faltar frente, costas ou mangas para atender a grade selecionada.
- Nunca inventar pedidos, grades, medidas ou demanda.
- Nunca girar moldes, porque o fio da malha deve ser preservado.
- Usar mesa de 180 cm de largura e no maximo 280 cm de comprimento.
- Misturar somente pedidos com a mesma modelagem e o mesmo material exato,
  incluindo malha, variacao e cor.
- Uma camisa completa exige uma frente, uma costa e duas mangas.
- Frente, costas e mangas sao contabilizadas como componentes separados.
- Permitir que um tamanho seja dividido entre mais de um enfesto e corte
  avulso. Um tamanho inteiro nao fica preso a um unico risco.
- Permitir que mangas sejam planejadas em um risco diferente dos corpos.
- Um PDF tem exatamente uma pagina A4 por enfesto. Nao criar pagina extra de
  capa ou resumo. A unica excecao e um plano totalmente avulso, que gera uma
  unica folha de instrucoes e nenhum desenho de enfesto.
- Cortes avulsos em retalho aparecem como instrucao no plano, sem fingir que
  sao um enfesto de mesa completa.
- Gerar ou imprimir o plano nao altera pedidos, estoque ou status.

## Fluxo ao gerar

1. O cortador seleciona pedidos reais compativeis.
2. O sistema soma a grade e calcula dois planos completos.
3. Ao clicar em `Gerar PDF`, um SweetAlert apresenta as duas opcoes:
   - `Economizar malha`, selecionada como recomendada;
   - `Reduzir enfestos`.
4. Cada opcao mostra dados calculados, nunca estimativas genericas:
   - quantidade de enfestos e paginas;
   - metragem total dos riscos;
   - quantidade de cortes avulsos em retalho;
   - total de pecas excedentes;
   - excedentes discriminados por tamanho.
5. O cortador escolhe uma estrategia e o PDF correspondente e aberto.
6. Cancelar o popup nao gera PDF e nao altera nenhum dado.

Se uma das estrategias nao conseguir gerar um plano valido, ela fica
indisponivel e o popup explica o motivo. Se nenhuma for valida, o sistema
mostra o erro real e nao imprime.

## Estrategia Economizar malha

Prioridades, nesta ordem:

1. atender integralmente todos os componentes solicitados;
2. minimizar componentes excedentes;
3. minimizar tecido utilizado;
4. minimizar a quantidade de enfestos;
5. minimizar o trabalho de cortes avulsos entre solucoes equivalentes.

Quantidades residuais pequenas podem ir para corte avulso em retalho. Por
exemplo, uma necessidade de `M 51` pode ser atendida por enfestos que produzam
`M 50` e uma camisa M avulsa. O plano deve listar exatamente os componentes
avulsos: uma frente M, uma costa M e duas mangas M.

## Estrategia Reduzir enfestos

Prioridades, nesta ordem:

1. atender integralmente todos os componentes solicitados;
2. minimizar a quantidade de enfestos;
3. minimizar cortes avulsos;
4. minimizar excedentes;
5. minimizar tecido utilizado entre solucoes equivalentes.

Essa estrategia pode completar camadas e produzir excedentes controlados. No
mesmo exemplo `M 51`, ela pode propor `M 60`, deixando nove camisas excedentes,
desde que essa quantidade apareca claramente no popup antes da escolha.

O modo nao pode adicionar moldes aleatorios apenas porque existe espaco livre.
Todo excedente deve resultar da repeticao necessaria de um tamanho realmente
selecionado. Tamanhos sem demanda nunca entram no risco.

## Enfestos, lotes e cortes avulsos

O planejador trabalha por lotes de camadas. Para cada lote, escolhe uma
quantidade de camadas e os componentes que aparecem uma vez no risco. Cada
componente produz uma unidade por camada.

O motor pode:

- atender parte de um tamanho em um lote e o restante em outro;
- misturar tamanhos no mesmo risco quando forem compativeis;
- colocar somente corpos, somente mangas ou ambos no mesmo risco;
- criar um risco posterior com quaisquer componentes ainda faltantes;
- enviar quantidades pequenas para corte avulso em retalho no modo economico.

Nao existe limite fixo de dois enfestos. A quantidade correta e consequencia
da grade, das medidas, da geometria e da estrategia escolhida.

## Transformacao de costas em frente

Para todas as modelagens, um molde de costas pode produzir corpos que serao
divididos depois do corte. Parte das camadas permanece como costas e parte e
transformada em frente pelo cortador. Um molde de frente nao se transforma em
costas.

Exemplo com um molde `COSTAS G` em dez camadas para uma necessidade de cinco
camisas G:

- o corte produz dez corpos G;
- cinco permanecem como costas;
- cinco sao transformados em frente;
- o resultado atende cinco frentes e cinco costas, sem sobra de corpos.

O PDF deve escrever a instrucao dentro ou imediatamente abaixo do molde:

`COSTAS G - 10 CORPOS: MANTER 5 COSTAS / TRANSFORMAR 5 EM FRENTE`

A contabilidade do plano usa o resultado depois da transformacao. Ela nao pode
registrar dez costas e cinco frentes; deve registrar cinco costas e cinco
frentes.

## Planejamento das mangas

Mangas sao calculadas por unidade. Duas mangas do mesmo tamanho sao exigidas
por camisa. Elas podem preencher espacos de um risco de corpos ou formar um
risco separado com mangas e outros componentes faltantes.

O plano deve distinguir claramente:

- mangas solicitadas;
- mangas produzidas;
- mangas aplicadas aos pedidos;
- mangas excedentes.

Uma camisa so e considerada atendida quando possui frente, costas e duas
mangas.

## Exemplo operacional obrigatorio

Para a grade `P 20, M 10, G 5, GG 5`, o planejador deve aceitar uma solucao com
dez camadas e o risco de corpos descrito pelo usuario:

- dois moldes de frente P e dois de costas P, produzindo 20 camisas P;
- um molde de frente M e um de costas M, produzindo 10 camisas M;
- um molde de costas G, dividido em cinco costas e cinco frentes;
- um molde de costas GG, dividido em cinco costas e cinco frentes;
- mangas no mesmo risco quando couberem, ou em outro risco quando nao couberem.

Para a grade real `PP 4, P 40, M 51, G 12, GG 2, XG 1, EXG 1`:

- o motor nao pode produzir 40 frentes EXG para atender uma camisa EXG;
- o tamanho M pode ser dividido, como `M 50` em enfestos e `M 1` avulso;
- no modo reduzir enfestos, `M 60` pode ser oferecido com nove excedentes;
- PP, GG, XG e EXG podem ser combinados em outros riscos ou enviados para
  corte avulso conforme a estrategia;
- as duas alternativas e seus excedentes devem ser calculados antes do popup.

## Estrutura do resultado do planejador

O planejador retorna um resultado por estrategia contendo:

- grade solicitada;
- enfestos com camadas, comprimento usado e posicionamento dos moldes;
- alocacao de cada molde por tamanho e componente;
- transformacoes de costas em frente por molde;
- cortes avulsos por tamanho e componente;
- producao bruta por componente;
- aplicacao aos pedidos;
- excedentes por tamanho e componente;
- total derivado de camisas completas excedentes;
- metricas resumidas para o popup.

As duas estrategias usam a mesma estrutura. Assim, a tela e o PDF nao precisam
conhecer detalhes internos do algoritmo.

## PDF operacional

O formato visual atual aprovado deve ser preservado. Cada pagina representa um
enfesto e contem:

- numero do enfesto e da pagina;
- pedidos selecionados;
- modelagem e material exato;
- quantidade de camadas;
- comprimento do risco e largura da malha;
- desenho sem rotacao;
- instrucoes de transformacao de costas em frente;
- componentes produzidos e aplicados;
- excedentes daquele enfesto.

Os cortes avulsos devem aparecer em uma faixa compacta da ultima pagina, sem
criar uma pagina A4 vazia ou repetir o desenho. Se nao houver enfesto e todo o
plano for avulso, o sistema gera uma unica folha de instrucoes.

## Compatibilidade com o fluxo atual

- Manter a selecao e a soma dos pedidos reais da tela Corte PCP.
- Preservar a separacao atual por nome exato de malha e por modelagem.
- Reutilizar o empacotador sem rotacao e o gerador de impressao existentes.
- Substituir a particao que prende cada tamanho a um unico enfesto.
- Remover o preenchimento guloso que adiciona moldes aleatorios.
- Calcular o plano apenas no cliente nesta entrega; nenhuma nova dependencia e
  necessaria para o algoritmo ou para o popup.
- Qualquer confirmacao posterior de corte continua sujeita as regras de
  transacao, idempotencia e auditoria da especificacao anterior.

## Tratamento de falhas

- Medida ausente: bloquear o calculo e listar modelagem, componente e tamanho.
- Molde que nao cabe em 180 x 280 cm sem giro: bloquear e identificar o molde.
- Pedidos incompativeis: impedir a combinacao antes do calculo.
- Falha ao abrir a janela de impressao: manter a selecao e orientar a liberar o
  popup do navegador.
- Excedente ou corte avulso nunca pode ficar oculto no resumo.
- O planejador deve validar sua propria igualdade contabil antes de liberar o
  PDF:

`produzido = aplicado aos pedidos + excedente`

e

`aplicado aos pedidos = solicitado`, por tamanho e componente.

## Testes obrigatorios

- Grade `P20 M10 G5 GG5` com transformacao parcial de costas em frente.
- Grade `PP4 P40 M51 G12 GG2 XG1 EXG1` sem produzir 40 EXG.
- Plano economico para quantidade residual usando corte avulso.
- Plano de menos enfestos mostrando excedente antes da escolha.
- Nenhum tamanho sem demanda adicionado como preenchimento.
- Divisao do mesmo tamanho entre enfestos diferentes.
- Mangas em risco separado quando nao couberem com os corpos.
- Duas mangas aplicadas para cada camisa atendida.
- Nenhuma falta em qualquer componente.
- Nenhum molde girado ou fora de 180 x 280 cm.
- Resultado deterministico para a mesma entrada.
- Popup cancelado sem abrir impressao ou alterar dados.
- PDF com uma pagina por enfesto.
- Plano somente avulso com uma unica folha de instrucoes.
- Testes atuais da tela, do planejador e da impressao sem regressao.
- Build de producao do cliente.

## Fora do escopo

- Encaixe por contorno real de moldes SVG ou DXF.
- Giro de moldes.
- Mistura de materiais, cores ou modelagens incompativeis.
- Previsao de demanda futura ou criacao de estoque baseada em pedidos nao
  selecionados.
- Alteracao do Kanban, portal ou status apenas por gerar o PDF.
