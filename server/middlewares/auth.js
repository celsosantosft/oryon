const jwt = require('jsonwebtoken');
const crypto = require('crypto');

function resolveJwtSecret() {
    if (process.env.JWT_SECRET) return process.env.JWT_SECRET;

    if (process.env.NODE_ENV === 'production') {
        throw new Error('JWT_SECRET é obrigatório em produção.');
    }

    console.warn('JWT_SECRET não definido. Usando segredo temporário apenas para desenvolvimento local.');
    return crypto.randomBytes(32).toString('hex');
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

    return normalizedAllowedRoles.includes(normalizedUserRole)
        || (normalizedAllowedRoles.includes('gerente') && normalizedUserRole.startsWith('gerente_'));
}

// Middleware que verifica se o usuário está logado
function authenticateToken(req, res, next) {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ message: "Token não enviado." });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: "Token inválido." });
        req.user = user;
        next();
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

module.exports = { authenticateToken, authorizeRole, JWT_SECRET };
