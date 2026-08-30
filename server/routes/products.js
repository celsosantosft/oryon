const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken, authorizeRole } = require('../middlewares/auth');

// --- CONSUMO PADRÃO ---
const DEFAULT_SIZE_CONSUMPTION = [
    { tamanho: '2 anos', consumo_metros: 0.40 }, { tamanho: '4 anos', consumo_metros: 0.45 },
    { tamanho: '6 anos', consumo_metros: 0.50 }, { tamanho: '8 anos', consumo_metros: 0.55 },
    { tamanho: '10 anos', consumo_metros: 0.60 }, { tamanho: '12 anos', consumo_metros: 0.65 },
    { tamanho: '14 anos', consumo_metros: 0.70 }, { tamanho: 'PP', consumo_metros: 0.80 },
    { tamanho: 'P', consumo_metros: 0.90 }, { tamanho: 'M', consumo_metros: 1.00 },
    { tamanho: 'G', consumo_metros: 1.20 }, { tamanho: 'GG', consumo_metros: 1.35 },
    { tamanho: 'XG', consumo_metros: 1.50 }, { tamanho: 'XXG', consumo_metros: 1.70 },
    { tamanho: 'XXXG', consumo_metros: 1.90 }, { tamanho: 'ESPECIAL', consumo_metros: 2.10 }
];

function parseStringArray(value) {
    if (Array.isArray(value)) {
        return value
            .map((item) => String(item || '').trim())
            .filter(Boolean);
    }

    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
                return parsed
                    .map((item) => String(item || '').trim())
                    .filter(Boolean);
            }
        } catch (error) {
            return value
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean);
        }
    }

    return [];
}

function normalizeProductRow(product) {
    return {
        ...product,
        printing_types_json: parseStringArray(product.printing_types_json)
    };
}

function insertProductConsumption(productId, consumptionArray, res, successMsg) {
    const consumptions = Array.isArray(consumptionArray) && consumptionArray.length > 0 ? consumptionArray : DEFAULT_SIZE_CONSUMPTION;
    let pending = consumptions.length;
    if (pending === 0) return res.status(201).json({ message: successMsg, id: productId });
    
    let erro = false;
    consumptions.forEach(item => {
        db.run(`INSERT INTO product_consumption (product_id, tamanho, consumo_metros) VALUES (?, ?, ?)`,
            [productId, item.tamanho, parseFloat(item.consumo_metros) || 0],
            err => {
                if (erro) return;
                if (err) { erro = true; return res.status(500).json({ error: "Erro ao salvar consumo." }); }
                pending--;
                if (pending === 0 && !erro) res.status(201).json({ message: successMsg, id: productId });
            });
    });
}

// --- ROTAS DE TECIDOS ---
router.post('/api/fabrics', authenticateToken, authorizeRole(['admin', 'gerente', 'gerente_producao', 'gerente_vendas', 'gerente_operacoes']), (req, res) => {
    const { name, description } = req.body;
    if (!name || name.trim() === '') return res.status(400).json({ error: "Nome do tecido é obrigatório." });
    db.run(`INSERT INTO fabrics (name, description) VALUES (?, ?)`, [name.trim(), description || null], function (err) {
        if (err) return res.status(500).json({ error: "Erro ao criar tecido." });
        res.status(201).json({ message: "Tecido criado com sucesso!", id: this.lastID });
    });
});
router.get('/api/fabrics', authenticateToken, (req, res) => {
    db.all(`SELECT * FROM fabrics ORDER BY name ASC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ fabrics: rows });
    });
});
router.put('/api/fabrics/:id', authenticateToken, authorizeRole(['admin', 'gerente', 'gerente_producao', 'gerente_vendas', 'gerente_operacoes']), (req, res) => {
    db.run(`UPDATE fabrics SET name=?, description=? WHERE id=?`, [req.body.name.trim(), req.body.description || null, req.params.id], (err) => {
        if (err) return res.status(500).json({ error: "Erro ao atualizar tecido." });
        res.json({ message: "Tecido atualizado com sucesso!" });
    });
});
router.delete('/api/fabrics/:id', authenticateToken, authorizeRole(['admin', 'gerente', 'gerente_producao', 'gerente_vendas', 'gerente_operacoes']), (req, res) => {
    db.run(`DELETE FROM fabrics WHERE id=?`, [req.params.id], err => {
        if (err) return res.status(500).json({ error: "Erro ao excluir tecido." });
        res.json({ message: "Tecido excluído!" });
    });
});

// --- ROTAS DE ROLOS DE MALHA ---
router.post('/api/fabric-rolls', authenticateToken, authorizeRole(['admin', 'gerente', 'gerente_producao', 'gerente_vendas', 'gerente_operacoes']), (req, res) => {
    const { descricao_tecido, tipo_tecido, largura_metros, metros_total, custo_total, fornecedor, data_entrada } = req.body;
    const metros = parseFloat(metros_total) || 0;
    const custo = parseFloat(custo_total) || 0;
    const custo_por_metro = metros > 0 ? custo / metros : 0;
    db.run(`INSERT INTO fabric_rolls (descricao_tecido, tipo_tecido, largura_metros, metros_total, metros_disponivel, custo_total, custo_por_metro, fornecedor, data_entrada) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [descricao_tecido, tipo_tecido, largura_metros, metros, metros, custo, custo_por_metro, fornecedor, data_entrada], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ message: 'Rolo de malha cadastrado!', id: this.lastID });
        });
});
router.get('/api/fabric-rolls', authenticateToken, authorizeRole(['admin', 'gerente', 'gerente_producao', 'gerente_vendas', 'gerente_operacoes']), (req, res) => {
    const search = req.query.search || '';
    let sql = `SELECT * FROM fabric_rolls`;
    let params = [];
    if (search) {
        sql += ` WHERE descricao_tecido LIKE ? OR fornecedor LIKE ? OR tipo_tecido LIKE ?`;
        params = [`%${search}%`, `%${search}%`, `%${search}%`];
    }
    db.all(sql + ` ORDER BY data_entrada ASC`, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ rolls: rows });
    });
});
router.delete('/api/fabric-rolls/:id', authenticateToken, authorizeRole(['admin', 'gerente', 'gerente_producao', 'gerente_vendas', 'gerente_operacoes']), (req, res) => {
    db.run(`DELETE FROM fabric_rolls WHERE id = ?`, [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Rolo excluído.' });
    });
});

// --- ROTAS DE PRODUTOS ---
router.post('/api/products', authenticateToken, authorizeRole(['admin', 'gerente', 'gerente_producao', 'gerente_vendas', 'gerente_operacoes']), (req, res) => {
    let { name, type_peca, type_gola, printing_types_json, production_cost, sale_price, margem_lucro, supplier, production_days, observations, tecido_principal_id, consumption, category, size, color, current_stock, min_stock } = req.body;
    if (!name) return res.status(400).json({ error: "Nome do produto é obrigatório." });
    if (!type_peca && category) type_peca = category;
    const normalizedPrintingTypes = parseStringArray(printing_types_json);
    
    db.run(`INSERT INTO products (name, category, size, color, production_cost, sale_price, current_stock, min_stock, supplier, production_days, observations, type_peca, type_gola, printing_types_json, margem_lucro, tecido_principal_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [name, type_peca || category || "geral", size || null, color || null, production_cost ? parseFloat(production_cost) : null, sale_price ? parseFloat(sale_price) : null, current_stock ? parseInt(current_stock) : 0, min_stock ? parseInt(min_stock) : 0, supplier || null, production_days ? parseInt(production_days) : null, observations || null, type_peca || null, type_gola || null, JSON.stringify(normalizedPrintingTypes), margem_lucro ? parseFloat(margem_lucro) : null, tecido_principal_id || null],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            insertProductConsumption(this.lastID, consumption, res, "Produto criado com sucesso!");
        });
});

router.get('/api/products', authenticateToken, (req, res) => {
    const search = req.query.search || "";
    let sql = `SELECT * FROM products`;
    let params = [];
    if (search) {
        sql += ` WHERE name LIKE ? OR category LIKE ? OR supplier LIKE ? OR type_peca LIKE ? OR printing_types_json LIKE ?`;
        params = [`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`];
    }
    db.all(sql + ` ORDER BY name ASC`, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ products: rows.map(normalizeProductRow) });
    });
});

router.get('/api/products/:id', authenticateToken, (req, res) => {
    db.get(`SELECT * FROM products WHERE id=?`, [req.params.id], (err, product) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!product) return res.status(404).json({ error: "Produto não encontrado." });
        db.all(`SELECT tamanho, consumo_metros FROM product_consumption WHERE product_id=? ORDER BY id ASC`, [req.params.id], (err2, rows) => {
            if (err2) return res.status(500).json({ error: err2.message });
            res.json({ product: normalizeProductRow(product), consumption: rows.length > 0 ? rows : DEFAULT_SIZE_CONSUMPTION });
        });
    });
});

router.put('/api/products/:id', authenticateToken, authorizeRole(['admin', 'gerente', 'gerente_producao', 'gerente_vendas', 'gerente_operacoes']), (req, res) => {
    let { name, type_peca, type_gola, printing_types_json, production_cost, sale_price, margem_lucro, supplier, production_days, observations, tecido_principal_id, consumption, category, size, color, current_stock, min_stock } = req.body;
    if (!name) return res.status(400).json({ error: "Nome é obrigatório." });
    const normalizedPrintingTypes = parseStringArray(printing_types_json);
    db.run(`UPDATE products SET name=?, category=?, size=?, color=?, production_cost=?, sale_price=?, current_stock=?, min_stock=?, supplier=?, production_days=?, observations=?, type_peca=?, type_gola=?, printing_types_json=?, margem_lucro=?, tecido_principal_id=? WHERE id=?`,
        [name, type_peca || category || "geral", size, color, production_cost ? parseFloat(production_cost) : null, sale_price ? parseFloat(sale_price) : null, current_stock, min_stock, supplier, production_days, observations, type_peca, type_gola || null, JSON.stringify(normalizedPrintingTypes), margem_lucro, tecido_principal_id, req.params.id],
        err => {
            if (err) return res.status(500).json({ error: err.message });
            db.run(`DELETE FROM product_consumption WHERE product_id=?`, [req.params.id], err2 => {
                if (err2) return res.status(500).json({ error: err2.message });
                insertProductConsumption(req.params.id, consumption, res, "Produto atualizado!");
            });
        });
});

router.delete('/api/products/:id', authenticateToken, authorizeRole(['admin', 'gerente', 'gerente_producao', 'gerente_vendas', 'gerente_operacoes']), (req, res) => {
    db.run(`DELETE FROM product_consumption WHERE product_id=?`, [req.params.id], () => {
        db.run(`DELETE FROM products WHERE id=?`, [req.params.id], err => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "Produto removido." });
        });
    });
});

module.exports = router;
