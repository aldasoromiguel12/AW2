import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDatabase, mongoose } from '../database.js';
import { migrateJsonData } from './migrate-json.js';
import { startServer } from '../index.js';

const projectDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const databaseDirectory = path.join(projectDir, '.local-mongodb');
let mongo;
let server;

async function shutdown() {
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
}

try {
  await fs.mkdir(databaseDirectory, { recursive: true });
  mongo = await MongoMemoryServer.create({
    instance: { dbPath: databaseDirectory }
  });
  process.env.MONGO_URI = mongo.getUri('aw2-proyecto');
  await connectDatabase(process.env.MONGO_URI);
  const counts = await migrateJsonData();
  console.log('Datos JSON importados:', counts);
  server = await startServer();

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      shutdown()
        .then(() => process.exit(0))
        .catch((error) => {
          console.error('No se pudo cerrar el servidor correctamente:', error);
          process.exit(1);
        });
    });
  }
} catch (error) {
  console.error('No se pudo iniciar el entorno local:', error);
  await shutdown();
  process.exitCode = 1;
}
