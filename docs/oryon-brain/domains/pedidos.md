# Pedidos e Orçamentos

- Preserve the numeric tracking code when an approved quote becomes an order. Never silently substitute another order number.
- A converted quote must leave operational quote lists and must not appear as ordinary quote history.
- Portal lookup must accept the complete code or only its numeric portion when the record exists.
- Order and quote submissions must be idempotent from the user's perspective: repeated clicks must not create duplicates.
- Modal forms close only through an intentional backdrop click or the close control, not because the pointer was dragged outside.
- Operational views must use real database records and show explicit errors when loading fails.
- A ficha de produção deve usar a grade e a lista nominal atuais do pedido. Na impressão, o layout vem primeiro e os nomes/números ficam compactos abaixo, agrupados por tamanho, priorizando uma única folha A4.
