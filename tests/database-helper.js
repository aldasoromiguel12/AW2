import { after, before } from 'node:test';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDatabase, mongoose } from '../database.js';
import { migrateJsonData } from '../scripts/migrate-json.js';

let mongo;
let dataDirectory;
const projectDirectory = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

export function useTestDatabase() {
  before(async () => {
    mongo = await MongoMemoryServer.create();
    process.env.MONGO_URI = mongo.getUri();
    process.env.JWT_SECRET = 'test-secret-with-at-least-thirty-two-characters';
    dataDirectory = mkdtempSync(path.join(tmpdir(), 'aw2-mongo-test-'));
    cpSync(path.join(projectDirectory, 'data'), dataDirectory, { recursive: true });
    const usersPath = path.join(dataDirectory, 'usuarios.json');
    const users = JSON.parse(readFileSync(usersPath, 'utf8'));
    users.push({
      id: 6,
      nombre: 'Importado',
      apellido: 'JSON',
      email: 'importado@example.com',
      password: 'Importar123',
      activo: true
    });
    writeFileSync(usersPath, `${JSON.stringify(users, null, 2)}\n`);
    process.env.DATA_DIR = dataDirectory;
    await connectDatabase(process.env.MONGO_URI);
    await migrateJsonData();
    await migrateJsonData();
  });

  after(async () => {
    await mongoose.disconnect();
    await mongo.stop();
    rmSync(dataDirectory, { recursive: true, force: true });
  });
}
