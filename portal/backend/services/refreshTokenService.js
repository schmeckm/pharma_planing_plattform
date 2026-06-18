import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { RefreshToken, User } from '../models/index.js';

function parseDurationMs(value, fallbackMs) {
  if (!value) return fallbackMs;
  const match = /^(\d+)([smhd])$/.exec(value);
  if (!match) return fallbackMs;
  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return amount * (multipliers[unit] || 1000);
}

export async function createRefreshToken(userId) {
  const raw = crypto.randomBytes(48).toString('hex');
  const tokenHash = await bcrypt.hash(raw, 10);
  const expiresAt = new Date(
    Date.now() + parseDurationMs(process.env.JWT_REFRESH_EXPIRES_IN, 7 * 86_400_000)
  );

  await RefreshToken.create({
    UserId: userId,
    tokenHash,
    expiresAt,
  });

  return { token: raw, expiresAt };
}

export async function rotateRefreshToken(rawToken) {
  if (!rawToken) return null;

  const candidates = await RefreshToken.findAll({
    where: { revokedAt: null },
    include: [{ model: User }],
    order: [['createdAt', 'DESC']],
    limit: 50,
  });

  for (const entry of candidates) {
    if (entry.expiresAt < new Date()) continue;
    const match = await bcrypt.compare(rawToken, entry.tokenHash);
    if (!match) continue;

    await entry.update({ revokedAt: new Date() });
    return entry.User;
  }

  return null;
}

export async function revokeRefreshToken(rawToken) {
  if (!rawToken) return;

  const candidates = await RefreshToken.findAll({
    where: { revokedAt: null },
    order: [['createdAt', 'DESC']],
    limit: 50,
  });

  for (const entry of candidates) {
    const match = await bcrypt.compare(rawToken, entry.tokenHash);
    if (match) {
      await entry.update({ revokedAt: new Date() });
      return;
    }
  }
}
