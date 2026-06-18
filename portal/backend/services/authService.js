import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';
import { createRefreshToken, rotateRefreshToken } from './refreshTokenService.js';
import { revokeToken } from './tokenBlacklistService.js';

function parseDurationMs(value, fallbackMs) {
  if (!value) return fallbackMs;
  const match = /^(\d+)([smhd])$/.exec(value);
  if (!match) return fallbackMs;
  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return amount * (multipliers[unit] || 1000);
}

export function serializeUser(user) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName || user.email,
    role: user.role,
    language: user.language,
    emailVerified: Boolean(user.emailVerified),
    twoFactorEnabled: Boolean(user.twoFactorEnabled),
  };
}

function signAccessToken(user) {
  const expiresIn = process.env.JWT_EXPIRES_IN || '15m';
  const jti = crypto.randomUUID();
  const token = jwt.sign(
    { sub: user.id, role: user.role, jti },
    process.env.JWT_SECRET,
    { expiresIn }
  );
  const decoded = jwt.decode(token);
  return {
    token,
    jti,
    expiresAt: decoded?.exp ? new Date(decoded.exp * 1000) : null,
  };
}

export async function issueSession(user) {
  const { token, jti, expiresAt } = signAccessToken(user);
  const refresh = await createRefreshToken(user.id);
  return {
    token,
    refreshToken: refresh.token,
    user: serializeUser(user),
    accessExpiresAt: expiresAt,
    refreshExpiresAt: refresh.expiresAt,
    jti,
  };
}

export async function loginWithPassword(email, password) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const user = await User.findOne({ where: { email: normalizedEmail } });
  if (!user?.passwordHash) {
    return null;
  }
  const valid = await bcrypt.compare(String(password || ''), user.passwordHash);
  if (!valid) {
    return null;
  }
  return issueSession(user);
}

export async function loginWithGoogleProfile(profile) {
  const email = String(profile.email || '').trim().toLowerCase();
  if (!email) {
    throw new Error('Google-Profil ohne E-Mail');
  }

  let user = null;
  if (profile.googleId) {
    user = await User.findOne({ where: { googleId: profile.googleId } });
  }
  if (!user) {
    user = await User.findOne({ where: { email } });
  }

  if (!user) {
    user = await User.create({
      email,
      displayName: profile.displayName || email,
      googleId: profile.googleId || null,
      emailVerified: true,
      role: 'user',
      language: profile.language || 'de',
    });
  } else {
    const updates = {};
    if (profile.googleId && !user.googleId) updates.googleId = profile.googleId;
    if (profile.displayName && !user.displayName) updates.displayName = profile.displayName;
    if (!user.emailVerified) updates.emailVerified = true;
    if (Object.keys(updates).length) {
      await user.update(updates);
    }
  }

  return issueSession(user);
}

export async function refreshSession(refreshToken) {
  const user = await rotateRefreshToken(refreshToken);
  if (!user) {
    return null;
  }
  return issueSession(user);
}

export async function revokeAccessToken(token) {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload?.jti && payload?.exp) {
      await revokeToken(payload.jti, new Date(payload.exp * 1000));
    }
  } catch {
    // Token bereits ungültig — kein Fehler nötig
  }
}

export function getAccessTokenTtlMs() {
  return parseDurationMs(process.env.JWT_EXPIRES_IN, 15 * 60_000);
}
