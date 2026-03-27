import db from '../config/database.js';
import { sendDeliveryCodeEmail } from '../services/email.js';

export const createOrder = (req, res) => {
  try {
    const { customer, items, subtotal, total, shippingType, shippingCity, paymentMethod, paymentId } = req.body;
    const userId = req.user?.id || null;

    const orderId = `ORD-${Math.floor(100000 + Math.random() * 900000)}`;

    const stmt = db.prepare(`
      INSERT INTO orders (
        id, user_id, customer, items, subtotal, total, 
        shipping_type, shipping_city, payment_id, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Recibido')
    `);

    stmt.run(
      orderId,
      userId,
      JSON.stringify(customer),
      JSON.stringify(items),
      parseFloat(subtotal),
      parseFloat(total),
      shippingType,
      shippingCity,
      paymentId || null
    );

    // Descontar stock (simple versión transaccional)
    const updateStock = db.transaction((cartItems) => {
      for (const item of cartItems) {
        db.prepare('UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?')
          .run(item.quantity, item.id);
      }
    });
    updateStock(items);

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    order.items = JSON.parse(order.items);
    order.customer = JSON.parse(order.customer);

    res.status(201).json({ order });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Error al crear la orden' });
  }
};

export const getOrders = (req, res) => {
  try {
    const userId = req.user.id;
    let orders;

    if (req.user.role === 'admin') {
      orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
    } else {
      orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(userId);
    }

    const formatted = orders.map(o => ({
      ...o,
      items: JSON.parse(o.items),
      customer: JSON.parse(o.customer),
      shippingType: o.shipping_type,
      shippingCity: o.shipping_city,
      date: o.created_at
    }));

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener órdenes' });
  }
};

export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, deliveryCode } = req.body; // 'Recibido', 'En camino', 'Entregado', etc.

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    if (!order) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }

    if (status === 'En camino' && order.status !== 'En camino') {
      const generatedCode = String(Math.floor(100000 + Math.random() * 900000));
      db.prepare('UPDATE orders SET status = ?, delivery_code = ? WHERE id = ?').run(status, generatedCode, id);
      
      const customerInfo = JSON.parse(order.customer);
      await sendDeliveryCodeEmail(customerInfo.email, customerInfo.name, id, generatedCode);

      return res.json({ success: true, message: 'Estado actualizado y código enviado', deliveryCode: generatedCode });
    } 
    
    if (status === 'Entregado' && order.status !== 'Entregado') {
      if (order.delivery_code && order.delivery_code !== deliveryCode) {
        return res.status(400).json({ error: 'Código de verificación incorrecto' });
      }
      db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, id);
      return res.json({ success: true, message: 'Orden entregada correctamente' });
    }

    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, id);
    res.json({ success: true, message: 'Estado actualizado correctamente' });
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ error: 'Error al actualizar el estado de la orden' });
  }
};
