import jwt from 'jsonwebtoken';
import { User } from '../models.js';

export async function authenticate(req, res, next) {
  const authorization = req.get('Authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match) return res.status(401).json({ error: 'Se requiere un token Bearer' });
  if (!process.env.JWT_SECRET) return res.status(500).json({ error: 'La autenticación no está configurada' });

  try {
    const payload = jwt.verify(match[1], process.env.JWT_SECRET);
    if (typeof payload.sub !== 'string' || !/^\d+$/.test(payload.sub)) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }
    const user = await User.findOne({ id: Number(payload.sub), activo: { $ne: false } });
    if (!user) return res.status(401).json({ error: 'Token inválido o expirado' });
    req.user = { id: user.id, nombre: user.nombre, email: user.email };
    return next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }
    return next(error);
  }
}
