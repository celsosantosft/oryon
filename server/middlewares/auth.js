const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('../database');

const DEV_JWT_SECRET_PATH = path.join(__dirname, '..', '.dev-jwt-secret');

function resolveJwtSecret() {
    if (process.env.JWT_SECRET) return process.env.JWT_SECRET;

    if (process.env.NODE_ENV === 'production') {
        throw new Error('JWT_SECRET é obrigatório em produção.');
    }

    try {
        if (fs.existsSync(DEV_JWT_SECRET_PATH)) {
            const savedSecret = fs.readFileSync(DEV_JWT_SECRET_PATH, 'utf8').trim();
            if (savedSecret) return savedSecret;
        }

        const generatedSecret = crypto.randomBytes(32).toString('hex');
        fs.writeFileSync(DEV_JWT_SECRET_PATH, generatedSecret, { mode: 0o600 });
        console.warn('JWT_SECRET não definido. Gerado segredo persistente para desenvolvimento local.');
        return generatedSecret;
    } catch (error) {
        console.warn('JWT_SECRET não definido. Usando segredo temporário apenas para esta execução local.', error.message);
        return crypto.randomBytes(32).toString('hex');
    }
}

const JWT_SECRET = resolveJwtSecret();

function normalizeRole(role) {
    return String(role || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '_');
}

function roleIsAllowed(userRole, allowedRoles) {
    const normalizedUserRole = normalizeRole(userRole);
    const normalizedAllowedRoles = allowedRoles.map(normalizeRole);

    return normalizedAllowedRoles.includes(normalizedUserRole);
}

// Middleware que verifica se o usuário está logado
function authenticateToken(req, res, next) {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ message: "Token não enviado." });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: "Token inválido." });

        db.get(`SELECT id, name, email, role FROM users WHERE id = ?`, [user.id], (dbErr, currentUser) => {
            if (dbErr) return res.status(500).json({ message: "Erro ao validar usuário." });
            if (!currentUser) return res.status(403).json({ message: "Token inválido." });

            req.user = {
                id: currentUser.id,
                name: currentUser.name,
                email: currentUser.email,
                role: currentUser.role
            };
            next();
        });
    });
}

// Middleware que verifica se o cargo tem permissão para a ação
function authorizeRole(roles) {
    return (req, res, next) => {
        if (!roleIsAllowed(req.user.role, roles)) {
            return res.status(403).json({ message: "Sem permissão." });
        }
        next();
    };
}

module.exports = { authenticateToken, authorizeRole, JWT_SECRET, normalizeRole, roleIsAllowed };
