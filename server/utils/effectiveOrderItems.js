function newestItemTimestamp(items = []) {
    return items.reduce((latest, item) => {
        const timestamp = String(item?.created_at || '');
        return timestamp > latest ? timestamp : latest;
    }, '');
}

function chooseEffectiveOrderItems(orderItems = [], quoteItems = []) {
    if (quoteItems.length === 0) return orderItems;
    if (orderItems.length === 0) return quoteItems;

    return newestItemTimestamp(quoteItems) > newestItemTimestamp(orderItems)
        ? quoteItems
        : orderItems;
}

module.exports = { chooseEffectiveOrderItems };
