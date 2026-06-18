import bcrypt from 'bcryptjs';
import { Op } from 'sequelize';
import { RefreshToken, User } from '../models/index.js';
import { serializeUser } from './authService.js';
import { validatePassword } from '../utils/passwordValidation.js';

export async function listUsers() {
  const users = await User.findAll({
    attributes: ['id', 'email', 'displayName', 'role', 'language', 'emailVerified', 'createdAt'],
    order: [['createdAt', 'ASC']],
  });
  return users.map(serializeUser);
}

export async function createUser({ email, password, displayName, role = 'user', language = 'de' }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    const err = new Error('Ungültige E-Mail-Adresse');
    err.status = 400;
    throw err;
  }

  const passwordCheck = validatePassword(password);
  if (!passwordCheck.valid) {
    const err = new Error('Passwort erfüllt nicht die Anforderungen');
    err.status = 400;
    err.code = 'password.invalid';
    throw err;
  }

  if (!['admin', 'user'].includes(role)) {
    const err = new Error('Ungültige Rolle');
    err.status = 400;
    throw err;
  }

  const existing = await User.findOne({ where: { email: normalizedEmail } });
  if (existing) {
    const err = new Error('E-Mail bereits vergeben');
    err.status = 409;
    throw err;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    email: normalizedEmail,
    passwordHash,
    displayName: displayName?.trim() || normalizedEmail,
    role,
    language: ['de', 'en'].includes(language) ? language : 'de',
    emailVerified: true,
  });

  return serializeUser(user);
}

export async function updateUser(userId, { role, displayName, language }) {
  const user = await User.findByPk(userId);
  if (!user) {
    const err = new Error('Benutzer nicht gefunden');
    err.status = 404;
    throw err;
  }

  const updates = {};
  if (role && ['admin', 'user'].includes(role)) {
    updates.role = role;
  }
  if (typeof displayName === 'string' && displayName.trim()) {
    updates.displayName = displayName.trim();
  }
  if (typeof language === 'string' && ['de', 'en'].includes(language)) {
    updates.language = language;
  }

  if (!Object.keys(updates).length) {
    const err = new Error('Keine gültigen Felder zum Aktualisieren');
    err.status = 400;
    throw err;
  }

  if (updates.role === 'user' && user.role === 'admin') {
    const adminCount = await User.count({ where: { role: 'admin' } });
    if (adminCount <= 1) {
      const err = new Error('Der letzte Administrator kann nicht herabgestuft werden');
      err.status = 400;
      throw err;
    }
  }

  await user.update(updates);
  return serializeUser(user);
}

export async function deleteUser(userId, actorUserId) {
  const user = await User.findByPk(userId);
  if (!user) {
    const err = new Error('Benutzer nicht gefunden');
    err.status = 404;
    throw err;
  }

  if (user.id === actorUserId) {
    const err = new Error('Eigenes Konto kann nicht gelöscht werden');
    err.status = 400;
    throw err;
  }

  if (user.role === 'admin') {
    const adminCount = await User.count({ where: { role: 'admin' } });
    if (adminCount <= 1) {
      const err = new Error('Der letzte Administrator kann nicht gelöscht werden');
      err.status = 400;
      throw err;
    }
  }

  await RefreshToken.destroy({ where: { UserId: user.id } });
  const snapshot = serializeUser(user);
  await user.destroy();
  return snapshot;
}

export async function countAdmins() {
  return User.count({ where: { role: 'admin' } });
}
