# Compras na Meta após o primeiro sinal

O primeiro sinal pago confirma a venda. Enviar um `Purchase` por pedido, com
o valor total calculado pelo ERP em BRL. Parcelas seguintes não geram outra
compra. Outro pedido do mesmo cliente gera outra compra. `Lead` continua
reservado à qualificação do contato.

## Funcionamento

`metaPurchaseSync` instala uma fila SQLite e gatilhos antes de o servidor aceitar
requisições. Acompanha criação/edição do sinal e receitas financeiras inseridas
ou alteradas para `Pago`, incluindo baixa parcial. Pagamento e entrada na fila
são atômicos: reverter a transação também reverte o enfileiramento.

Na primeira ativação, pedidos que já têm sinal ou receita paga são marcados
`historical`. Não há envio retroativo. Essa marcação ocorre uma única vez,
preservando entradas pendentes nos reinícios.

A cada 15 segundos, processa até 20 entradas com as credenciais Meta existentes.
Telefone/e-mail são normalizados e enviados com SHA-256. O ID inclui tenant e
pedido; payload, valor e data permanecem estáveis nos reenvios após falha.
Eventos com mais de sete dias ficam para revisão, sem adulterar a data.
Só há sucesso quando `events_received` confirma o recebimento.

Pedidos cancelados, removidos ou sem pagamento são descartados antes do envio.
Contato inválido e falhas de conexão permitem nova tentativa. Erros armazenam
somente códigos seguros, sem o objeto Axios que contém token e contato.

## Acompanhamento e publicação

O painel WhatsApp mostra compras e estados de envio. A consulta autenticada
`GET /api/whatsapp/meta/purchases` usa os cargos autorizados do módulo e não
expõe token, hashes ou contatos. Excluir o histórico de leads não apaga compras.

O evento usa `action_source: chat`. Não inventa `ctwa_clid`, WABA ou outros
identificadores de anúncio ausentes na integração atual. Aceitação pela API
não comprova atribuição nem habilita, por si só, otimização para compras em
campanhas de mensagens. É necessário validar separadamente a vinculação do
conjunto de dados e as opções de otimização disponíveis na conta.

Após publicação, conferir inicialização e painel; validar o próximo sinal real
no Gerenciador de Eventos, sem vendas fictícias nem reenvio de setembro.
`META_TEST_EVENT_CODE`, quando presente, é respeitado e sinalizado no painel.

Testes: `node --test test/meta-purchase-sync.test.js test/meta-purchase-startup.test.js`
no diretório `server`; compilação do cliente via Vite.
