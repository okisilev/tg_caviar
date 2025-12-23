const db = require('./db');
const { productKeyboard, quantityKeyboard, pickupOptions, contactRequest, cartKeyboard, adminOrderActions } = require('./keyboards');

let cart = {};
let userState = {};

function renderCart(userId) {
  if (!cart[userId] || cart[userId].length === 0) return 'Пусто';
  return cart[userId].map(item => {
    const p = db.prepare('SELECT name, price FROM products WHERE id = ?').get(item.productId);
    return `${p.name} — ${item.quantity} шт × ${p.price}₽ = ${item.quantity * p.price}₽`;
  }).join('\n');
}

function getTotalPrice(userId) {
  if (!cart[userId]) return 0;
  return cart[userId].reduce((sum, item) => {
    const p = db.prepare('SELECT price FROM products WHERE id = ?').get(item.productId);
    return sum + (item.quantity * p.price);
  }, 0);
}

async function showCatalog(ctx) {
  const products = db.prepare('SELECT * FROM products WHERE stock > 0').all();
  if (products.length === 0) {
    return ctx.reply('Нет товаров в наличии.');
  }
  ctx.reply('Выберите товар:', productKeyboard(products));
}

async function handleBuy(ctx, productId) {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
  if (!product || product.stock <= 0) return ctx.answerCbQuery('Товар недоступен');
  ctx.editMessageText(`Сколько штук?`, quantityKeyboard(productId));
}

async function handleQuantity(ctx, productId, qty) {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
  if (!product || product.stock < qty) {
    return ctx.answerCbQuery('Недостаточно остатка!');
  }

  if (!cart[ctx.from.id]) cart[ctx.from.id] = [];
  const existing = cart[ctx.from.id].find(i => i.productId === productId);
  if (existing) {
    existing.quantity += qty;
  } else {
    cart[ctx.from.id].push({ productId, quantity: qty });
  }

  ctx.editMessageText(
    `✅ Добавлено: ${product.name} — ${qty} шт\n\n🛒 Корзина:\n${renderCart(ctx.from.id)}\n\nИтого: ${getTotalPrice(ctx.from.id)}₽`,
    cartKeyboard()
  );
}

async function handleAddMore(ctx) {
  showCatalog(ctx);
}

async function handleClearCart(ctx) {
  delete cart[ctx.from.id];
  showCatalog(ctx);
}

async function handleConfirmOrder(ctx) {
  if (!cart[ctx.from.id] || cart[ctx.from.id].length === 0) {
    return ctx.answerCbQuery('Корзина пуста');
  }
  ctx.editMessageText('Способ получения:', pickupOptions());
}

async function handlePickup(ctx, pickupType) {
  if (!userState[ctx.from.id]) userState[ctx.from.id] = {};
  userState[ctx.from.id].pickup = pickupType === 'pickup_self' ? 'Самовывоз' : 'Доставка';
  ctx.reply('Отправьте контакт:', contactRequest());
}

async function handleContact(ctx) {
  if (!ctx.message.contact) return ctx.reply('Нажмите "Отправить контакт"');
  const state = userState[ctx.from.id];
  if (!state || !state.pickup) return ctx.reply('Сначала выберите получение.');

  const contact = `${ctx.message.contact.first_name} ${ctx.message.contact.phone_number}`;
  const items = cart[ctx.from.id];
  if (!items || items.length === 0) return ctx.reply('Корзина пуста.');

  const order = db.prepare(`
    INSERT INTO orders (user_id, username, contact, pickup)
    VALUES (?, ?, ?, ?)
  `).run(ctx.from.id, ctx.from.username || '', contact, state.pickup);

  for (const item of items) {
    db.prepare(`
      INSERT INTO order_items (order_id, product_id, quantity)
      VALUES (?, ?, ?)
    `).run(order.lastInsertRowid, item.productId, item.quantity);
  }

  const itemsList = items.map(item => {
    const p = db.prepare('SELECT name, price FROM products WHERE id = ?').get(item.productId);
    return `• ${p.name} — ${item.quantity} шт × ${p.price}₽`;
  }).join('\n');

  const adminMsg = `
🆕 Заказ #${order.lastInsertRowid}
Пользователь: ${ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name}
Получение: ${state.pickup}
Контакт: ${contact}

Товары:
${itemsList}

Итого: ${getTotalPrice(ctx.from.id)}₽

❗ Укажите в платеже: заказ #${order.lastInsertRowid}
  `.trim();

  await ctx.telegram.sendMessage(
    process.env.ADMIN_CHAT_ID,
    adminMsg,
    adminOrderActions(order.lastInsertRowid)
  );

  ctx.reply(
    `✅ Заказ принят!\n\n💳 Реквизиты:\nСБЕР — 1234 5678 9012 3456\n❗ В комментарии укажите: заказ #${order.lastInsertRowid}`,
    { reply_markup: { remove_keyboard: true } }
  );

  delete cart[ctx.from.id];
  delete userState[ctx.from.id];
}

module.exports = {
  showCatalog,
  handleBuy,
  handleQuantity,
  handleAddMore,
  handleClearCart,
  handleConfirmOrder,
  handlePickup,
  handleContact
};