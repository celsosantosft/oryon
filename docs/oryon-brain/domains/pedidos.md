# Pedidos e Orçamentos

- Preserve the numeric tracking code when an approved quote becomes an order. Never silently substitute another order number.
- A converted quote must leave operational quote lists and must not appear as ordinary quote history.
- Portal lookup must accept the complete code or only its numeric portion when the record exists.
- Order and quote submissions must be idempotent from the user's perspective: repeated clicks must not create duplicates.
- Modal forms close only through an intentional backdrop click or the close control, not because the pointer was dragged outside.
- Operational views must use real database records and show explicit errors when loading fails.
- A ficha de produção deve usar a grade e a lista nominal atuais do pedido. Na impressão, o layout vem primeiro e os nomes/números ficam compactos abaixo, agrupados por tamanho, priorizando uma única folha A4.
- As rotas oficiais `/portal` usam a experiência mobile aprovada; `/portal-preview` permanece disponível para comparação e é a única que exibe o selo de teste.
- O Google Agenda é opcional e configurado por instalação em `Entregas da Semana`. Somente pedidos gerados criam eventos; orçamentos não criam.
- Administradores podem cadastrar as credenciais OAuth do Google no próprio painel; o Client Secret fica criptografado no servidor e nunca volta ao navegador.
- O OAuth usa somente `calendar.app.created`: o Oryon cria e administra a agenda secundária `Entregas Oryon`, sem acesso às demais agendas da conta.
- Cada pedido ativo possui no máximo um evento entre 07:00 e 08:00 na data de entrega, com o cliente antes do número no título e link direto para seu portal. Alterações atualizam esse evento, enquanto entrega, cancelamento, exclusão ou reversão para orçamento o removem.
- Os lembretes do calendário aceitam de um a cinco dias únicos entre 0 e 28, com padrão `7, 5, 3, 1, 0`. Falhas do Google nunca devem bloquear a operação do pedido.
