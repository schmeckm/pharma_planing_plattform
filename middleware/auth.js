const PERMISSIONS = {
  PLANNER: [
    'orders:read', 'batches:read', 'allocation:simulate', 'allocation:execute',
    'exceptions:read', 'exceptions:comment', 'whatif:run', 'copilot:use',
    'jobs:read', 'jobs:create', 'agents:run', 'rules:read', 'audit:read',
  ],
  QA: [
    'orders:read', 'batches:read', 'exceptions:read', 'exceptions:resolve',
    'audit:read', 'rules:read', 'copilot:use', 'agents:run',
  ],
  SUPPLY_CHAIN: [
    'orders:read', 'batches:read', 'allocation:simulate', 'allocation:execute',
    'exceptions:read', 'exceptions:comment', 'exceptions:escalate',
    'jobs:read', 'jobs:create', 'agents:run', 'whatif:run', 'copilot:use', 'audit:read', 'rules:read',
  ],
  ADMIN: ['*', 'users:manage', 'rules:write'],
  VIEWER: ['orders:read', 'batches:read', 'audit:read', 'rules:read', 'exceptions:read'],
};

const ROLE_HIERARCHY = ['VIEWER', 'PLANNER', 'QA', 'SUPPLY_CHAIN', 'ADMIN'];

function hasPermission(role, permission) {
  if (!role) return false;
  const perms = PERMISSIONS[role] || [];
  if (perms.includes('*')) return true;
  return perms.includes(permission);
}

function authenticate(req, _res, next) {
  const userId = req.headers['x-user-id'] || 'USR-PLANNER01';
  const role = req.headers['x-user-role'] || 'PLANNER';
  req.user = { userId, role, displayName: req.headers['x-user-name'] || 'Default User' };
  next();
}

function authorize(...requiredPermissions) {
  return (req, res, next) => {
    const allowed = requiredPermissions.every((p) => hasPermission(req.user?.role, p));
    if (!allowed) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: `Role ${req.user?.role} lacks permission: ${requiredPermissions.join(', ')}`,
      });
    }
    next();
  };
}

module.exports = { PERMISSIONS, ROLE_HIERARCHY, hasPermission, authenticate, authorize };
