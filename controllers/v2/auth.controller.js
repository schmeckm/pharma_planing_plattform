const { AuthService } = require('../../services/authService');
const svc = new AuthService();

function me(req, res, next) {
  try {
    res.json(svc.getCurrentUser(req.user.userId, req.user.role));
  } catch (err) { next(err); }
}

function login(req, res, next) {
  try {
    const user = svc.login(req.body.username);
    if (!user) return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid credentials' });
    res.json(user);
  } catch (err) { next(err); }
}

function listUsers(req, res, next) {
  try {
    res.json({ items: svc.listUsers() });
  } catch (err) { next(err); }
}

function getFeatures(req, res, next) {
  try {
    res.json(svc.getFeatureCatalog());
  } catch (err) { next(err); }
}

function getRoleDefaults(req, res, next) {
  try {
    const role = req.params.role || req.query.role;
    res.json({
      role,
      featureIds: svc.getDefaultFeaturesForRole(role),
    });
  } catch (err) { next(err); }
}

function updateUserFeatures(req, res, next) {
  try {
    const { enabledFeatures } = req.body;
    const updated = svc.updateUserFeatures(
      req.params.userId,
      enabledFeatures,
      req.user.userId,
    );
    res.json(updated);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
}

module.exports = {
  me, login, listUsers, getFeatures, getRoleDefaults, updateUserFeatures,
};
