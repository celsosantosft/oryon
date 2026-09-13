const PLAYER_NUMBER_PATTERN = /^(?:\d{1,6}|√\d{1,5})?$/u;

function normalizePlayerNumber(value) {
    const normalized = String(value ?? '').trim();
    return PLAYER_NUMBER_PATTERN.test(normalized) ? normalized : null;
}

module.exports = { normalizePlayerNumber };
