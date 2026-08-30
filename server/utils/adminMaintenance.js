function shouldResetExistingAdminPassword(args = [], env = process.env) {
    if (String(env.RESET_ADMIN_PASSWORD || '').trim().toLowerCase() === 'true') {
        return true;
    }

    return args.includes('--reset');
}

function getPasswordArg(args = []) {
    return args.find((arg) => arg !== '--reset') || '';
}

function resolveMaintenanceDatabasePath(appPaths) {
    if (!appPaths?.databasePath) {
        throw new Error('databasePath não configurado.');
    }

    return appPaths.databasePath;
}

module.exports = {
    getPasswordArg,
    resolveMaintenanceDatabasePath,
    shouldResetExistingAdminPassword
};
