const Database = require('better-sqlite3');
const db = new Database('seafood.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    price INTEGER NOT NULL,
    unit TEXT DEFAULT 'шт',
    image_url TEXT DEFAULT NULL,
    stock INTEGER DEFAULT 0
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
`);

function initProducts() {
  const products = [
    { name: "Икра ментая 0.25 кг", price: 370, unit: "шт" },
    { name: "Икра ментая 0.5 кг", price: 740, unit: "шт" },
    { name: "Икра кеты 0,25 кг", price: 2100, unit: "шт" },
    { name: "Икра кеты 0,5 кг", price: 4200, unit: "шт" },
    { name: "Горбуша неразделка", price: 600, unit: "кг" },
    { name: "Сельдь ИВАСИ м/я", price: 450, unit: "шт" },
    { name: "Крабовые Пал. Прем. 0,5 кг", price: 350, unit: "шт" },
    { name: "Филе Минтая с/з кг", price: 520, unit: "кг" },
    { name: "Креветка Королевская кг", price: 1250, unit: "кг" },
    { name: "Кальмар очищ. Командор кг", price: 860, unit: "кг" },
    { name: "Филе СЕЛЬДИ, м/я 0,5 кг", price: 500, unit: "шт" },
    { name: "Филе КЕТЫ, м/я 0,5 кг", price: 800, unit: "шт" }
  ];

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO products (name, price, unit, stock)
    VALUES (?, ?, ?, ?)
  `);

  for (const p of products) {
    stmt.run(p.name, p.price, p.unit, 0);
  }
}

initProducts();
module.exports = db;