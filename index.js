require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const path = require('path');
const db = require('./db');

const {
  showCatalog,
  handleBuy,
  handleQuantity,
  handleAddMore,
  handleClearCart,
  handleConfirmOrder,
  handlePickup,
  handleContact
} = require('./user-scenarios');

const {
  getMainKeyboard,
  adminMainMenu,
  adminProductList,
  adminOrderActions
} = require('./keyboards');

const {
  handleAdminPaid,
  handleAdminCancel,
  handleStockUpdate
} = require('./admin-scenarios');

const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = process.env.ADMIN_CHAT_ID;

// Состояния
const adminEditState = {};      // редактирование цены
const adminState = {};          // рассылка
const adminProductState = {};   // добавление товара

// Middleware: сохраняем всех пользователей
bot.use(async (ctx, next) => {
  if (ctx.from) {
    db.prepare(`
      INSERT INTO users (id, first_name, username, last_seen)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        first_name = excluded.first_name,
        username = excluded.username,
        last_seen = excluded.last_seen
    `).run(ctx.from.id, ctx.from.first_name, ctx.from.username);
  }
  await next();
});

// /start
bot.start((ctx) => {
  const isAdmin = ctx.from.id.toString() === ADMIN_ID;
  const photo = path.resolve(__dirname, 'images', 'caviar.jpg');
  ctx.replyWithPhoto({ source: photo }, {
    caption: 'Добро пожаловать в магазин морепродуктов! 🐟',
    ...getMainKeyboard(isAdmin)
  });
});

// Основные команды
bot.hears('Морепродукты', showCatalog);
bot.hears('Админка', (ctx) => {
  if (ctx.from.id.toString() !== ADMIN_ID) return;
  ctx.reply('Админ-панель:', adminMainMenu());
});
bot.on('contact', handleContact);

// Корзина и каталог
bot.action(/^buy_(\d+)$/, (ctx) => handleBuy(ctx, ctx.match[1]));
bot.action(/^qty_(\d+)_(\d+)$/, (ctx) => handleQuantity(ctx, ctx.match[1], ctx.match[2]));
bot.action('add_more', handleAddMore);
bot.action('clear_cart', handleClearCart);
bot.action('confirm_order', handleConfirmOrder);
bot.action('back_to_products', showCatalog);
bot.action('back_to_qty', (ctx) => {
  const cart = require('./user-scenarios').cart;
  const items = cart[ctx.from.id];
  if (items?.length) {
    const last = items[items.length - 1];
    handleQuantity(ctx, last.productId, last.quantity);
  }
});

// Получение
bot.action(/^pickup_(self|delivery)$/, (ctx) => handlePickup(ctx, ctx.match[0]));

// Админка — главные разделы
bot.action('admin_main', (ctx) => ctx.editMessageText('Админ-панель:', adminMainMenu()));
bot.action('admin_products', (ctx) => {
  const products = db.prepare('SELECT * FROM products ORDER BY name').all();
  ctx.editMessageText('📦 Товары:', adminProductList(products));
});

// Заказы
bot.action('admin_orders', (ctx) => {
  const orders = db.prepare("SELECT id, contact FROM orders WHERE status = 'pending' ORDER BY id DESC").all();
  if (orders.length === 0) {
    return ctx.editMessageText('Нет необработанных заказов.', adminMainMenu());
  }
  const buttons = orders.map(o => [
    Markup.button.callback(`#${o.id} | ${o.contact}`, `view_order_${o.id}`)
  ]);
  buttons.push([Markup.button.callback('⬅️ Назад', 'admin_main')]);
  ctx.editMessageText('📋 Необработанные заказы:', Markup.inlineKeyboard(buttons));
});

bot.action(/^view_order_(\d+)$/, async (ctx) => {
  const id = parseInt(ctx.match[1]);
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!order) return ctx.answerCbQuery('Не найден');

  const items = db.prepare(`
    SELECT p.name, p.price, oi.quantity
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = ?
  `).all(id);

  const list = items.map(i => `• ${i.name} — ${i.quantity} шт × ${i.price}₽`).join('\n');
  const msg = `Заказ #${id}\nКонтакт: ${order.contact}\nПолучение: ${order.pickup}\n\n${list}`;

  ctx.answerCbQuery();
  ctx.reply(msg, adminOrderActions(id));
});

// Отчёты
bot.action('admin_reports', (ctx) => {
  const paid = db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'paid'").get().c;
  const revenue = db.prepare(`
    SELECT IFNULL(SUM(p.price * oi.quantity), 0) as r
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    JOIN orders o ON o.id = oi.order_id
    WHERE o.status = 'paid'
  `).get().r;

  ctx.editMessageText(
    `📊 Отчёты:\n💰 Доход: ${revenue}₽\n📦 Оплачено: ${paid}`,
    Markup.inlineKeyboard([[Markup.button.callback('⬅️ Назад', 'admin_main')]])
  );
});

// === ДОБАВЛЕНИЕ ТОВАРА (без картинки) ===
bot.action('admin_add_product', (ctx) => {
  if (ctx.from.id.toString() !== ADMIN_ID) return;
  adminProductState[ctx.from.id] = { step: 'name' };
  ctx.editMessageText('✏️ Введите название товара:');
});

// Обработка текста — пошаговая (БЕЗ картинки)
bot.on('text', async (ctx) => {
  const userId = ctx.from.id.toString();
  if (userId !== ADMIN_ID) return;

  // 1. Добавление товара
  const prodState = adminProductState[userId];
  if (prodState) {
    const text = ctx.message.text.trim();

    if (prodState.step === 'name') {
      prodState.name = text;
      prodState.step = 'price';
      return ctx.reply('💰 Введите цену (только цифры):');
    }

    if (prodState.step === 'price') {
      const price = parseInt(text);
      if (isNaN(price) || price <= 0) {
        return ctx.reply('❌ Некорректная цена. Введите целое число > 0.');
      }
      prodState.price = price;
      prodState.step = 'unit';
      return ctx.reply('📦 Введите единицу измерения (например: шт, кг):');
    }

    if (prodState.step === 'unit') {
      prodState.unit = text;
      prodState.step = 'stock';
      return ctx.reply('🔢 Введите остаток (целое число):');
    }

    if (prodState.step === 'stock') {
      const stock = parseInt(text);
      if (isNaN(stock) || stock < 0) {
        return ctx.reply('❌ Некорректный остаток. Введите число ≥ 0.');
      }
      prodState.stock = stock;

      // Сохраняем БЕЗ id_for_image
      try {
        db.prepare(`
          INSERT INTO products (name, price, unit, stock)
          VALUES (?, ?, ?, ?)
        `).run(prodState.name, prodState.price, prodState.unit, prodState.stock);

        ctx.reply(`✅ Товар "${prodState.name}" добавлен!`);
      } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          ctx.reply('❌ Товар с таким названием уже существует.');
        } else {
          ctx.reply('❌ Ошибка при добавлении товара.');
        }
      }

      delete adminProductState[userId];
      return;
    }
  }

  // 2. Рассылка (без логирования!)
  const broadcastState = adminState[userId];
  if (broadcastState && broadcastState.awaitingBroadcast) {
    const messageText = ctx.message.text;
    const users = db.prepare('SELECT id FROM users').all();
    let sent = 0, failed = 0;

    for (const user of users) {
      try {
        await ctx.telegram.sendMessage(user.id, messageText);
        sent++;
      } catch (err) {
        failed++;
        // 🔇 ЛОГИРОВАНИЕ УДАЛЕНО — нет console.error
      }
    }

    ctx.reply(`✅ Рассылка завершена!\nДоставлено: ${sent}\nОшибок: ${failed}`);
    delete adminState[userId];
    return;
  }

  // 3. Редактирование цены
  const priceState = adminEditState[userId];
  if (priceState && priceState.productId) {
    const price = parseInt(ctx.message.text);
    if (isNaN(price) || price <= 0) {
      return ctx.reply('❌ Некорректная цена. Введите целое число > 0.');
    }
    db.prepare('UPDATE products SET price = ? WHERE id = ?').run(price, priceState.productId);
    ctx.reply(`✅ Цена обновлена на ${price}₽`);

    const products = db.prepare('SELECT * FROM products ORDER BY name').all();
    ctx.reply('📦 Товары:', adminProductList(products));
    delete adminEditState[userId];
    return;
  }
});

// Иницация действий
bot.action('admin_broadcast', (ctx) => {
  if (ctx.from.id.toString() !== ADMIN_ID) return;
  adminState[ctx.from.id] = { awaitingBroadcast: true };
  ctx.editMessageText('📨 Введите текст рассылки:');
});

bot.action(/^edit_price_(\d+)$/, (ctx) => {
  if (ctx.from.id.toString() !== ADMIN_ID) return;
  adminEditState[ctx.from.id] = { productId: ctx.match[1] };
  ctx.reply('Новая цена (цифры):');
});

bot.action(/^stock_(\d+)_1$/, (ctx) => {
  handleStockUpdate(ctx, parseInt(ctx.match[1]));
  const products = db.prepare('SELECT * FROM products ORDER BY name').all();
  ctx.editMessageText('📦 Товары:', adminProductList(products));
});

// Обработка заказов
bot.action(/^admin_paid_(\d+)$/, (ctx) => handleAdminPaid(ctx, parseInt(ctx.match[1])));
bot.action(/^admin_cancel_(\d+)$/, (ctx) => handleAdminCancel(ctx, parseInt(ctx.match[1])));

// Заглушки
bot.action('noop', (ctx) => ctx.answerCbQuery());

bot.launch();
console.log('✅ Бот запущен');