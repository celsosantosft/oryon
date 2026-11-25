const settlementDay = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Fortaleza', year: 'numeric', month: '2-digit', day: '2-digit'
});

export const financeDay = (date = new Date()) => settlementDay.format(date);

// Keep an unacknowledged request across retries and reloads of this tab.
export function seriesRequestId(storage, slot, entries) {
    const signature = JSON.stringify(entries);
    const previous = JSON.parse(storage.getItem(slot) || 'null');
    if (previous?.signature === signature) return previous.id;
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    const id = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
    storage.setItem(slot, JSON.stringify({ signature, id }));
    return id;
}
