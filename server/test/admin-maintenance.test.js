const test = require('node:test');
const assert = require('node:assert/strict');

test('admin diagnostic does not reset an existing password unless explicitly requested', () => {
    const { shouldResetExistingAdminPassword } = require('../utils/adminMaintenance');

    assert.equal(shouldResetExistingAdminPassword([], {}), false);
    assert.equal(shouldResetExistingAdminPassword(['novaSenha'], {}), false);
    assert.equal(shouldResetExistingAdminPassword(['--reset', 'novaSenha'], {}), true);
    assert.equal(shouldResetExistingAdminPassword([], { RESET_ADMIN_PASSWORD: 'true' }), true);
});

test('database path resolves from configured app paths instead of the process cwd', () => {
    const { resolveMaintenanceDatabasePath } = require('../utils/adminMaintenance');

    assert.equal(
        resolveMaintenanceDatabasePath({ databasePath: '/var/lib/oryon/cliente/atos.db' }),
        '/var/lib/oryon/cliente/atos.db'
    );
});
