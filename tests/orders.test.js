import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const projectDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const testDataDir = mkdtempSync(path.join(tmpdir(), 'aw2-orders-'));
cpSync(path.join(projectDir, 'data'), testDataDir, { recursive: true });
writeFileSync(path.join(testDataDir, 'pedidos.json'), '[]\n');
process.env.DATA_DIR = testDataDir;

const { default: app } = await import('../index.js');

test('catálogo y creación validada de órdenes', async () => {
  const server = app.listen(0);
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const productsResponse = await fetch(`${baseUrl}/api/products`);
    const products = await productsResponse.json();
    assert.equal(productsResponse.status, 200);
    assert.equal(products.length, 8);
    assert.ok(products.every((product) => product.id && product.nombre && product.precio !== undefined && product.categoria && product.imagen && product.descripcion));

    const categoryResponse = await fetch(`${baseUrl}/api/products?category=accesorios`);
    const accessories = await categoryResponse.json();
    assert.equal(categoryResponse.status, 200);
    assert.equal(accessories.length, 2);
    assert.ok(accessories.every((product) => product.categoria === 'Accesorios'));

    const emptyOrderResponse = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: { nombre: 'Ana', email: 'ana@example.com' }, items: [], total: 0 })
    });
    assert.equal(emptyOrderResponse.status, 400);

    const invalidTotalResponse = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: { nombre: 'Ana', email: 'ana@example.com' },
        items: [{ id: 1, cantidad: 2 }],
        total: 1
      })
    });
    assert.equal(invalidTotalResponse.status, 400);

    const validResponse = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: { nombre: 'Ana Pérez', email: 'ana@example.com' },
        items: [{ id: 1, cantidad: 2 }],
        total: 49998
      })
    });
    const result = await validResponse.json();
    assert.equal(validResponse.status, 201);
    assert.equal(result.success, true);
    assert.ok(result.orderId);

    const savedOrders = JSON.parse(readFileSync(path.join(testDataDir, 'pedidos.json'), 'utf8'));
    assert.equal(savedOrders.length, 1);
    assert.equal(savedOrders[0].orderId, result.orderId);
    assert.deepEqual(savedOrders[0].user, { nombre: 'Ana Pérez', email: 'ana@example.com' });
    assert.deepEqual(savedOrders[0].items, [{ id: 1, nombre: 'Remera Running', cantidad: 2, precio: 24999 }]);
    assert.equal(savedOrders[0].total, 49998);
  } finally {
    server.close();
    await once(server, 'close');
    rmSync(testDataDir, { recursive: true, force: true });
  }
});