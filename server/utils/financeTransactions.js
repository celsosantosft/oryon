const ACTIVE_RECEIVABLE_FILTER_SQL = `
    AND NOT (
        t.type = 'Receita'
        AND t.status <> 'Pago'
        AND COALESCE(o.status, '') IN ('Cancelado', 'Arte Arquivada')
    )
`;

function normalizeBatchTransactionIds(ids) {
    if (!Array.isArray(ids)) return [];

    return [...new Set(ids
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0))];
}

module.exports = {
    ACTIVE_RECEIVABLE_FILTER_SQL,
    normalizeBatchTransactionIds
};
