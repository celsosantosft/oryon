const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./atos.db');

db.serialize(() => {
  // 1. Tabela de Usuários (Com RH: Foto, Salário e Aniversário)
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE,
    password TEXT,
    role TEXT, -- 'admin', 'gerente', 'designer', 'corte', 'impressao', 'estampa', 'costura', 'qualidade'
    photo_url TEXT, -- Link da foto do perfil
    birth_date TEXT, -- Data de aniversário
    salary REAL -- Salário base para o financeiro
  )`);

  // 2. Tabela de Pedidos (Com Código de Rastreio e Arte)
  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tracking_code TEXT UNIQUE, -- Ex: #ATOS-8592
    client_name TEXT,
    product_type TEXT,
    fabric_type TEXT,
    category TEXT, -- 'Adulto' ou 'Infantil'
    sizes_json TEXT, -- Tabela de tamanhos salva em texto
    status TEXT DEFAULT 'Criação de Arte',
    total_price REAL,
    cost_price REAL, -- Custo calculado (Lucro)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    delivery_date DATETIME,
    art_file_path TEXT -- Caminho da Arte Final aprovada
  )`);

  // 3. Tabela de Histórico (Timeline do Cliente)
  db.run(`CREATE TABLE IF NOT EXISTS order_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER,
    status_text TEXT,
    changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    changed_by_user_id INTEGER,
    FOREIGN KEY(order_id) REFERENCES orders(id)
  )`);

  console.log("Banco de dados atos criado com sucesso!");
});

db.close();