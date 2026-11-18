import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { connectDatabase, mongoose } from '../database.js';
import { Counter, Order, Product, Sale, User } from '../models.js';
import { hashPassword, isStoredPasswordHash } from '../security/passwords.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectDir = path.dirname(__dirname);

function getDataDir() {
  return process.env.DATA_DIR || path.join(projectDir, 'data');
}

async function loadJson(name) {
  return JSON.parse(await fs.readFile(path.join(getDataDir(), `${name}.json`), 'utf8'));
}

async function importRecords(model, records, transform = (record) => record, key = 'id') {
  for (const record of records) {
    const migrated = await transform(record);
    await model.updateOne(
      { [key]: migrated[key] },
      { $setOnInsert: migrated },
      { upsert: true, runValidators: true }
    );
  }
}

export async function migrateJsonData() {
  const products = await loadJson('productos');
  const users = await loadJson('usuarios');
  const sales = await loadJson('ventas');
  const orders = await loadJson('pedidos');

  await importRecords(Product, products);
  await importRecords(User, users, async (user) => {
    const migrated = { ...user, email: user.email.trim().toLowerCase() };
    if (!isStoredPasswordHash(migrated.password)) migrated.password = await hashPassword(migrated.password);
    return migrated;
  });
  await importRecords(Sale, sales);
  await importRecords(Order, orders, (order) => order, 'orderId');

  for (const [entity, records] of Object.entries({ productos: products, usuarios: users, ventas: sales })) {
    await Counter.updateOne(
      { entity },
      { $max: { sequence: records.reduce((max, record) => Math.max(max, record.id), 0) } },
      { upsert: true }
    );
  }

  return {
    productos: products.length,
    usuarios: users.length,
    ventas: sales.length,
    pedidos: orders.length
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.env.MONGO_URI) throw new Error('Falta configurar MONGO_URI');
  try {
    await connectDatabase(process.env.MONGO_URI);
    const counts = await migrateJsonData();
    console.log('Importación JSON/MongoDB completada:', counts);
  } catch (error) {
    console.error('No se pudo completar la importación:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
