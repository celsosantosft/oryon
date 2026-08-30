const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
require('./config/env').loadEnv();
const { appPaths } = require('./config/paths');
const { resolveMaintenanceDatabasePath } = require('./utils/adminMaintenance');

const [, , emailArg, passwordArg] = process.argv;

const email = String(emailArg || '').trim().toLowerCase();
const newPassword = String(passwordArg || '').trim();

if (!email || !newPassword) {
    console.error('Uso: node reset_user_password.js email@dominio.com novaSenha');
    process.exit(1);
}

const databasePath = resolveMaintenanceDatabasePath(appPaths);

const db = new sqlite3.Database(databasePath, (err) => {
    if (err) {
        console.error('Erro ao conectar ao SQLite:', err.message);
        process.exit(1);
    }

    resetPassword();
});

async function resetPassword() {
    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        db.run(
            `UPDATE users SET password = ? WHERE LOWER(email) = LOWER(?)`,
            [hashedPassword, email],
            function(err) {
                if (err) {
                    console.error('Erro ao atualizar senha:', err.message);
                    return finish(1);
                }

                if (this.changes === 0) {
                    console.error(`Usuário não encontrado: ${email}`);
                    return finish(1);
                }

                console.log(`Senha atualizada com sucesso para ${email}.`);
                finish(0);
            }
        );
    } catch (error) {
        console.error('Erro ao gerar senha:', error.message);
        finish(1);
    }
}

function finish(code) {
    db.close(() => process.exit(code));
}
