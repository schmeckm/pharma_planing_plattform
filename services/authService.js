const { getProvider } = require('../providers');
const { PERMISSIONS } = require('../middleware/auth');
const {
  getCatalog,
  enrichUserWithFeatures,
  getDefaultFeatureIdsForRole,
  validateFeaturePayload,
} = require('./featureService');

class AuthService {
  constructor(provider = getProvider()) {
    this.provider = provider;
  }

  _withAuthFields(user) {
    if (!user) return null;
    return enrichUserWithFeatures({
      ...user,
      permissions: PERMISSIONS[user.role] || [],
    });
  }

  getCurrentUser(userId, role) {
    const user = this.provider.getUserById(userId);
    if (user) return this._withAuthFields(user);
    return this._withAuthFields({
      userId,
      role,
      displayName: 'Unknown User',
    });
  }

  listUsers() {
    return this.provider.getUsers().map((u) => this._withAuthFields(u));
  }

  getFeatureCatalog() {
    return getCatalog();
  }

  getDefaultFeaturesForRole(role) {
    return getDefaultFeatureIdsForRole(role);
  }

  updateUserFeatures(userId, enabledFeatures, actorUserId) {
    const validation = validateFeaturePayload(enabledFeatures);
    if (!validation.ok) {
      const err = new Error(validation.error);
      err.status = 400;
      throw err;
    }
    const user = this.provider.getUserById(userId);
    if (!user) {
      const err = new Error('User not found');
      err.status = 404;
      throw err;
    }
    const updates = {
      featuresUpdatedAt: new Date().toISOString(),
      featuresUpdatedBy: actorUserId,
    };
    if (validation.value == null) {
      updates.enabledFeatures = null;
    } else {
      updates.enabledFeatures = validation.value;
    }
    const updated = this.provider.updateUser(userId, updates);
    return this._withAuthFields(updated);
  }

  login(username) {
    const users = this.provider.getUsers();
    const user = users.find((u) => u.username === username && u.active);
    if (!user) return null;
    return {
      ...this._withAuthFields(user),
      token: Buffer.from(`${user.userId}:${user.role}`).toString('base64'),
    };
  }
}

module.exports = { AuthService };
