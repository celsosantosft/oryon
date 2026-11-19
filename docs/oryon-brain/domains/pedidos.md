# Pedidos e Orçamentos

- Meta: só pedidos com origem `meta_ads` enviam `Purchase`, após o primeiro sinal pago, com o valor total em BRL uma vez por pedido. Indicação, cliente antigo, orgânico e loja/outros não são enviados; origem desconhecida aguarda classificação. Parcelas e pedidos históricos não geram novos envios. Ver `docs/meta-purchase-on-deposit.md`.
- `Como o cliente chegou?` fica junto ao WhatsApp na criação/edição de pedidos, com padrão `unknown`. Escolhas explícitas são respeitadas; só um clique real e recente (últimos sete dias), de uma conversa sem ambiguidade, pode preencher a origem desconhecida automaticamente ao salvar. Telefone, sozinho, nunca prova origem de anúncio.

- Preserve the numeric tracking code when an approved quote becomes an order. Never silently substitute another order number.
- A converted quote must leave operational quote lists and must not appear as ordinary quote history.
- Portal lookup must accept the complete code or only its numeric portion when the record exists.
- Order and quote submissions must be idempotent from the user's perspective: repeated clicks must not create duplicates.
- Modal forms close only through an intentional backdrop click or the close control, not because the pointer was dragged outside.
- Operational views must use real database records and show explicit errors when loading fails.
- A ficha de produção deve usar a grade e a lista nominal atuais do pedido. Na impressão, o layout vem primeiro e os nomes/números ficam compactos abaixo, agrupados por tamanho, priorizando uma única folha A4.
- Ao abrir um pedido no Kanban de Produção, o modal deve exibir o layout anexado sem ocultar a grade de tamanhos.
- As rotas oficiais `/portal` usam a experiência mobile aprovada; `/portal-preview` permanece disponível para comparação e é a única que exibe o selo de teste.
- No portal do cliente, a aba Grade é somente para visualização. Quando a lista estiver liberada, o cliente pode adicionar camisas e alterar tamanhos pela aba Nomes; o envio dessa lista atualiza a grade e os valores do pedido.
- Em Detalhes do Pedido e Detalhes do Orçamento, `Portal` abre o acesso privado e `Link` copia a página segura de compartilhamento para o WhatsApp; ambos usam a URL retornada pela API autenticada, nunca montam o token a partir da listagem.
- Links do portal gerados pelo sistema usam uma página segura de compartilhamento para o WhatsApp: a prévia identifica o cliente e o pedido, mostra o layout com a logo pequena da instalação e redireciona ao portal autenticado; sem imagem raster, usa a marca como fallback.
- A rota oficial `/orders` usa a experiência aprovada em telas abaixo de 1000 px e mantém a tabela clássica no desktop. `/orders-preview` continua acessível para conferir a experiência aprovada em qualquer largura. O tema segue a empresa (Atos azul e PD monocromático).
- A rota oficial `/quotes` segue a mesma experiência mobile aprovada de Pedidos abaixo de 1000 px, com cartões, ações identificadas e abas roláveis; `/quotes-preview` força essa visualização para conferência. O desktop clássico e o tema de cada empresa permanecem preservados.
- O Google Agenda é opcional e configurado por instalação em `Entregas da Semana`. Somente pedidos gerados criam eventos; orçamentos não criam.
- Contas a Receber não exibe saldos pendentes de pedidos cancelados ou com arte arquivada, mas preserva recebimentos já pagos no histórico. A baixa em lote é sempre integral; baixas parciais continuam sendo feitas individualmente.
- Administradores podem cadastrar as credenciais OAuth do Google no próprio painel; o Client Secret fica criptografado no servidor e nunca volta ao navegador.
- O OAuth usa somente `calendar.app.created`: o Oryon cria e administra a agenda secundária `Entregas Oryon`, sem acesso às demais agendas da conta.
- Cada pedido ativo possui no máximo um evento entre 07:00 e 08:00 na data de entrega, com o cliente antes do número no título e link direto para seu portal. Alterações atualizam esse evento, enquanto entrega, cancelamento, exclusão ou reversão para orçamento o removem.
- Os lembretes do calendário aceitam de um a cinco dias únicos entre 0 e 28, com padrão `7, 5, 3, 1, 0`. Falhas do Google nunca devem bloquear a operação do pedido.
