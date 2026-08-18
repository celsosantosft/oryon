const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

function generatePortalToken() {
    return crypto.randomBytes(24).toString('base64url');
}

function backfillPortalTokens(tableName) {
    db.all(`SELECT id FROM ${tableName} WHERE portal_token IS NULL OR portal_token = ''`, [], (err, rows) => {
        if (err || !rows) return;

        rows.forEach((row) => {
            db.run(`UPDATE ${tableName} SET portal_token = ? WHERE id = ?`, [generatePortalToken(), row.id]);
        });
    });
}

function safeParseDbJson(jsonString) {
    try {
        if (!jsonString || jsonString === '[object Object]') return {};
        return JSON.parse(jsonString);
    } catch (error) {
        return {};
    }
}

// Conexão com o arquivo do banco
const db = new sqlite3.Database('./atos.db', (err) => {
    if (err) {
        console.error('Erro ao conectar ao SQLite:', err.message);
    } else {
        console.log('✅ Conectado ao banco de dados SQLite.');
        db.run('PRAGMA foreign_keys = ON'); // Ativa relacionamentos (chaves estrangeiras)
        createTables();
    }
});

function createTables() {
    db.serialize(() => {
    // --------------------------------------------------------
    // TABELAS ORIGINAIS DO SISTEMA (MANTIDAS INTACTAS)
    // --------------------------------------------------------
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'costura',
        salary REAL,
        birth_date DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NULL,
        target_role TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`ALTER TABLE clients ADD COLUMN document TEXT`, () => {});
    db.run(`ALTER TABLE clients ADD COLUMN cep TEXT`, () => {});
    db.run(`ALTER TABLE clients ADD COLUMN segment TEXT`, () => {});

    db.run(`CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tracking_code TEXT UNIQUE NOT NULL,
        client_name TEXT NOT NULL,
        product_type TEXT NOT NULL,
        fabric_type TEXT,
        category TEXT NOT NULL,
        sizes_json TEXT NOT NULL,
        total_price REAL NOT NULL,
        cost_price REAL,
        delivery_date DATE,
        status TEXT NOT NULL DEFAULT 'Criação de Arte',
        layout_path TEXT,
        quote_id INTEGER,
        portal_token TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`ALTER TABLE orders ADD COLUMN cor TEXT`, () => {});
    db.run(`ALTER TABLE orders ADD COLUMN tipo_estampa TEXT`, () => {});
    db.run(`ALTER TABLE orders ADD COLUMN data_entrega_arte DATE`, () => {});
    db.run(`ALTER TABLE orders ADD COLUMN observacao TEXT`, () => {});
    db.run(`ALTER TABLE orders ADD COLUMN url_referencia TEXT`, () => {});
    db.run(`ALTER TABLE orders ADD COLUMN created_by_user_id INTEGER`, () => {});
    db.run(`ALTER TABLE orders ADD COLUMN board_order INTEGER DEFAULT 0`, () => {});
    db.run(`ALTER TABLE orders ADD COLUMN discount REAL DEFAULT 0`, () => {});
    db.run(`ALTER TABLE orders ADD COLUMN unit_price REAL DEFAULT 0`, () => {});
    db.run(`ALTER TABLE orders ADD COLUMN unit_cost REAL DEFAULT 0`, () => {});

    // ⭐ NOVAS COLUNAS: MÓDULO DE CAPTAÇÃO DE PEDIDOS ⭐
    db.run(`ALTER TABLE orders ADD COLUMN allowed_sizes TEXT`, () => {}); // Grade de tamanhos liberados (JSON)
    db.run(`ALTER TABLE orders ADD COLUMN allowed_models TEXT`, () => {}); // Modelos liberados (JSON)
    db.run(`ALTER TABLE orders ADD COLUMN is_locked_by_client INTEGER DEFAULT 0`, () => {}); // Trava documental (0 ou 1)
    db.run(`ALTER TABLE orders ADD COLUMN amount_paid REAL DEFAULT 0`, () => {});
    db.run(`ALTER TABLE orders ADD COLUMN client_id INTEGER`, () => {});
    db.run(`ALTER TABLE orders ADD COLUMN client_phone TEXT`, () => {});
    db.run(`ALTER TABLE orders ADD COLUMN portal_token TEXT`, () => {});

    db.run(`CREATE TABLE IF NOT EXISTS whatsapp_order_status_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        tracking_code TEXT NOT NULL,
        phone TEXT NOT NULL,
        old_status TEXT,
        new_status TEXT NOT NULL,
        message TEXT NOT NULL,
        sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        error TEXT,
        UNIQUE(order_id, new_status, phone)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS whatsapp_conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT NOT NULL UNIQUE,
        remote_jid TEXT,
        push_name TEXT,
        client_id INTEGER,
        client_name TEXT,
        assigned_user_id INTEGER,
        status TEXT NOT NULL DEFAULT 'open',
        last_message_text TEXT,
        last_message_at DATETIME,
        unread_count INTEGER NOT NULL DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES clients(id),
        FOREIGN KEY (assigned_user_id) REFERENCES users(id)
    )`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_updated ON whatsapp_conversations(updated_at)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_phone ON whatsapp_conversations(phone)`);

    db.run(`CREATE TABLE IF NOT EXISTS whatsapp_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER NOT NULL,
        provider_message_id TEXT,
        phone TEXT NOT NULL,
        direction TEXT NOT NULL,
        message_type TEXT NOT NULL DEFAULT 'text',
        body TEXT,
        raw_payload TEXT,
        sent_by_user_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(provider_message_id, direction),
        FOREIGN KEY (conversation_id) REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
        FOREIGN KEY (sent_by_user_id) REFERENCES users(id)
    )`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_conversation ON whatsapp_messages(conversation_id, created_at)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_phone ON whatsapp_messages(phone)`);

    db.run(`CREATE TABLE IF NOT EXISTS whatsapp_conversation_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER NOT NULL,
        order_id INTEGER NOT NULL,
        created_by_user_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(conversation_id, order_id),
        FOREIGN KEY (conversation_id) REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by_user_id) REFERENCES users(id)
    )`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_whatsapp_conversation_orders_conversation ON whatsapp_conversation_orders(conversation_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_whatsapp_conversation_orders_order ON whatsapp_conversation_orders(order_id)`);

    db.run(`CREATE TABLE IF NOT EXISTS meta_capi_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL,
        source_id TEXT NOT NULL,
        conversation_id INTEGER,
        client_id INTEGER,
        created_by_user_id INTEGER,
        event_name TEXT NOT NULL,
        event_time INTEGER NOT NULL,
        event_id TEXT,
        email_hash TEXT,
        phone_hash TEXT,
        request_payload TEXT,
        response_payload TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        error TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(source, event_name, source_id),
        FOREIGN KEY (conversation_id) REFERENCES whatsapp_conversations(id) ON DELETE SET NULL,
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    )`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_meta_capi_events_status ON meta_capi_events(status)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_meta_capi_events_conversation ON meta_capi_events(conversation_id)`);

    db.run(`CREATE TABLE IF NOT EXISTS order_product_lines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        sort_order INTEGER DEFAULT 0,
        product_type TEXT NOT NULL,
        production_label TEXT,
        printing_types_json TEXT DEFAULT '[]',
        production_notes TEXT,
        fabric_type TEXT,
        sizes_json TEXT NOT NULL DEFAULT '{}',
        unit_price REAL DEFAULT 0,
        unit_cost REAL DEFAULT 0,
        total_price REAL DEFAULT 0,
        cost_price REAL DEFAULT 0,
        layout_path TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    )`);
    db.run(`ALTER TABLE order_product_lines ADD COLUMN production_label TEXT`, () => {});
    db.run(`ALTER TABLE order_product_lines ADD COLUMN printing_types_json TEXT DEFAULT '[]'`, () => {});
    db.run(`ALTER TABLE order_product_lines ADD COLUMN production_notes TEXT`, () => {});
    db.run(`CREATE INDEX IF NOT EXISTS idx_order_product_lines_order_id ON order_product_lines(order_id)`);

    // ⭐ NOVA TABELA: A LISTA DO CLIENTE ⭐
    db.run(`CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        player_name TEXT NOT NULL,
        player_number TEXT,
        size TEXT,
        model TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    )`);
    db.run(`ALTER TABLE order_items ADD COLUMN reference_type TEXT DEFAULT 'order'`, () => {});

    db.run(`CREATE TABLE IF NOT EXISTS order_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        status_text TEXT NOT NULL,
        changed_by_user_id INTEGER,
        change_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id),
        FOREIGN KEY (changed_by_user_id) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS quotes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tracking_code TEXT UNIQUE NOT NULL,
        client_name TEXT NOT NULL,
        product_type TEXT NOT NULL,
        fabric_type TEXT,
        category TEXT NOT NULL,
        sizes_json TEXT NOT NULL,
        total_price REAL NOT NULL,
        cost_price REAL,
        delivery_date DATE,
        status TEXT NOT NULL DEFAULT 'Em Análise',
        layout_path TEXT,
        portal_token TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`ALTER TABLE quotes ADD COLUMN discount REAL DEFAULT 0`, () => {});
    db.run(`ALTER TABLE quotes ADD COLUMN is_locked_by_client INTEGER DEFAULT 0`, () => {});
    db.run(`ALTER TABLE quotes ADD COLUMN cor TEXT`, () => {});
    db.run(`ALTER TABLE quotes ADD COLUMN tipo_estampa TEXT`, () => {});
    db.run(`ALTER TABLE quotes ADD COLUMN data_entrega_arte DATE`, () => {});
    db.run(`ALTER TABLE quotes ADD COLUMN observacao TEXT`, () => {});
    db.run(`ALTER TABLE quotes ADD COLUMN url_referencia TEXT`, () => {});
    db.run(`ALTER TABLE quotes ADD COLUMN created_by_user_id INTEGER`, () => {});
    db.run(`ALTER TABLE quotes ADD COLUMN board_order INTEGER DEFAULT 0`, () => {});
    db.run(`ALTER TABLE quotes ADD COLUMN unit_price REAL DEFAULT 0`, () => {});
    db.run(`ALTER TABLE quotes ADD COLUMN unit_cost REAL DEFAULT 0`, () => {});
    db.run(`ALTER TABLE quotes ADD COLUMN allowed_sizes TEXT`, () => {});
    db.run(`ALTER TABLE quotes ADD COLUMN allowed_models TEXT`, () => {});
    db.run(`ALTER TABLE quotes ADD COLUMN amount_paid REAL DEFAULT 0`, () => {});
    db.run(`ALTER TABLE quotes ADD COLUMN portal_token TEXT`, () => {});
    db.run(`CREATE INDEX IF NOT EXISTS idx_orders_portal_token ON orders(portal_token)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_quotes_portal_token ON quotes(portal_token)`);
    backfillPortalTokens('orders');
    backfillPortalTokens('quotes');

    db.run(`CREATE TABLE IF NOT EXISTS quote_product_lines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quote_id INTEGER NOT NULL,
        sort_order INTEGER DEFAULT 0,
        product_type TEXT NOT NULL,
        production_label TEXT,
        printing_types_json TEXT DEFAULT '[]',
        production_notes TEXT,
        fabric_type TEXT,
        sizes_json TEXT NOT NULL DEFAULT '{}',
        unit_price REAL DEFAULT 0,
        unit_cost REAL DEFAULT 0,
        total_price REAL DEFAULT 0,
        cost_price REAL DEFAULT 0,
        layout_path TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE
    )`);
    db.run(`ALTER TABLE quote_product_lines ADD COLUMN production_label TEXT`, () => {});
    db.run(`ALTER TABLE quote_product_lines ADD COLUMN printing_types_json TEXT DEFAULT '[]'`, () => {});
    db.run(`ALTER TABLE quote_product_lines ADD COLUMN production_notes TEXT`, () => {});
    db.run(`CREATE INDEX IF NOT EXISTS idx_quote_product_lines_quote_id ON quote_product_lines(quote_id)`);

    db.run(`CREATE TABLE IF NOT EXISTS quote_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quote_id INTEGER NOT NULL,
        status_text TEXT NOT NULL,
        changed_by_user_id INTEGER,
        change_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (quote_id) REFERENCES quotes(id),
        FOREIGN KEY (changed_by_user_id) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS quote_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quote_id INTEGER NOT NULL,
        player_name TEXT NOT NULL,
        player_number TEXT,
        size TEXT,
        model TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE
    )`);

    db.run(`CREATE INDEX IF NOT EXISTS idx_quote_items_quote_id ON quote_items(quote_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_order_items_order_ref ON order_items(order_id, reference_type)`);

    db.run(`
        INSERT INTO quote_items (quote_id, player_name, player_number, size, model, created_at)
        SELECT oi.order_id, oi.player_name, oi.player_number, oi.size, oi.model, COALESCE(oi.created_at, CURRENT_TIMESTAMP)
        FROM order_items oi
        JOIN quotes q ON q.id = oi.order_id
        WHERE oi.reference_type = 'quote'
          AND NOT EXISTS (
              SELECT 1
              FROM quote_items qi
              WHERE qi.quote_id = oi.order_id
                AND COALESCE(qi.player_name, '') = COALESCE(oi.player_name, '')
                AND COALESCE(qi.player_number, '') = COALESCE(oi.player_number, '')
                AND COALESCE(qi.size, '') = COALESCE(oi.size, '')
                AND COALESCE(qi.model, '') = COALESCE(oi.model, '')
          )
    `, () => {});

    db.run(`
        INSERT INTO order_items (order_id, player_name, player_number, size, model, reference_type)
        SELECT o.id, qi.player_name, qi.player_number, qi.size, qi.model, 'order'
        FROM orders o
        JOIN quote_items qi ON qi.quote_id = o.quote_id
        WHERE o.quote_id IS NOT NULL
          AND NOT EXISTS (
              SELECT 1
              FROM order_items oi
              WHERE oi.order_id = o.id
                AND (oi.reference_type = 'order' OR oi.reference_type IS NULL)
          )
    `, () => {});

    db.run(`
        UPDATE orders
        SET is_locked_by_client = 1
        WHERE quote_id IN (SELECT id FROM quotes WHERE is_locked_by_client = 1)
          AND EXISTS (
              SELECT 1
              FROM order_items oi
              WHERE oi.order_id = orders.id
                AND (oi.reference_type = 'order' OR oi.reference_type IS NULL)
          )
    `, () => {});

    db.all(`
        SELECT
            o.id,
            o.product_type,
            o.fabric_type,
            o.sizes_json,
            o.total_price,
            o.cost_price,
            o.layout_path,
            COALESCE(o.unit_price, 0) AS unit_price,
            COALESCE(o.unit_cost, 0) AS unit_cost
        FROM orders o
        WHERE NOT EXISTS (
            SELECT 1 FROM order_product_lines opl WHERE opl.order_id = o.id
        )
    `, [], (migrateErr, rows) => {
        if (migrateErr || !rows) return;

        rows.forEach((row) => {
            const sizes = safeParseDbJson(row.sizes_json);
            const totalQty = Object.values(sizes).reduce((sum, value) => sum + (Number(value) || 0), 0);
            const derivedUnitPrice = Number(row.unit_price || 0) > 0
                ? Number(row.unit_price || 0)
                : (totalQty > 0 ? Number(row.total_price || 0) / totalQty : 0);
            const derivedUnitCost = Number(row.unit_cost || 0) > 0
                ? Number(row.unit_cost || 0)
                : (totalQty > 0 ? Number(row.cost_price || 0) / totalQty : 0);

            db.run(`
                INSERT INTO order_product_lines
                (order_id, sort_order, product_type, production_label, printing_types_json, production_notes, fabric_type, sizes_json, unit_price, unit_cost, total_price, cost_price, layout_path)
                VALUES (?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                row.id,
                row.product_type || 'Produto',
                row.product_type || 'Produto',
                '[]',
                null,
                row.fabric_type || '',
                JSON.stringify(sizes),
                derivedUnitPrice,
                derivedUnitCost,
                Number(row.total_price || 0),
                Number(row.cost_price || 0),
                row.layout_path || null
            ]);
        });
    });

    db.all(`
        SELECT
            q.id,
            q.product_type,
            q.fabric_type,
            q.sizes_json,
            q.total_price,
            q.cost_price,
            q.layout_path,
            COALESCE(q.unit_price, 0) AS unit_price,
            COALESCE(q.unit_cost, 0) AS unit_cost
        FROM quotes q
        WHERE NOT EXISTS (
            SELECT 1 FROM quote_product_lines qpl WHERE qpl.quote_id = q.id
        )
    `, [], (migrateErr, rows) => {
        if (migrateErr || !rows) return;

        rows.forEach((row) => {
            const sizes = safeParseDbJson(row.sizes_json);
            const totalQty = Object.values(sizes).reduce((sum, value) => sum + (Number(value) || 0), 0);
            const derivedUnitPrice = Number(row.unit_price || 0) > 0
                ? Number(row.unit_price || 0)
                : (totalQty > 0 ? Number(row.total_price || 0) / totalQty : 0);
            const derivedUnitCost = Number(row.unit_cost || 0) > 0
                ? Number(row.unit_cost || 0)
                : (totalQty > 0 ? Number(row.cost_price || 0) / totalQty : 0);

            db.run(`
                INSERT INTO quote_product_lines
                (quote_id, sort_order, product_type, production_label, printing_types_json, production_notes, fabric_type, sizes_json, unit_price, unit_cost, total_price, cost_price, layout_path)
                VALUES (?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                row.id,
                row.product_type || 'Produto',
                row.product_type || 'Produto',
                '[]',
                null,
                row.fabric_type || '',
                JSON.stringify(sizes),
                derivedUnitPrice,
                derivedUnitCost,
                Number(row.total_price || 0),
                Number(row.cost_price || 0),
                row.layout_path || null
            ]);
        });
    });

    db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT,
        size TEXT,
        color TEXT,
        production_cost REAL,
        sale_price REAL,
        current_stock INTEGER DEFAULT 0,
        min_stock INTEGER DEFAULT 0,
        supplier TEXT,
        production_days INTEGER,
        observations TEXT,
        type_peca TEXT,
        type_gola TEXT,
        printing_types_json TEXT DEFAULT '[]',
        margem_lucro REAL,
        tecido_principal_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run(`ALTER TABLE products ADD COLUMN printing_types_json TEXT DEFAULT '[]'`, () => {});

    db.run(`CREATE TABLE IF NOT EXISTS product_consumption (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        tamanho TEXT NOT NULL,
        consumo_metros REAL NOT NULL DEFAULT 0,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS fabrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS fabric_rolls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        descricao_tecido TEXT NOT NULL,
        tipo_tecido TEXT,
        largura_metros REAL,
        metros_total REAL NOT NULL,
        metros_disponivel REAL NOT NULL,
        custo_total REAL,
        custo_por_metro REAL,
        fornecedor TEXT,
        data_entrada DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS stock_movements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rolo_id INTEGER NOT NULL,
        type TEXT NOT NULL, 
        reason TEXT,
        order_id INTEGER,
        metros REAL NOT NULL,
        data_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (rolo_id) REFERENCES fabric_rolls(id),
        FOREIGN KEY (order_id) REFERENCES orders(id)
    )`);

    // --------------------------------------------------------
    // MÓDULO FINANCEIRO
    // --------------------------------------------------------
    db.run(`CREATE TABLE IF NOT EXISTS chart_of_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS cost_centers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        description TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Pendente',
        amount REAL NOT NULL,
        due_date DATE NOT NULL,
        payment_date DATE,
        payment_method TEXT,
        order_id INTEGER NULL,
        cost_center_id INTEGER NULL,
        chart_of_account_id INTEGER NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id),
        FOREIGN KEY (cost_center_id) REFERENCES cost_centers(id),
        FOREIGN KEY (chart_of_account_id) REFERENCES chart_of_accounts(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS financial_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        color TEXT DEFAULT '#2563EB',
        is_default INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS finance_goal_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        revenue REAL NOT NULL DEFAULT 25000,
        revenue_annual REAL NOT NULL DEFAULT 300000,
        pieces INTEGER NOT NULL DEFAULT 500,
        efficiency REAL NOT NULL DEFAULT 95,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS finance_objectives (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        template_key TEXT DEFAULT 'custom',
        name TEXT NOT NULL,
        description TEXT,
        target_amount REAL NOT NULL,
        initial_amount REAL NOT NULL DEFAULT 0,
        due_date DATE NOT NULL,
        color TEXT DEFAULT '#0EA5E9',
        icon_key TEXT DEFAULT 'custom',
        status TEXT NOT NULL DEFAULT 'active',
        financial_account_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (financial_account_id) REFERENCES financial_accounts(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS finance_objective_deposits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        objective_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        deposit_date DATE NOT NULL,
        note TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (objective_id) REFERENCES finance_objectives(id) ON DELETE CASCADE
    )`);

    db.run(`
        INSERT OR IGNORE INTO finance_goal_settings (id, revenue, revenue_annual, pieces, efficiency)
        VALUES (1, 25000, 300000, 500, 95)
    `);

    db.run(`
        INSERT OR IGNORE INTO financial_accounts (name, color, is_default)
        VALUES
            ('Santander', '#DC2626', 1),
            ('Nubank', '#7C3AED', 0)
    `);

    // --------------------------------------------------------
    // USUÁRIO ADMIN PADRÃO
    // --------------------------------------------------------
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@atos.com';
    const adminPassword = process.env.ADMIN_PASSWORD;

    db.get(`SELECT * FROM users WHERE email=?`, [adminEmail], async (err, user) => {
        if (!user) {
            if (!adminPassword) {
                console.warn('ADMIN_PASSWORD não definido. Usuário admin padrão não foi criado automaticamente.');
                return;
            }

            const hash = await bcrypt.hash(adminPassword, 10);
            db.run(
                `INSERT INTO users (name, email, password, role) VALUES (?,?,?,?)`,
                ['Administrador atos', adminEmail, hash, 'admin']
            );
        }
    });
    });
}

module.exports = db;
