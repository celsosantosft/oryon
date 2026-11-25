// A single INSERT lets SQLite serialize concurrent runs. Existing installments,
// payment dates, expenses and their audit history must survive a rebuild.
const RESTORE_MISSING_RECEIVABLES_SQL = `
    WITH balances AS (
        SELECT o.id, o.tracking_code, o.client_name, o.delivery_date, o.status,
               ROUND(o.total_price * 100) AS total_cents,
               ROUND(COALESCE(o.amount_paid, 0) * 100) AS deposit_cents,
               SUM(CASE WHEN t.status = 'Pago' AND t.description LIKE 'Sinal/Pago - Pedido %'
                        THEN ROUND(t.amount * 100) ELSE 0 END) AS posted_deposit_cents,
               SUM(CASE WHEN t.status IN ('Pago', 'Pendente', 'Parcial')
                        THEN ROUND(t.amount * 100) ELSE 0 END) AS accounted_cents,
               SUM(CASE WHEN t.status NOT IN ('Pago', 'Pendente', 'Parcial', 'Cancelado')
                        THEN 1 ELSE 0 END) AS unknown_states
        FROM orders o
        LEFT JOIN transactions t ON t.order_id = o.id AND t.type = 'Receita'
        WHERE o.status NOT IN ('Cancelado', 'Arte Arquivada')
          AND NULLIF(o.delivery_date, '') IS NOT NULL
        GROUP BY o.id
    )
    INSERT INTO transactions (description, type, status, amount, due_date, order_id)
    SELECT 'Falta Pagar - Pedido ' || tracking_code || ' - ' || client_name,
           'Receita', 'Pendente', (total_cents - accounted_cents) / 100.0, delivery_date, id
    FROM balances
    WHERE total_cents > accounted_cents
      AND deposit_cents <= posted_deposit_cents
      AND unknown_states = 0
      AND (status <> 'Entregue/Concluído' OR accounted_cents > 0)
`;

module.exports = { RESTORE_MISSING_RECEIVABLES_SQL };
