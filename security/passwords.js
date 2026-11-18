import { createHash, scryptSync, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 12;
const SCRYPT_PATTERN = /^scrypt\$([a-f0-9]{32})\$([a-f0-9]{128})$/i;

function bcryptInput(password) {
  return createHash('sha256').update(password).digest('base64');
}

export function isStoredPasswordHash(password) {
  return typeof password === 'string' &&
    (/^\$2[aby]\$\d\d\$/.test(password) || SCRYPT_PATTERN.test(password));
}

export async function hashPassword(password) {
  return bcrypt.hash(bcryptInput(password), BCRYPT_ROUNDS);
}

export async function verifyPassword(password, storedPassword) {
  if (typeof storedPassword !== 'string') return false;
  if (/^\$2[aby]\$\d\d\$/.test(storedPassword)) {
    return bcrypt.compare(bcryptInput(password), storedPassword);
  }
  const match = SCRYPT_PATTERN.exec(storedPassword);
  if (!match) return false;
  const candidate = scryptSync(password, match[1], 64);
  return timingSafeEqual(candidate, Buffer.from(match[2], 'hex'));
}
