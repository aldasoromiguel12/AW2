import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import jwt from 'jsonwebtoken';
import { connectDatabase, nextId } from './database.js';
import { Order, Product, Sale, User } from './models.js';
import { authenticate } from './middleware/auth.js';
import { hashPassword, verifyPassword } from './security/passwords.js';

const app = express();
const PORT = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function publicDocument(document) {
  if (!document) return document;
  const result = document.toObject ? document.toObject() : { ...document };
  delete result._id;
  delete result.__v;
  delete result.password;
  return result;
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function validateProduct(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'El body debe ser un objeto';
  if (!body.nombre || typeof body.nombre !== 'string') return 'nombre es obligatorio';
  if (typeof body.precio !== 'number' || body.precio < 0) return 'precio debe ser un número mayor o igual a 0';
  if (!Number.isInteger(body.stock) || body.stock < 0) return 'stock debe ser un entero mayor o igual a 0';
  return null;
}

function validateUser(body, { validatePassword = true } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'El body debe ser un objeto';
  for (const field of ['nombre', 'apellido']) {
    if (typeof body[field] !== 'string' || !body[field].trim() || body[field].trim().length > 80) {
      return `${field} debe ser un texto de entre 1 y 80 caracteres`;
    }
  }
  if (
    body.telefono !== undefined &&
    (typeof body.telefono !== 'string' || body.telefono.trim().length > 30)
  ) {
    return 'telefono debe ser un texto de hasta 30 caracteres';
  }
  if (
    typeof body.email !== 'string' ||
    body.email.trim().length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())
  ) {
    return 'email debe tener un formato válido';
  }
  if (
    validatePassword &&
    (typeof body.password !== 'string' ||
      body.password.length < 8 ||
      body.password.length > 128 ||
      !/[A-Za-z]/.test(body.password) ||
      !/[0-9]/.test(body.password))
  ) {
    return 'password debe tener entre 8 y 128 caracteres e incluir letras y números';
  }
  return null;
}

function userFields(body) {
  const fields = {};
  for (const field of ['nombre', 'apellido', 'email', 'telefono']) {
    if (body[field] !== undefined) fields[field] = body[field];
  }
  if (typeof fields.nombre === 'string') fields.nombre = fields.nombre.trim();
  if (typeof fields.apellido === 'string') fields.apellido = fields.apellido.trim();
  if (typeof fields.email === 'string') fields.email = fields.email.trim().toLowerCase();
  if (typeof fields.telefono === 'string') fields.telefono = fields.telefono.trim();
  return fields;
}

function validateSale(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'El body debe ser un objeto';
  if (!isPositiveInteger(body.id_usuario)) return 'id_usuario debe ser un entero positivo';
  if (!Array.isArray(body.productos) || body.productos.length === 0) return 'productos debe ser un array no vacío';
  if (!body.direccion || typeof body.direccion !== 'object' || Array.isArray(body.direccion)) {
    return 'direccion es obligatoria';
  }
  return null;
}

function validateSaleProducts(items, products) {
  const quantities = new Map();
  for (const item of items) {
    if (!isPositiveInteger(item.id_producto) || !isPositiveInteger(item.cantidad)) {
      return 'cada producto debe tener id_producto y cantidad enteros positivos';
    }
    quantities.set(item.id_producto, (quantities.get(item.id_producto) ?? 0) + item.cantidad);
  }
  for (const [productId, quantity] of quantities) {
    const product = products.find((candidate) => candidate.id === productId);
    if (!product) return `el producto ${productId} no existe`;
    if (quantity > product.stock) return `stock insuficiente para el producto ${productId}`;
  }
  return null;
}

function calculateSaleTotal(items, products) {
  return Number(items.reduce((total, item) => {
    const product = products.find((candidate) => candidate.id === item.id_producto);
    return total + product.precio * item.cantidad;
  }, 0).toFixed(2));
}

function requireOwner(req, res, userId) {
  if (req.user.id !== Number(userId)) {
    res.status(403).json({ error: 'No tienes permiso para acceder a este recurso' });
    return false;
  }
  return true;
}

app.get('/api/products', asyncHandler(async (req, res) => {
  const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
  const query = category
    ? { categoria: { $regex: `^${category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } }
    : {};
  res.json((await Product.find(query).sort({ id: 1 })).map(publicDocument));
}));

app.post('/api/orders', authenticate, asyncHandler(async (req, res) => {
  const { items, total } = req.body ?? {};
  if (
    !Array.isArray(items) ||
    items.length === 0 ||
    typeof total !== 'number' ||
    !Number.isFinite(total) ||
    total < 0
  ) {
    return res.status(400).json({ error: 'Se requieren al menos un producto y un total válido' });
  }

  const quantitiesByProduct = new Map();
  for (const item of items) {
    const productId = Number(item?.id);
    if (!Number.isSafeInteger(productId) || productId <= 0 || !isPositiveInteger(item?.cantidad)) {
      return res.status(400).json({ error: 'Cada producto debe tener un id y una cantidad entera positiva' });
    }
    quantitiesByProduct.set(productId, (quantitiesByProduct.get(productId) ?? 0) + item.cantidad);
  }

  const products = await Product.find({ id: { $in: [...quantitiesByProduct.keys()] } });
  const productsById = new Map(products.map((product) => [product.id, product]));
  const normalizedItems = [];
  for (const [productId, cantidad] of quantitiesByProduct) {
    const product = productsById.get(productId);
    if (!product) return res.status(400).json({ error: `El producto ${productId} no existe` });
    if (cantidad > product.stock) return res.status(400).json({ error: `Stock insuficiente para el producto ${productId}` });
    normalizedItems.push({
      id: product.id,
      nombre: product.nombre,
      cantidad,
      precio: product.precio
    });
  }

  const totalInCents = normalizedItems.reduce(
    (sum, item) => sum + Math.round(item.precio * 100) * item.cantidad,
    0
  );
  const calculatedTotal = Number((totalInCents / 100).toFixed(2));
  if (Math.round(total * 100) !== totalInCents) {
    return res.status(400).json({ error: 'El total enviado no coincide con los productos y precios actuales' });
  }

  const order = await Order.create({
    orderId: randomUUID(),
    user: { nombre: req.user.nombre, email: req.user.email },
    items: normalizedItems,
    total: calculatedTotal,
    estado: 'pendiente',
    fecha: new Date().toISOString()
  });
  res.status(201).json({
    success: true,
    orderId: order.orderId,
    message: 'Orden creada con éxito',
    total: calculatedTotal
  });
}));

app.get('/api/productos', asyncHandler(async (req, res) => {
  res.json((await Product.find().sort({ id: 1 })).map(publicDocument));
}));

app.get('/api/productos/:id', asyncHandler(async (req, res) => {
  const product = await Product.findOne({ id: Number(req.params.id) });
  if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json(publicDocument(product));
}));

app.post('/api/productos', authenticate, asyncHandler(async (req, res) => {
  const error = validateProduct(req.body);
  if (error) return res.status(400).json({ error });
  const product = await Product.create({
    ...req.body,
    id: await nextId('productos'),
    disponible: req.body.disponible ?? req.body.stock > 0
  });
  res.status(201).json(publicDocument(product));
}));

app.put('/api/productos/:id', authenticate, asyncHandler(async (req, res) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({ error: 'El body debe ser un objeto' });
  }
  const product = await Product.findOne({ id: Number(req.params.id) });
  if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
  const updated = { ...publicDocument(product), ...req.body, id: product.id };
  const error = validateProduct(updated);
  if (error) return res.status(400).json({ error });
  Object.assign(product, updated);
  await product.save();
  res.json(publicDocument(product));
}));

app.delete('/api/productos/:id', authenticate, asyncHandler(async (req, res) => {
  const productId = Number(req.params.id);
  const product = await Product.findOne({ id: productId });
  if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
  if (await Sale.exists({ 'productos.id_producto': productId })) {
    return res.status(409).json({ error: 'No se puede eliminar: el producto está referenciado por una venta' });
  }
  await product.deleteOne();
  res.json({ mensaje: 'Producto eliminado', producto: publicDocument(product) });
}));

app.get('/api/usuarios', authenticate, asyncHandler(async (req, res) => {
  res.json((await User.find().sort({ id: 1 })).map(publicDocument));
}));

app.get('/api/usuarios/:id', authenticate, asyncHandler(async (req, res) => {
  if (!requireOwner(req, res, req.params.id)) return;
  const user = await User.findOne({ id: Number(req.params.id) });
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json(publicDocument(user));
}));

app.post('/api/usuarios', asyncHandler(async (req, res) => {
  const error = validateUser(req.body);
  if (error) return res.status(400).json({ error });
  const fields = userFields(req.body);
  if (await User.exists({ email: fields.email })) return res.status(409).json({ error: 'El email ya está registrado' });
  const user = await User.create({
    id: await nextId('usuarios'),
    ...fields,
    password: await hashPassword(req.body.password),
    activo: true
  });
  res.status(201).json(publicDocument(user));
}));

app.post('/api/usuarios/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body ?? {};
  if (
    typeof email !== 'string' ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
    typeof password !== 'string' ||
    !password
  ) {
    return res.status(400).json({ error: 'Se requieren un email válido y un password' });
  }

  const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password');
  if (!user || user.activo === false) return res.status(401).json({ error: 'Credenciales inválidas' });
  const validPassword = await verifyPassword(password, user.password);
  if (!validPassword) return res.status(401).json({ error: 'Credenciales inválidas' });
  if (!user.password.startsWith('$2')) {
    user.password = await hashPassword(password);
    await user.save();
  }

  const token = jwt.sign({}, process.env.JWT_SECRET, { subject: String(user.id), expiresIn: '1h' });
  res.json({ mensaje: 'Autenticación correcta', usuario: publicDocument(user), token });
}));

app.put('/api/usuarios/:id', authenticate, asyncHandler(async (req, res) => {
  if (!requireOwner(req, res, req.params.id)) return;
  const user = await User.findOne({ id: Number(req.params.id) }).select('+password');
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  const fields = userFields(req.body ?? {});
  const mergedUser = { ...publicDocument(user), ...fields, password: req.body?.password ?? user.password };
  const error = validateUser(mergedUser, { validatePassword: req.body?.password !== undefined });
  if (error) return res.status(400).json({ error });
  if (fields.email && await User.exists({ email: fields.email, id: { $ne: user.id } })) {
    return res.status(409).json({ error: 'El email ya está registrado' });
  }
  Object.assign(user, fields);
  if (req.body?.password !== undefined) {
    user.password = await hashPassword(req.body.password);
  }
  await user.save();
  res.json(publicDocument(user));
}));

app.delete('/api/usuarios/:id', authenticate, asyncHandler(async (req, res) => {
  if (!requireOwner(req, res, req.params.id)) return;
  const user = await User.findOne({ id: Number(req.params.id) });
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  const dependentSales = await Sale.find({ id_usuario: user.id }).select('id');
  if (dependentSales.length) {
    return res.status(409).json({
      error: 'No se puede eliminar: el usuario tiene ventas asociadas',
      ventas_asociadas: dependentSales.map((sale) => sale.id)
    });
  }
  await user.deleteOne();
  res.json({ mensaje: 'Usuario eliminado', usuario: publicDocument(user) });
}));

app.get('/api/ventas', authenticate, asyncHandler(async (req, res) => {
  res.json((await Sale.find().sort({ id: 1 })).map(publicDocument));
}));

app.get('/api/ventas/:id', authenticate, asyncHandler(async (req, res) => {
  const sale = await Sale.findOne({ id: Number(req.params.id) });
  if (!sale) return res.status(404).json({ error: 'Venta no encontrada' });
  if (!requireOwner(req, res, sale.id_usuario)) return;
  res.json(publicDocument(sale));
}));

app.post('/api/ventas', authenticate, asyncHandler(async (req, res) => {
  const body = { ...(req.body ?? {}), id_usuario: req.user.id };
  const error = validateSale(body);
  if (error) return res.status(400).json({ error });
  const products = await Product.find({ id: { $in: body.productos.map((item) => item.id_producto) } });
  const productMap = new Map(products.map((product) => [product.id, product]));
  const productsError = validateSaleProducts(body.productos, products);
  if (productsError) return res.status(400).json({ error: productsError });

  const sale = {
    id: await nextId('ventas'),
    id_usuario: req.user.id,
    fecha: body.fecha ?? new Date().toISOString().slice(0, 10),
    total: calculateSaleTotal(body.productos, products),
    direccion: body.direccion,
    estado: body.estado ?? 'pendiente',
    pagado: body.pagado ?? false,
    productos: body.productos.map((item) => ({
      ...item,
      precio_unitario: productMap.get(item.id_producto).precio
    }))
  };
  const reserved = [];
  try {
    const quantities = new Map();
    for (const item of sale.productos) {
      quantities.set(item.id_producto, (quantities.get(item.id_producto) ?? 0) + item.cantidad);
    }
    for (const [id, quantity] of quantities) {
      const updatedProduct = await Product.findOneAndUpdate(
        { id, stock: { $gte: quantity } },
        [
          { $set: { stock: { $subtract: ['$stock', quantity] } } },
          { $set: { disponible: { $gt: ['$stock', 0] } } }
        ],
        { returnDocument: 'after', updatePipeline: true }
      );
      if (!updatedProduct) throw Object.assign(new Error(`Stock insuficiente para el producto ${id}`), { status: 409 });
      reserved.push({ id, quantity });
    }
    const createdSale = await Sale.create(sale);
    res.status(201).json(publicDocument(createdSale));
  } catch (error) {
    await Promise.all(reserved.map(({ id, quantity }) => Product.updateOne(
      { id },
      [
        { $set: { stock: { $add: ['$stock', quantity] } } },
        { $set: { disponible: { $gt: ['$stock', 0] } } }
      ],
      { updatePipeline: true }
    )));
    throw error;
  }
}));

app.put('/api/ventas/:id', authenticate, asyncHandler(async (req, res) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({ error: 'El body debe ser un objeto' });
  }
  const sale = await Sale.findOne({ id: Number(req.params.id) });
  if (!sale) return res.status(404).json({ error: 'Venta no encontrada' });
  if (!requireOwner(req, res, sale.id_usuario)) return;
  if (req.body.id_usuario !== undefined && Number(req.body.id_usuario) !== req.user.id) {
    return res.status(403).json({ error: 'No puedes cambiar el propietario de la venta' });
  }
  const updated = { ...publicDocument(sale), ...req.body, id: sale.id, id_usuario: req.user.id };
  Object.assign(sale, updated);
  await sale.save();
  res.json(publicDocument(sale));
}));

app.delete('/api/ventas/:id', authenticate, asyncHandler(async (req, res) => {
  const sale = await Sale.findOne({ id: Number(req.params.id) });
  if (!sale) return res.status(404).json({ error: 'Venta no encontrada' });
  if (!requireOwner(req, res, sale.id_usuario)) return;
  await sale.deleteOne();
  res.json({ mensaje: 'Venta eliminada', venta: publicDocument(sale) });
}));

app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && error.body) {
    return res.status(400).json({ error: 'El body debe contener JSON válido' });
  }
  if (error.code === 11000) return res.status(409).json({ error: 'El recurso ya existe' });
  if (error.name === 'ValidationError' || error.name === 'CastError') {
    return res.status(400).json({ error: 'Los datos enviados no son válidos' });
  }
  if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
  if (error.status) return res.status(error.status).json({ error: error.message });
  console.error('Error inesperado en la API:', error);
  return res.status(500).json({ error: 'Error interno del servidor' });
});

export async function startServer() {
  if (!process.env.MONGO_URI) throw new Error('Falta configurar MONGO_URI');
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET debe estar configurado y tener al menos 32 caracteres');
  }
  await connectDatabase(process.env.MONGO_URI);
  return app.listen(PORT, () => {
    console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer().catch((error) => {
    console.error('No se pudo iniciar el servidor:', error);
    process.exitCode = 1;
  });
}

export default app;
