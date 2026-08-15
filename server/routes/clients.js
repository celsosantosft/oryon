const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken, authorizeRole } = require('../middlewares/auth');

// Criar Cliente
router.post('/api/clients', authenticateToken, (req, res) => {
    const { name, phone, email, address, document, cep, segment } = req.body;
    if (!name) return res.status(400).json({ error: "Nome é obrigatório." });
    
    db.run(`INSERT INTO clients (name, phone, email, address, document, cep, segment) VALUES (?, ?, ?, ?, ?, ?, ?)`, 
        [name, phone, email, address, document, cep, segment], 
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ message: 'Cliente cadastrado!', id: this.lastID });
        }
    );
});

// Listar Clientes
router.get('/api/clients', authenticateToken, (req, res) => {
    const search = req.query.search || '';
    let sql = `SELECT * FROM clients`;
    let params = [];
    if (search) {
        sql += ` WHERE name LIKE ?`;
        params.push(`%${search}%`);
    }
    sql += ` ORDER BY name ASC`;
    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ clients: rows });
    });
});

// Atualizar Cliente
router.put('/api/clients/:id', authenticateToken, (req, res) => {
    const { name, phone, email, address, document, cep, segment } = req.body;
    db.run(`UPDATE clients SET name=?, phone=?, email=?, address=?, document=?, cep=?, segment=? WHERE id=?`, 
        [name, phone, email, address, document, cep, segment, req.params.id], 
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Cliente atualizado.' });
        }
    );
});

// Excluir Cliente
router.delete('/api/clients/:id', authenticateToken, authorizeRole(['admin', 'gerente']), (req, res) => {
    db.run(`DELETE FROM clients WHERE id=?`, [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Cliente excluído.' });
    });
});

module.exports = router;