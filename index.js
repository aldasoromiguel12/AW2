import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const app = express();
const PORT = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const FILES = {
  productos: path.join(DATA_DIR, 'productos.json'),
  usuarios: path.join(DATA_DIR, 'usuarios.json'),
  ventas: path.join(DATA_DIR, 'ventas.json')
};

app.use(express.json());

function readData(entity) {
  return JSON.parse(fs.readFileSync(FILES[entity], 'utf8'));
}

function writeData(entity, data) {
  fs.writeFileSync(FILES[entity], `${JSON.stringify(data, null, 2)}\n`);
}

function nextId(records) {
  return records.length ? Math.max(...records.map((record) => record.id)) + 1 : 1;
}

function publicUser(user) {
  const { password, ...safeUser } = user;
  return safeUser;
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function findById(entity, id) {
  return readData(entity).find((record) => record.id === Number(id));
}

function validateProduct(body) {
  if (!body.nombre || typeof body.nombre !== 'string') return 'nombre es obligatorio';
  if (typeof body.precio !== 'number' || body.precio < 0) return 'precio debe ser un número mayor o igual a 0';
  if (!isPositiveInteger(body.stock) && body.stock !== 0) return 'stock debe ser un entero mayor o igual a 0';
  return null;
}

function validateUser(body) {
  if (!body.nombre || !body.apellido || !body.email || !body.password) {
    return 'nombre, apellido, email y password son obligatorios';
  }
  if (body.telefono !== undefined && typeof body.telefono !== 'string') {
    return 'telefono debe ser un string';
  }
  return null;
}

function validateSale(body) {
  if (!isPositiveInteger(body.id_usuario)) return 'id_usuario debe ser un entero positivo';
  if (!Array.isArray(body.productos) || body.productos.length === 0) return 'productos debe ser un array no vacío';
  if (!body.direccion || typeof body.direccion !== 'object') return 'direccion es obligatoria';
  return null;
}

function validateSaleProducts(items, products) {
  for (const item of items) {
    if (!isPositiveInteger(item.id_producto) || !isPositiveInteger(item.cantidad)) {
      return 'cada producto debe tener id_producto y cantidad enteros positivos';
    }
    const product = products.find((candidate) => candidate.id === item.id_producto);
    if (!product) return `el producto ${item.id_producto} no existe`;
    if (item.cantidad > product.stock) return `stock insuficiente para el producto ${item.id_producto}`;
  }
  return null;
}

function calculateSaleTotal(items, products) {
  return Number(items.reduce((total, item) => {
    const product = products.find((candidate) => candidate.id === item.id_producto);
    return total + product.precio * item.cantidad;
  }, 0).toFixed(2));
}

app.get('/api/productos', (req, res) => {
  res.json(readData('productos'));
});

app.get('/api/productos/:id', (req, res) => {
  const product = findById('productos', req.params.id);
  if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json(product);
});

app.post('/api/productos', (req, res) => {
  const error = validateProduct(req.body);
  if (error) return res.status(400).json({ error });

  const products = readData('productos');
  const product = {
    id: nextId(products),
    ...req.body,
    disponible: req.body.disponible ?? req.body.stock > 0
  };
  products.push(product);
  writeData('productos', products);
  res.status(201).json(product);
});

app.put('/api/productos/:id', (req, res) => {
  const products = readData('productos');
  const index = products.findIndex((product) => product.id === Number(req.params.id));
  if (index === -1) return res.status(404).json({ error: 'Producto no encontrado' });

  const updated = { ...products[index], ...req.body, id: products[index].id };
  const error = validateProduct(updated);
  if (error) return res.status(400).json({ error });
  products[index] = updated;
  writeData('productos', products);
  res.json(updated);
});

app.delete('/api/productos/:id', (req, res) => {
  const products = readData('productos');
  const productId = Number(req.params.id);
  const index = products.findIndex((product) => product.id === productId);
  if (index === -1) return res.status(404).json({ error: 'Producto no encontrado' });

  const usedInSale = readData('ventas').some((sale) => sale.productos.some((item) => item.id_producto === productId));
  if (usedInSale) {
    return res.status(409).json({ error: 'No se puede eliminar: el producto está referenciado por una venta' });
  }
  const [deleted] = products.splice(index, 1);
  writeData('productos', products);
  res.json({ mensaje: 'Producto eliminado', producto: deleted });
});

app.get('/api/usuarios', (req, res) => {
  res.json(readData('usuarios').map(publicUser));
});

app.get('/api/usuarios/:id', (req, res) => {
  const user = findById('usuarios', req.params.id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json(publicUser(user));
});

app.post('/api/usuarios', (req, res) => {
  const error = validateUser(req.body);
  if (error) return res.status(400).json({ error });

  const users = readData('usuarios');
  if (users.some((user) => user.email === req.body.email)) {
    return res.status(409).json({ error: 'El email ya está registrado' });
  }
  const user = { id: nextId(users), ...req.body, activo: req.body.activo ?? true };
  users.push(user);
  writeData('usuarios', users);
  res.status(201).json(publicUser(user));
});

app.post('/api/usuarios/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email y password son obligatorios' });

  const user = readData('usuarios').find((candidate) => candidate.email === email && candidate.password === password);
  if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });
  res.json({ mensaje: 'Autenticación correcta', usuario: publicUser(user) });
});

app.put('/api/usuarios/:id', (req, res) => {
  const users = readData('usuarios');
  const index = users.findIndex((user) => user.id === Number(req.params.id));
  if (index === -1) return res.status(404).json({ error: 'Usuario no encontrado' });

  const updated = { ...users[index], ...req.body, id: users[index].id };
  const error = validateUser(updated);
  if (error) return res.status(400).json({ error });
  if (users.some((user, userIndex) => userIndex !== index && user.email === updated.email)) {
    return res.status(409).json({ error: 'El email ya está registrado' });
  }
  users[index] = updated;
  writeData('usuarios', users);
  res.json(publicUser(updated));
});

app.delete('/api/usuarios/:id', (req, res) => {
  const users = readData('usuarios');
  const userId = Number(req.params.id);
  const index = users.findIndex((user) => user.id === userId);
  if (index === -1) return res.status(404).json({ error: 'Usuario no encontrado' });

  const dependentSales = readData('ventas').filter((sale) => sale.id_usuario === userId);
  if (dependentSales.length) {
    return res.status(409).json({
      error: 'No se puede eliminar: el usuario tiene ventas asociadas',
      ventas_asociadas: dependentSales.map((sale) => sale.id)
    });
  }
  const [deleted] = users.splice(index, 1);
  writeData('usuarios', users);
  res.json({ mensaje: 'Usuario eliminado', usuario: publicUser(deleted) });
});

app.get('/api/ventas', (req, res) => {
  res.json(readData('ventas'));
});

app.get('/api/ventas/:id', (req, res) => {
  const sale = findById('ventas', req.params.id);
  if (!sale) return res.status(404).json({ error: 'Venta no encontrada' });
  res.json(sale);
});

app.post('/api/ventas', (req, res) => {
  const error = validateSale(req.body);
  if (error) return res.status(400).json({ error });

  const users = readData('usuarios');
  const products = readData('productos');
  if (!users.some((user) => user.id === req.body.id_usuario)) {
    return res.status(400).json({ error: 'El usuario indicado no existe' });
  }
  const productsError = validateSaleProducts(req.body.productos, products);
  if (productsError) return res.status(400).json({ error: productsError });

  const sales = readData('ventas');
  const sale = {
    id: nextId(sales),
    id_usuario: req.body.id_usuario,
    fecha: req.body.fecha ?? new Date().toISOString().slice(0, 10),
    total: calculateSaleTotal(req.body.productos, products),
    direccion: req.body.direccion,
    estado: req.body.estado ?? 'pendiente',
    pagado: req.body.pagado ?? false,
    productos: req.body.productos.map((item) => ({
      ...item,
      precio_unitario: products.find((product) => product.id === item.id_producto).precio
    }))
  };
  sales.push(sale);
  writeData('ventas', sales);

  for (const item of sale.productos) {
    const product = products.find((candidate) => candidate.id === item.id_producto);
    product.stock -= item.cantidad;
    product.disponible = product.stock > 0;
  }
  writeData('productos', products);
  res.status(201).json(sale);
});

app.put('/api/ventas/:id', (req, res) => {
  const sales = readData('ventas');
  const index = sales.findIndex((sale) => sale.id === Number(req.params.id));
  if (index === -1) return res.status(404).json({ error: 'Venta no encontrada' });
  if (req.body.id_usuario !== undefined && !findById('usuarios', req.body.id_usuario)) {
    return res.status(400).json({ error: 'El usuario indicado no existe' });
  }

  sales[index] = { ...sales[index], ...req.body, id: sales[index].id };
  writeData('ventas', sales);
  res.json(sales[index]);
});

app.delete('/api/ventas/:id', (req, res) => {
  const sales = readData('ventas');
  const index = sales.findIndex((sale) => sale.id === Number(req.params.id));
  if (index === -1) return res.status(404).json({ error: 'Venta no encontrada' });
  const [deleted] = sales.splice(index, 1);
  writeData('ventas', sales);
  res.json({ mensaje: 'Venta eliminada', venta: deleted });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && error.body) {
    return res.status(400).json({ error: 'El body debe contener JSON válido' });
  }
  next(error);
});

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  app.listen(PORT, () => {
    console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
  });
}

export default app;
