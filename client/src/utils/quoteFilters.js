export const QUOTE_CONVERTED_STATUS = 'Convertido em Pedido';

export const getVisibleQuoteStatuses = (statuses) => (
    [...new Set(statuses)].filter((status) => status && status !== QUOTE_CONVERTED_STATUS)
);

export const isQuoteVisibleInBoard = (quote) => quote?.status !== QUOTE_CONVERTED_STATUS;
