import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import { useTestDatabase } from './database-helper.js';
import { Order, Product, Sale } from '../models.js';

useTestDatabase();
const { default: app } = await import('../index.js');

test('valida el catálogo y exige JWT para crear órdenes', async () => {
  const server = app.listen(0);
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  async function request(route, options = {}) {
    return fetch(`${baseUrl}${route}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers }
    });
  }

  try {
    const productsResponse = await request('/api/products');
    const products = await productsResponse.json();
    assert.equal(productsResponse.status, 200);
    assert.equal(products.length, 8);

    const categoryResponse = await request('/api/products?category=accesorios');
    assert.equal((await categoryResponse.json()).length, 2);

    const login = await request('/api/usuarios/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'maria.gonzalez@example.com', password: 'P4ssw0rd!' })
    });
    const { token } = await login.json();
    assert.equal(login.status, 200);

    const orderBody = {
      user: { nombre: 'Suplantado', email: 'attacker@example.com' },
      items: [{ id: 1, cantidad: 2 }],
      total: 49998
    };
    const unauthorized = await request('/api/orders', {
      method: 'POST',
      body: JSON.stringify(orderBody)
    });
    assert.equal(unauthorized.status, 401);

    const invalidTotal = await request('/api/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...orderBody, total: 1 })
    });
    assert.equal(invalidTotal.status, 400);

    const created = await request('/api/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(orderBody)
    });
    const result = await created.json();
    assert.equal(created.status, 201);
    assert.equal(result.success, true);
    const savedOrder = await Order.findOne({ orderId: result.orderId });
    assert.equal(savedOrder.user.nombre, 'María');
    assert.equal(savedOrder.user.email, 'maria.gonzalez@example.com');
    assert.deepEqual(savedOrder.items[0], {
      id: 1,
      nombre: 'Remera Running',
      cantidad: 2,
      precio: 24999
    });

    const sale = await request('/api/ventas', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        id_usuario: 2,
        direccion: { calle: 'Calle Nueva', numero: 100 },
        productos: [{ id_producto: 1, cantidad: 2 }],
        pagado: false
      })
    });
    const createdSale = await sale.json();
    assert.equal(sale.status, 201);
    assert.equal(createdSale.id_usuario, 1);
    assert.ok(await Sale.findOne({ id: createdSale.id }));
    assert.equal((await Product.findOne({ id: 1 })).stock, 23);
  } finally {
    server.close();
    await once(server, 'close');
  }
});
