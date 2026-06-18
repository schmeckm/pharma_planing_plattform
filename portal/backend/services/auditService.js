import { Op } from 'sequelize';
import { sequelize } from '../database/initDatabase.js';
import { AuditLog, User } from '../models/index.js';

export async function createAuditLog({ userId, action, entityType = null, entityId = null, metadata = {} }) {
  return AuditLog.create({
    UserId: userId,
    action,
    entityType,
    entityId: entityId != null ? String(entityId) : null,
    metadata,
  });
}

function parseDateStart(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function parseDateEnd(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(23, 59, 59, 999);
  return date;
}

function buildAuditWhere({ action, from, to, userId } = {}) {
  const where = {};

  if (action) {
    where.action = String(action).trim();
  }

  if (userId) {
    where.UserId = Number(userId);
  }

  const fromDate = parseDateStart(from);
  const toDate = parseDateEnd(to);
  if (fromDate || toDate) {
    where.createdAt = {};
    if (fromDate) where.createdAt[Op.gte] = fromDate;
    if (toDate) where.createdAt[Op.lte] = toDate;
  }

  return where;
}

export async function listAuditLogs({ limit = 50, offset = 0, action, from, to, userId } = {}) {
  const where = buildAuditWhere({ action, from, to, userId });

  const { rows, count } = await AuditLog.findAndCountAll({
    where,
    include: [
      {
        model: User,
        attributes: ['id', 'email', 'displayName', 'role'],
      },
    ],
    order: [['createdAt', 'DESC']],
    limit: Math.min(Number(limit) || 50, 200),
    offset: Number(offset) || 0,
  });

  return {
    total: count,
    items: rows.map((entry) => ({
      id: entry.id,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      metadata: entry.metadata,
      createdAt: entry.createdAt,
      user: entry.User
        ? {
            id: entry.User.id,
            email: entry.User.email,
            displayName: entry.User.displayName,
            role: entry.User.role,
          }
        : null,
    })),
  };
}

export async function listAuditActions() {
  const rows = await AuditLog.findAll({
    attributes: [[sequelize.fn('DISTINCT', sequelize.col('action')), 'action']],
    order: [[sequelize.col('action'), 'ASC']],
    raw: true,
  });
  return rows.map((row) => row.action).filter(Boolean);
}
