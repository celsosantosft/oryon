# Compras na Meta após o primeiro sinal

O primeiro sinal pago confirma a venda. Enviar um `Purchase` por pedido, com
origem `meta_ads` e o valor total calculado pelo ERP em BRL. Parcelas seguintes não geram outra
compra. Outro pedido do mesmo cliente gera outra compra. `Lead` continua
reservado à qualificação do contato.

## Origem do pedido

Na criação/edição, `Como o cliente chegou?` oferece anúncio (`meta_ads`),
orgânico (`social_organic`), indicação (`referral`), cliente antigo
(`returning_customer`), loja/outros (`store_other`) e não identificado (`unknown`,
padrão inclusive para registros antigos). O backend valida a seleção.
Telefone sozinho não define origem. Um clique CTWA real nos últimos sete dias
pode preencher uma origem desconhecida ao salvar, somente com conversa única;
uma escolha explícita diferente de anúncio nunca é sobrescrita.

A fila confere a origem antes de qualquer POST, incluindo tentativas antigas:
`unknown` fica `awaiting_source`; demais origens ficam `not_meta`. Selecionar
anúncio em pedido pago ainda pendente libera a tentativa original, preservando
o horário do pagamento. Registros históricos, já enviados ou com recebimento
incerto não são liberados para reenvio por mudar a origem.

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

Sem configuração de mensagens, o evento usa `action_source: chat`. Não inventa
`ctwa_clid`, WABA ou outros identificadores de anúncio. Aceitação pela API
não comprova atribuição nem habilita, por si só, otimização para compras em
campanhas de mensagens. É necessário validar separadamente a vinculação do
conjunto de dados e as opções de otimização disponíveis na conta.

Após publicação, conferir inicialização e painel; validar o próximo sinal real
no Gerenciador de Eventos, sem vendas fictícias nem reenvio de setembro.
`META_TEST_EVENT_CODE`, quando presente, é respeitado e sinalizado no painel.

Testes: `node --test test/meta-purchase-sync.test.js test/meta-purchase-startup.test.js`
no diretório `server`; compilação do cliente via Vite.

## Conversões de WhatsApp (ativação explícita)

Configure no servidor `META_MESSAGING_DATASET_ID` (dataset vinculado à WABA),
`META_WHATSAPP_BUSINESS_ACCOUNT_ID`, `META_PAGE_ID` e um token com as permissões
de eventos de WhatsApp. Use `META_QUALIFIED_LEAD_EVENT_NAME=QualifiedLead`.
Não substitua esses IDs pelo número de telefone nem reutilize um pixel sem
validar sua vinculação no Gerenciador de Eventos. Mantenha `META_PIXEL_ID` para
compras do ERP sem origem de mensagens comprovada.

Pedidos criados ou editados localizam a conversa pelo WhatsApp informado,
considerando a convenção de número com/sem nono dígito já usada no Oryon.
Dois contatos candidatos tornam o vínculo ambíguo: o sistema não escolhe um
cliente arbitrariamente. A fila verifica o vínculo novamente antes do envio.
Nenhuma mensagem é enviada ao cliente por essa vinculação.

O webhook leve preserva somente metadados de contato/clique em registros
`conversion_signal`, sem copiar texto, mídia, chave da Evolution ou webhook
inteiro para esses registros. A captura é idempotente por conversa/clique.
Não é necessário carregar o histórico completo de conversas.

Leads usam a conversa identificada. Compras só usam `business_messaging` quando
o pedido está vinculado a uma única conversa com mensagem recebida antes do
pagamento. Sem esse vínculo, preservam o envio anterior de compras do ERP.
O código consulta o payload já armazenado e usa o `ctwa_clid` real quando existir,
ignorando mensagens de outros contatos, mensagens enviadas e conteúdo citado.
Sem clique, envia hashes de contato com `page_id` e WABA, conforme o caminho
de correspondência por contato da Meta. Correspondência não é garantida e tem
restrições de país e janela; nunca é apresentada como atribuição confirmada.

Eventos congelados antes da ativação não são convertidos para outro tipo de
evento no reenvio. Não reenvie o histórico para tentar alimentar a campanha.
Uma credencial carregada não comprova autorização: valide um próximo evento
real no dataset correto e verifique diagnósticos e atribuição separadamente.

Leads agora exigem `events_received=1`, preservam ID, horário e payload em
tentativas seguintes e suprimem duplicação entre etiqueta e envio manual da
mesma conversa. Eventos antigos não recebem uma data falsa para reenvio.
Erros não retornam o payload bruto da Meta nem credenciais.
Em conversões de mensagens, timeout, erro de servidor ou resposta sem confirmação
de recebimento deixam o envio em revisão; não são repetidos automaticamente,
pois a API de mensagens não garante deduplicação. Confira o Gerenciador de
Eventos antes de liberar qualquer reenvio. A troca de Lead para QualifiedLead
não libera automaticamente contatos já qualificados para novo envio.

Referência: https://developers.facebook.com/documentation/ads-commerce/conversions-api/business-messaging
