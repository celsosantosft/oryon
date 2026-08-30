const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
require('./config/env').loadEnv();
const { appConfig } = require('./config/appConfig');
const { appPaths } = require('./config/paths');
const {
    getPasswordArg,
    resolveMaintenanceDatabasePath,
    shouldResetExistingAdminPassword
} = require('./utils/adminMaintenance');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@atos.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || getPasswordArg(process.argv.slice(2));
const ADMIN_NAME = appConfig.adminName;
const ADMIN_ROLE = 'admin';
const SHOULD_RESET_PASSWORD = shouldResetExistingAdminPassword(process.argv.slice(2), process.env);

if (!ADMIN_PASSWORD) {
    console.error('Informe a senha com ADMIN_PASSWORD=... ou rode: node diagnose_admin.js novaSenhaSegura');
    process.exit(1);
}

const databasePath = resolveMaintenanceDatabasePath(appPaths);

const db = new sqlite3.Database(databasePath, (err) => {
    if (err) {
        console.error('Erro ao conectar ao banco de dados:', err.message);
        return;
    }
    console.log(`Conectado ao banco de dados SQLite para diagnóstico: ${databasePath}`);
    checkOrCreateAdmin();
});

async function checkOrCreateAdmin() {
    db.get('SELECT * FROM users WHERE email = ?', [ADMIN_EMAIL], async (err, user) => {
        if (err) {
            console.error('Erro ao consultar usuário:', err.message);
            db.close();
            return;
        }

        if (user) {
            console.log(`✅ Usuário Admin (${ADMIN_EMAIL}) encontrado no DB. Nome: ${user.name}.`);
            if (!SHOULD_RESET_PASSWORD) {
                console.log('Senha preservada. Use --reset ou RESET_ADMIN_PASSWORD=true para trocar a senha do admin.');
                db.close();
                return;
            }

            const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
            db.run('UPDATE users SET password = ?, name = ?, role = ? WHERE email = ?',
                [hashedPassword, ADMIN_NAME, ADMIN_ROLE, ADMIN_EMAIL],
                function (err) {
                    if (err) {
                        console.error('Erro ao resetar senha do Admin:', err.message);
                    } else {
                        console.log('🔒 Senha do Admin resetada com a senha informada.');
                    }
                    db.close();
                }
            );
            return;
        }

        console.log(`❌ Usuário Admin (${ADMIN_EMAIL}) NÃO ENCONTRADO. Criando agora...`);
        const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
        
        const stmt = db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)');
        
        stmt.run(ADMIN_NAME, ADMIN_EMAIL, hashedPassword, ADMIN_ROLE, function (err) {
            if (err) {
                console.error('Erro ao criar novo Admin:', err.message);
            } else {
                console.log(`🎉 Novo usuário Admin criado com sucesso! ID: ${this.lastID}`);
            }
            db.close();
        });
        stmt.finalize();
    });
}
