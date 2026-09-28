const DEFAULT_REMINDER_DAYS = Object.freeze([7, 5, 3, 1, 0]);

function normalizeReminderDays(values) {
    if (!Array.isArray(values)) throw new Error('Informe de 1 a 5 lembretes.');
    const normalized = [...new Set(values.map(Number))];
    if (normalized.length < 1 || normalized.length > 5) throw new Error('Informe de 1 a 5 lembretes.');
    if (normalized.some(value => !Number.isInteger(value) || value < 0 || value > 28)) {
        throw new Error('Os lembretes devem ser dias inteiros entre 0 e 28.');
    }
    return normalized.sort((a, b) => b - a);
}

module.exports = { DEFAULT_REMINDER_DAYS, normalizeReminderDays };
