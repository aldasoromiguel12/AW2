import assert from 'node:assert/strict';
import { randomBytes, scryptSync } from 'node:crypto';
import { once } from 'node:events';
import test from 'node:test';
import { useTestDatabase } from './database-helper.js';
import { User } from '../models.js';

useTestDatabase();
const { default: app } = await import('../index.js');

test('registra, autentica y actualiza usuarios con bcrypt y JWT', async () => {
  const legacyPassword = 'ClaveAntigua2026';
  const legacySalt = randomBytes(16).toString('hex');
  const legacyHash = `scrypt$${legacySalt}$${scryptSync(legacyPassword, legacySalt, 64).toString('hex')}`;
  await User.create({
    id: 99,
    nombre: 'Usuario',
    apellido: 'Antiguo',
    email: 'legacy@example.com',
    password: legacyHash,
    activo: true
  });

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
    const invalidRegistration = await request('/api/usuarios', {
      method: 'POST',
      body: JSON.stringify({
        nombre: 'Nuevo',
        apellido: 'Usuario',
        email: 'invalido',
        password: 'corta1'
      })
    });
    assert.equal(invalidRegistration.status, 400);

    const registration = await request('/api/usuarios', {
      method: 'POST',
      body: JSON.stringify({
        nombre: 'Nuevo',
        apellido: 'Usuario',
        email: 'NUEVO@example.com',
        password: 'ClaveSegura2026',
        activo: false,
        id: 999
      })
    });
    const createdUser = await registration.json();
    assert.equal(registration.status, 201);
    assert.equal(createdUser.id, 7);
    assert.equal(createdUser.email, 'nuevo@example.com');
    assert.equal(Object.hasOwn(createdUser, 'password'), false);
    const savedUser = await User.findOne({ email: createdUser.email }).select('+password');
    assert.match(savedUser.password, /^\$2/);

    const duplicateEmail = await request('/api/usuarios', {
      method: 'POST',
      body: JSON.stringify({
        nombre: 'Otro',
        apellido: 'Usuario',
        email: 'NUEVO@example.com',
        password: 'OtraClave123'
      })
    });
    assert.equal(duplicateEmail.status, 409);

    const legacyLogin = await request('/api/usuarios/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'LEGACY@example.com', password: legacyPassword })
    });
    const legacyResult = await legacyLogin.json();
    assert.equal(legacyLogin.status, 200);
    assert.ok(legacyResult.token);
    assert.equal(Object.hasOwn(legacyResult.usuario, 'password'), false);
    const upgradedUser = await User.findOne({ email: 'legacy@example.com' }).select('+password');
    assert.match(upgradedUser.password, /^\$2/);

    const login = await request('/api/usuarios/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'nuevo@example.com', password: 'ClaveSegura2026' })
    });
    const loginResult = await login.json();
    assert.equal(login.status, 200);

    const protectedWithoutToken = await request(`/api/usuarios/${createdUser.id}`);
    assert.equal(protectedWithoutToken.status, 401);
    const ownProfile = await request(`/api/usuarios/${createdUser.id}`, {
      headers: { Authorization: `Bearer ${loginResult.token}` }
    });
    assert.equal(ownProfile.status, 200);
    assert.equal(Object.hasOwn(await ownProfile.json(), 'password'), false);
    const anotherProfile = await request('/api/usuarios/1', {
      headers: { Authorization: `Bearer ${loginResult.token}` }
    });
    assert.equal(anotherProfile.status, 403);

    const invalidLogin = await request('/api/usuarios/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'nuevo@example.com', password: 'incorrecta123' })
    });
    assert.equal(invalidLogin.status, 401);

    const importedLogin = await request('/api/usuarios/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'importado@example.com', password: 'Importar123' })
    });
    assert.equal(importedLogin.status, 200);
    const importedHash = await User.findOne({ email: 'importado@example.com' }).select('+password');
    assert.match(importedHash.password, /^\$2/);

    const update = await request(`/api/usuarios/${createdUser.id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${loginResult.token}` },
      body: JSON.stringify({ password: 'NuevaClave2026' })
    });
    assert.equal(update.status, 200);
    assert.equal(Object.hasOwn(await update.json(), 'password'), false);
    const newPasswordLogin = await request('/api/usuarios/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'nuevo@example.com', password: 'NuevaClave2026' })
    });
    assert.equal(newPasswordLogin.status, 200);
  } finally {
    server.close();
    await once(server, 'close');
  }
});
