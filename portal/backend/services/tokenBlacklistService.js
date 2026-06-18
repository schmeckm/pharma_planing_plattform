import { RevokedToken } from '../models/index.js';

export async function isTokenRevoked(jti) {
  if (!jti) return false;
  const entry = await RevokedToken.findOne({ where: { jti } });
  return Boolean(entry);
}

export async function revokeToken(jti, expiresAt) {
  if (!jti) return;
  await RevokedToken.findOrCreate({
    where: { jti },
    defaults: { expiresAt },
  });
}
