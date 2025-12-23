const db = require('./db');

async function handleAdminPaid(ctx, orderId) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order || order.status !== 'pending') return ctx.answerCbQuery('Уже обработан');

  const items = db.prepare('SELECT product_id, quantity FROM order_items WHERE order_id = ?').all(orderId);
  for (const item of items) {
    db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(item.quantity, item.product_id);
  }

  db.prepare(`UPDATE orders SET status = 'paid' WHERE id = ?`).run(orderId);

  const text = ctx.callbackQuery.message?.text || 'Заказ';
  ctx.editMessageText(text + '\n\n✅ ОПЛАЧЕН');
  ctx.telegram.sendMessage(order.user_id, '✅ Заказ оплачен!');
}

async function handleAdminCancel(ctx, orderId) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order || order.status !== 'pending') return ctx.answerCbQuery('Уже обработан');

  // ❗ НЕ возвращаем остатки, т.к. они не списывались (pending)
  db.prepare(`UPDATE orders SET status = 'cancelled' WHERE id = ?`).run(orderId);

  const text = ctx.callbackQuery.message?.text || 'Заказ';
  ctx.editMessageText(text + '\n\n❌ ОТМЕНЁН');
  ctx.telegram.sendMessage(order.user_id, '❌ Заказ отменён.');
}

async function handleStockUpdate(ctx, productId) {
  if (ctx.from.id.toString() !== process.env.ADMIN_CHAT_ID) {
    return ctx.answerCbQuery('Только админ', { show_alert: true });
  }
  db.prepare('UPDATE products SET stock = stock + 1 WHERE id = ?').run(productId);
  ctx.answerCbQuery('✅ +1');
}

module.exports = {
  handleAdminPaid,
  handleAdminCancel,
  handleStockUpdate
};