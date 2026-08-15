const express = require('express');
const db = require('../database');
const { authenticateToken, authorizeRole } = require('../middlewares/auth');

const router = express.Router();

const STATUS_PEDIDO_REVERTIDO = 'Cancelado';
const STATUS_ORCAMENTO_REVERTIDO = 'Em Análise';
const STATUS_PRODUCAO_BLOQUEADA = new Set([
    'Corte Iniciado',
    'Impressão/Estampa Iniciada',
    'Costura Iniciada',
    'Controle de Qualidade',
    'Pronto para Envio',
    'Entregue/Concluído'
]);

function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
    });
}

function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) return reject(err);
            resolve({ changes: this.changes, lastID: this.lastID });
        });
    });
}

function createUserError(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

async function reverterPedidoParaOrcamento({ orderId, userId }) {
    let transactionStarted = false;

    try {
        const safeOrderId = Number(orderId);
        const safeUserId = Number.isInteger(Number(userId)) ? Number(userId) : null;

        if (!Number.isInteger(safeOrderId) || safeOrderId <= 0) {
            throw createUserError('Pedido invalido para reversao.', 400);
        }

        await dbRun('BEGIN IMMEDIATE TRANSACTION');
        transactionStarted = true;

        const order = await dbGet(
            `
                SELECT id, tracking_code, quote_id, status, client_name
                FROM orders
                WHERE id = ?
            `,
            [safeOrderId]
        );

        if (!order) {
            throw createUserError('Pedido nao encontrado.', 404);
        }

        if (!order.quote_id) {
            throw createUserError('Este pedido nao possui orcamento vinculado para reversao.', 400);
        }

        if (STATUS_PRODUCAO_BLOQUEADA.has(order.status)) {
            throw createUserError('Pedido ja entrou em producao e nao pode ser revertido automaticamente.', 409);
        }

        const quote = await dbGet(
            `
                SELECT id, tracking_code, status
                FROM quotes
                WHERE id = ?
            `,
            [order.quote_id]
        );

        if (!quote) {
            throw createUserError('Orcamento original nao encontrado.', 404);
        }

        await dbRun(
            `
                UPDATE quotes
                SET status = ?,
                    is_locked_by_client = 0
                WHERE id = ?
            `,
            [STATUS_ORCAMENTO_REVERTIDO, quote.id]
        );

        await dbRun(
            `
                UPDATE orders
                SET status = ?,
                    quote_id = NULL,
                    board_order = 999999
                WHERE id = ?
            `,
            [STATUS_PEDIDO_REVERTIDO, order.id]
        );

        await dbRun(
            `
                UPDATE transactions
                SET status = 'Cancelado',
                    amount = 0,
                    payment_date = NULL,
                    description = CASE
                        WHEN description LIKE '%Revertido para orcamento%' THEN description
                        ELSE description || ' | Revertido para orcamento. Valor original: R$ ' || printf('%.2f', amount)
                    END
                WHERE order_id = ?
                  AND type = 'Receita'
                  AND (
                      description LIKE 'Sinal/Pago - Pedido %'
                      OR description LIKE 'Falta Pagar - Pedido %'
                  )
            `,
            [order.id]
        );

        await dbRun(
            `
                INSERT INTO order_history (order_id, status_text, changed_by_user_id)
                VALUES (?, ?, ?)
            `,
            [order.id, 'Pedido revertido para orcamento', safeUserId]
        );

        await dbRun(
            `
                INSERT INTO quote_history (quote_id, status_text, changed_by_user_id)
                VALUES (?, ?, ?)
            `,
            [quote.id, 'Pedido vinculado foi revertido para orcamento', safeUserId]
        );

        await dbRun(
            `
                INSERT INTO notifications (target_role, title, message)
                VALUES (?, ?, ?)
            `,
            [
                'designer',
                'Pedido revertido para orcamento',
                `O pedido ${order.tracking_code} voltou para orcamento ${quote.tracking_code}.`
            ]
        );

        await dbRun('COMMIT');
        transactionStarted = false;

        return {
            message: 'Pedido revertido para orcamento com sucesso.',
            order_id: order.id,
            order_tracking_code: order.tracking_code,
            order_status: STATUS_PEDIDO_REVERTIDO,
            quote_id: quote.id,
            quote_tracking_code: quote.tracking_code,
            quote_status: STATUS_ORCAMENTO_REVERTIDO
        };
    } catch (error) {
        if (transactionStarted) {
            try {
                await dbRun('ROLLBACK');
            } catch (rollbackError) {
                console.error('Erro ao desfazer reversao de pedido para orcamento:', rollbackError.message);
            }
        }

        throw error;
    }
}

router.post(
    '/orders/:id/reverter-para-orcamento',
    authenticateToken,
    authorizeRole(['admin', 'gerente']),
    async (req, res) => {
        try {
            const result = await reverterPedidoParaOrcamento({
                orderId: req.params.id,
                userId: req.user?.id
            });

            res.json(result);
        } catch (error) {
            console.error('Erro ao reverter pedido para orcamento:', error.message);
            res.status(error.statusCode || 500).json({
                error: error.statusCode
                    ? error.message
                    : 'Nao foi possivel reverter o pedido para orcamento agora.'
            });
        }
    }
);

module.exports = {
    router,
    reverterPedidoParaOrcamento
};
