const Database = require('better-sqlite3');
const db = new Database('seafood.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    price INTEGER NOT NULL,
    unit TEXT DEFAULT 'шт',
    stock INTEGER DEFAULT 0,
    id_for_image TEXT DEFAULT NULL
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    username TEXT,
    contact TEXT,
    pickup TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY(product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    first_name TEXT,
    username TEXT,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

function initProducts() {
  const products = [
    { name: "Икра ментая 0.25 кг", price: 370, unit: "шт", stock: 0 },
    { name: "Икра ментая 0.5 кг", price: 740, unit: "шт", stock: 0 },
    { name: "ИКРА КЕТЫ ХАБАРОВСК 0,250 кг", price: 2100, unit: "шт", stock: 0 },
    { name: "ИКРА КЕТЫ ХАБАРОВСК 0,500 кг", price: 4200, unit: "шт", stock: 0 },
    { name: "Горбуша неразделка", price: 600, unit: "кг", stock: 0 },
    { name: "Сельдь ИВАСИ малосольная", price: 450, unit: "шт", stock: 0 },
    { name: "КРАБОВЫЕ ПАЛОЧКИ ПРЕМИУМ 500г", price: 350, unit: "шт", stock: 0 },
    { name: "ФИЛЕ МИНТАЯ СУХОЙ ЗАМОРОЗКИ", price: 520, unit: "кг", stock: 0 },
    { name: "КРЕВЕТКА КОРОЛЕВСКАЯ", price: 1250, unit: "кг", stock: 0 },
    { name: "КАЛЬМАР очищенный \"КОМАНДОР\"", price: 860, unit: "кг", stock: 0 },
    { name: "Филе СЕЛЬДИ, малосольная 0,5кг", price: 500, unit: "шт", stock: 0 },
    { name: "Филе КЕТЫ, малосольная 0,5кг", price: 800, unit: "шт", stock: 0 }
  ];

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO products (name, price, unit, stock)
    VALUES (?, ?, ?, ?)
  `);

  for (const p of products) {
    stmt.run(p.name, p.price, p.unit, p.stock);
  }
}

initProducts();
module.exports = db;