import mongoose from 'mongoose';

const { Schema } = mongoose;

const productSchema = new Schema({
  id: { type: Number, required: true, unique: true },
  nombre: { type: String, required: true },
  descripcion: String,
  categoria: String,
  precio: { type: Number, required: true, min: 0 },
  stock: { type: Number, required: true, min: 0 },
  imagen: String,
  disponible: Boolean
}, { strict: false });

const userSchema = new Schema({
  id: { type: Number, required: true, unique: true },
  nombre: { type: String, required: true, trim: true, maxlength: 80 },
  apellido: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  telefono: { type: String, maxlength: 30 },
  activo: { type: Boolean, default: true }
}, { strict: false });

const saleSchema = new Schema({
  id: { type: Number, required: true, unique: true },
  id_usuario: { type: Number, required: true },
  fecha: String,
  total: Number,
  direccion: Schema.Types.Mixed,
  estado: String,
  pagado: Boolean,
  productos: [Schema.Types.Mixed]
}, { strict: false });

const orderSchema = new Schema({
  orderId: { type: String, required: true, unique: true },
  user: { nombre: { type: String, required: true }, email: { type: String, required: true } },
  items: [Schema.Types.Mixed],
  total: { type: Number, required: true },
  estado: { type: String, default: 'pendiente' },
  fecha: { type: String, required: true }
}, { strict: false });

const counterSchema = new Schema({
  entity: { type: String, required: true, unique: true },
  sequence: { type: Number, default: 0 }
});

export const Product = mongoose.models.Product || mongoose.model('Product', productSchema, 'productos');
export const User = mongoose.models.User || mongoose.model('User', userSchema, 'usuarios');
export const Sale = mongoose.models.Sale || mongoose.model('Sale', saleSchema, 'ventas');
export const Order = mongoose.models.Order || mongoose.model('Order', orderSchema, 'pedidos');
export const Counter = mongoose.models.Counter || mongoose.model('Counter', counterSchema, 'contadores');
