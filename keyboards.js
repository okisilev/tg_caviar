const { Markup } = require('telegraf');

function getMainKeyboard(isAdmin) {
  const base = [['Морепродукты']];
  if (isAdmin) base.push(['Админка']);
  return Markup.keyboard(base).resize().oneTime();
}

function productKeyboard(products) {
  const buttons = products.map(p => {
    const priceStr = p.unit === 'кг' ? `${p.price}₽/кг` : `${p.price}₽`;
    return Markup.button.callback(`${p.name} — ${priceStr} (ост: ${p.stock})`, `buy_${p.id}`);
  });
  return Markup.inlineKeyboard(buttons.map(b => [b]));
}

function quantityKeyboard(productId) {
  const buttons = [1, 2, 3, 5].map(q =>
    Markup.button.callback(`${q} шт`, `qty_${productId}_${q}`)
  );
  return Markup.inlineKeyboard([
    ...buttons.map(b => [b]),
    [Markup.button.callback('← Назад', 'back_to_products')]
  ]);
}

function pickupOptions() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('Самовывоз (Иркутск, ул. Арктическая, 76)', 'pickup_self')],
    [Markup.button.callback('Доставка', 'pickup_delivery')],
    [Markup.button.callback('← Назад', 'back_to_qty')]
  ]);
}

function contactRequest() {
  return Markup.keyboard([
    [Markup.button.contactRequest('📱 Отправить контакт')]
  ]).resize().oneTime();
}

function cartKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('➕ Добавить ещё', 'add_more')],
    [Markup.button.callback('✅ Подтвердить заказ', 'confirm_order')],
    [Markup.button.callback('🗑️ Очистить корзину', 'clear_cart')]
  ]);
}

function adminMainMenu() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📦 Товары', 'admin_products')],
    [Markup.button.callback('➕ Добавить товар', 'admin_add_product')],
    [Markup.button.callback('📋 Заказы', 'admin_orders')],
    [Markup.button.callback('📊 Отчёты', 'admin_reports')],
    [Markup.button.callback('📨 Рассылка', 'admin_broadcast')]
  ]);
}

function adminProductList(products) {
  const rows = [];
  for (const p of products) {
    rows.push([Markup.button.callback(`${p.name} — ${p.price}₽ (ост: ${p.stock})`, 'noop')]);
    rows.push([
      Markup.button.callback('✏️ Цена', `edit_price_${p.id}`),
      Markup.button.callback('+1', `stock_${p.id}_1`)
    ]);
  }
  rows.push([Markup.button.callback('⬅️ Назад', 'admin_main')]);
  return Markup.inlineKeyboard(rows);
}

function adminOrderActions(orderId) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('✅ Оплачена', `admin_paid_${orderId}`)],
    [Markup.button.callback('❌ Отмена', `admin_cancel_${orderId}`)]
  ]);
}

module.exports = {
  getMainKeyboard,
  productKeyboard,
  quantityKeyboard,
  pickupOptions,
  contactRequest,
  cartKeyboard,
  adminMainMenu,
  adminProductList,
  adminOrderActions
};