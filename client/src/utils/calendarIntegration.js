export function normalizeCalendarReminderInputs(values) {
    if (!Array.isArray(values)) throw new Error('Informe de 1 a 5 lembretes.');
    const normalized = [...new Set(values.map(Number))];
    if (normalized.length < 1 || normalized.length > 5) throw new Error('Informe de 1 a 5 lembretes.');
    if (normalized.some(value => !Number.isInteger(value) || value < 0 || value > 28)) {
        throw new Error('Use dias inteiros entre 0 e 28.');
    }
    return normalized.sort((a, b) => b - a);
}

export function getCalendarConnectionTone(integration) {
    if (!integration?.configured) return 'neutral';
    if (integration.health === 'reconnect_required' || integration.health === 'failed' || Number(integration.failed_count) > 0) return 'danger';
    if (Number(integration.pending_count) > 0) return 'warning';
    return 'success';
}

export function isCalendarAdministrator(role) {
    return String(role || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, '_') === 'admin';
}
