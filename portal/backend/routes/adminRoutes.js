import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { adminMiddleware } from '../middleware/adminMiddleware.js';
import { sendError, sendSuccess } from '../utils/apiResponse.js';
import { createAuditLog, listAuditActions, listAuditLogs } from '../services/auditService.js';
import { getSystemInfo, setSettings } from '../services/settingsService.js';
import { getDetailedHealth } from '../services/healthService.js';
import { getEmailStatus, sendTestEmail } from '../services/emailService.js';
import {
  createUser,
  deleteUser,
  listUsers,
  updateUser,
} from '../services/userAdminService.js';

const router = Router();

router.use(authMiddleware, adminMiddleware);

function handleServiceError(res, req, err) {
  console.error(err);
  const status = err.status || 500;
  const message = err.message || 'errors.internal';
  sendError(res, req, status, message);
}

router.get('/users', async (req, res) => {
  try {
    const users = await listUsers();
    sendSuccess(res, { users });
  } catch (err) {
    handleServiceError(res, req, err);
  }
});

router.post('/users', async (req, res) => {
  try {
    const { email, password, displayName, role, language } = req.body || {};
    const user = await createUser({ email, password, displayName, role, language });

    await createAuditLog({
      userId: req.user.id,
      action: 'user.created',
      entityType: 'user',
      entityId: user.id,
      metadata: { email: user.email, role: user.role },
    });

    sendSuccess(res, { user }, 201);
  } catch (err) {
    handleServiceError(res, req, err);
  }
});

router.patch('/users/:id', async (req, res) => {
  try {
    const user = await updateUser(req.params.id, req.body || {});

    await createAuditLog({
      userId: req.user.id,
      action: 'user.updated',
      entityType: 'user',
      entityId: user.id,
      metadata: { updates: req.body, targetEmail: user.email },
    });

    sendSuccess(res, { user });
  } catch (err) {
    handleServiceError(res, req, err);
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    const deleted = await deleteUser(req.params.id, req.user.id);

    await createAuditLog({
      userId: req.user.id,
      action: 'user.deleted',
      entityType: 'user',
      entityId: deleted.id,
      metadata: { email: deleted.email, role: deleted.role },
    });

    sendSuccess(res, { ok: true, user: deleted });
  } catch (err) {
    handleServiceError(res, req, err);
  }
});

router.get('/audit/actions', async (req, res) => {
  try {
    const actions = await listAuditActions();
    sendSuccess(res, { actions });
  } catch (err) {
    handleServiceError(res, req, err);
  }
});

router.get('/audit', async (req, res) => {
  try {
    const { limit, offset, action, from, to, userId } = req.query;
    const result = await listAuditLogs({ limit, offset, action, from, to, userId });
    sendSuccess(res, result);
  } catch (err) {
    handleServiceError(res, req, err);
  }
});

router.get('/system', async (req, res) => {
  try {
    const [info, health] = await Promise.all([getSystemInfo(), getDetailedHealth()]);
    sendSuccess(res, { ...info, health });
  } catch (err) {
    handleServiceError(res, req, err);
  }
});

router.patch('/system/settings', async (req, res) => {
  try {
    const patch = req.body || {};
    const updated = await setSettings(patch);

    await createAuditLog({
      userId: req.user.id,
      action: 'system.settings.updated',
      entityType: 'settings',
      metadata: { updated },
    });

    sendSuccess(res, { settings: updated });
  } catch (err) {
    handleServiceError(res, req, err);
  }
});

router.get('/email', async (_req, res) => {
  sendSuccess(res, getEmailStatus());
});

router.post('/email/test', async (req, res) => {
  try {
    const to = req.body?.to || req.user.email;
    const result = await sendTestEmail(to);

    await createAuditLog({
      userId: req.user.id,
      action: 'email.test.sent',
      entityType: 'email',
      metadata: { to, accepted: result.accepted },
    });

    sendSuccess(res, { ok: true, accepted: result.accepted, messageId: result.messageId });
  } catch (err) {
    handleServiceError(res, req, err);
  }
});

export default router;
