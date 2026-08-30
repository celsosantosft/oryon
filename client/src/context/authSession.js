export const AUTH_NOTICE_KEY = 'auth_notice';
export const AUTH_API_BASE_URL_KEY = 'auth_api_base_url';
export const SESSION_EXPIRED_MESSAGE = 'Sua sessão expirou. Faça login novamente.';
export const INACTIVITY_EXPIRED_MESSAGE = 'Sua sessão expirou por segurança. Entre novamente.';
export const GENERIC_AUTH_NOTICE_MESSAGE = 'Sua sessão foi encerrada. Entre novamente.';
export const LAST_ACTIVITY_KEY = 'auth_last_activity';
export const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000;

const DEFAULT_LOGIN_ERROR_MESSAGE = 'E-mail ou senha incorretos.';
const OBJECT_OBJECT_MESSAGE = '[object object]';

export const normalizeAuthNotice = (notice) => (
    typeof notice === 'string'
        && notice.trim()
        && notice.trim().toLowerCase() !== OBJECT_OBJECT_MESSAGE
        ? notice.trim()
        : GENERIC_AUTH_NOTICE_MESSAGE
);

export const getLoginErrorMessage = (message) => {
    if (typeof message !== 'string') {
        return DEFAULT_LOGIN_ERROR_MESSAGE;
    }

    const trimmedMessage = message.trim();
    const normalizedMessage = trimmedMessage.toLowerCase();

    if (
        !normalizedMessage
        || normalizedMessage === 'inválido'
        || normalizedMessage === 'invalido'
        || normalizedMessage === OBJECT_OBJECT_MESSAGE
    ) {
        return DEFAULT_LOGIN_ERROR_MESSAGE;
    }

    return trimmedMessage;
};

export const isInactiveSessionExpired = (
    lastActivityTime,
    currentTime = Date.now(),
    timeoutMs = INACTIVITY_TIMEOUT_MS
) => (
    Number.isFinite(lastActivityTime)
    && Number.isFinite(currentTime)
    && currentTime - lastActivityTime >= timeoutMs
);

export const handleSessionActivity = ({
    event,
    lastActivityTime,
    currentTime = Date.now(),
    timeoutMs = INACTIVITY_TIMEOUT_MS,
    onExpired,
    onActive
}) => {
    if (isInactiveSessionExpired(lastActivityTime, currentTime, timeoutMs)) {
        if (event?.cancelable) {
            event.preventDefault();
        }
        event?.stopImmediatePropagation?.();
        onExpired?.();
        return true;
    }

    onActive?.();
    return false;
};
