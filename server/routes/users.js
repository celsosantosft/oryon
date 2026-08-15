const express = require('express');
const router = express.Router();
const db = require('../database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticateToken, authorizeRole, JWT_SECRET } = require('../middlewares/auth');

// --- LOGIN (Acesso Público) ---
router.post('/login', (req, res) => {
    const { email, password } = req.body;
    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: 'E-mail ou senha incorretos.' });
        }
        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
        res.status(200).json({ token, user: { id: user.id, name: user.name, role: user.role } });
    });
});

// --- USUÁRIOS ---
router.get('/api/users', authenticateToken, authorizeRole(['admin']), (req, res) => {
    db.all('SELECT id, name, email, role, salary, birth_date, created_at FROM users ORDER BY name ASC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ users: rows });
    });
});

router.post('/api/users', authenticateToken, authorizeRole(['admin']), async (req, res) => { 
    const { name, email, password, role, salary, birth_date } = req.body;
    if (!name || !email || !password || !role) {
        return res.status(400).json({ error: 'Nome, e-mail, senha e cargo são obrigatórios.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    db.run(`INSERT INTO users (name, email, password, role, salary, birth_date) VALUES (?, ?, ?, ?, ?, ?)`, 
        [name, email, hashedPassword, role, salary || null, birth_date || null], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ message: 'Usuário criado.' });
    });
}); 

router.delete('/api/users/:id', authenticateToken, authorizeRole(['admin']), (req, res) => {
    if (parseInt(req.params.id, 10) === req.user.id) {
        return res.status(400).json({ error: 'Você não pode excluir seu próprio usuário.' });
    }

    db.run('DELETE FROM users WHERE id=?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Usuário não encontrado.' });
        res.json({message:'Deletado'});
    });
});

router.put('/api/users/:id', authenticateToken, authorizeRole(['admin']), (req, res) => { 
    const userId = req.params.id;
    const { name, role, salary, birth_date, password } = req.body;
    if (!name || !role) {
        return res.status(400).json({ error: 'Nome e cargo são obrigatórios.' });
    }

    let sql = `UPDATE users SET name=?, role=?, salary=?, birth_date=?`;
    let params = [name, role, salary, birth_date];
    
    if (password) {
        bcrypt.hash(password, 10).then(hashed => {
            sql += `, password=? WHERE id=?`;
            params.push(hashed, userId);
            db.run(sql, params, function(err) {
                if (err) return res.status(500).json({ error: err.message });
                if (this.changes === 0) return res.status(404).json({ error: 'Usuário não encontrado.' });
                res.json({ message: 'Atualizado.' });
            });
        });
    } else {
        sql += ` WHERE id=?`;
        params.push(userId);
        db.run(sql, params, function(err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: 'Usuário não encontrado.' });
            res.json({ message: 'Atualizado.' });
        });
    }
});

// --- NOTIFICAÇÕES (O Motor de Alertas) ---
router.get('/api/notifications', authenticateToken, (req, res) => {
    const role = req.user.role;
    const userId = req.user.id;
    
    db.all(`
        SELECT * FROM notifications 
        WHERE (target_role = ? OR target_role = 'todos' OR user_id = ?) 
        AND is_read = 0
        ORDER BY created_at DESC
    `, [role, userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ notifications: rows });
    });
});

router.put('/api/notifications/:id/read', authenticateToken, (req, res) => {
    db.run(`UPDATE notifications SET is_read = 1 WHERE id = ?`, [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Notificação marcada como lida.' });
    });
});

module.exports = router;
