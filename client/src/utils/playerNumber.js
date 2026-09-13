export const PLAYER_NUMBER_MAX_LENGTH = 6;

export const normalizePlayerNumberInput = (value) => {
    const allowed = String(value ?? '').replace(/[^√\d]/gu, '');
    const prefix = allowed.startsWith('√') ? '√' : '';
    const digits = allowed.replace(/√/gu, '');

    return `${prefix}${digits}`.slice(0, PLAYER_NUMBER_MAX_LENGTH);
};

export const isValidPlayerNumber = (value) => /^(?:\d{1,6}|√\d{1,5})?$/u.test(String(value ?? ''));
