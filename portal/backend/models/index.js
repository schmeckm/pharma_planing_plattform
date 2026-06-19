import { DataTypes } from 'sequelize';

export let User;
export let Team;
export let Match;
export let Prediction;
export let BonusQuestion;
export let BonusPrediction;
export let Notification;
export let AuditLog;
export let Settings;
export let RefreshToken;
export let RevokedToken;
export let AICommentary;
export let AIInteractionLog;
export let Tenant;
export let TenantSubscription;

export function defineModels(sequelize) {
  Team = sequelize.define('Team', {
    name: { type: DataTypes.STRING, allowNull: false },
  });

  User = sequelize.define('User', {
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    passwordHash: { type: DataTypes.STRING },
    displayName: { type: DataTypes.STRING },
    googleId: { type: DataTypes.STRING, unique: true, allowNull: true },
    role: { type: DataTypes.ENUM('admin', 'user'), defaultValue: 'user' },
    language: { type: DataTypes.STRING, defaultValue: 'en' },
    preferences: { type: DataTypes.JSON, defaultValue: {} },
    emailVerified: { type: DataTypes.BOOLEAN, defaultValue: false },
    twoFactorEnabled: { type: DataTypes.BOOLEAN, defaultValue: false },
    twoFactorSecret: { type: DataTypes.STRING },
  });

  Match = sequelize.define('Match', {
    externalId: { type: DataTypes.STRING },
    kickoffTime: { type: DataTypes.DATE },
    status: { type: DataTypes.STRING, defaultValue: 'scheduled' },
    homeScore: { type: DataTypes.INTEGER },
    awayScore: { type: DataTypes.INTEGER },
    highlightsUrl: { type: DataTypes.STRING },
  });

  Prediction = sequelize.define('Prediction', {
    homeScore: { type: DataTypes.INTEGER, allowNull: false },
    awayScore: { type: DataTypes.INTEGER, allowNull: false },
    points: { type: DataTypes.INTEGER, defaultValue: 0 },
  });

  BonusQuestion = sequelize.define('BonusQuestion', {
    title: { type: DataTypes.STRING, allowNull: false },
    questionType: { type: DataTypes.STRING },
    options: { type: DataTypes.JSON },
    correctAnswer: { type: DataTypes.JSON },
    lockAt: { type: DataTypes.DATE },
  });

  BonusPrediction = sequelize.define('BonusPrediction', {
    answer: { type: DataTypes.JSON },
    points: { type: DataTypes.INTEGER, defaultValue: 0 },
  });

  Notification = sequelize.define('Notification', {
    type: { type: DataTypes.STRING },
    payload: { type: DataTypes.JSON },
    readAt: { type: DataTypes.DATE },
  });

  AuditLog = sequelize.define('AuditLog', {
    action: { type: DataTypes.STRING, allowNull: false },
    entityType: { type: DataTypes.STRING },
    entityId: { type: DataTypes.STRING },
    metadata: { type: DataTypes.JSON },
  });

  Settings = sequelize.define('Settings', {
    key: { type: DataTypes.STRING, unique: true },
    value: { type: DataTypes.JSON },
  });

  RefreshToken = sequelize.define('RefreshToken', {
    tokenHash: { type: DataTypes.STRING, allowNull: false },
    expiresAt: { type: DataTypes.DATE, allowNull: false },
    revokedAt: { type: DataTypes.DATE },
  });

  RevokedToken = sequelize.define('RevokedToken', {
    jti: { type: DataTypes.STRING, unique: true },
    expiresAt: { type: DataTypes.DATE },
  });

  AICommentary = sequelize.define('AICommentary', {
    content: { type: DataTypes.TEXT },
    locale: { type: DataTypes.STRING },
  });

  AIInteractionLog = sequelize.define('AIInteractionLog', {
    prompt: { type: DataTypes.TEXT },
    response: { type: DataTypes.TEXT },
  });

  Tenant = sequelize.define('Tenant', {
    name: { type: DataTypes.STRING, allowNull: false },
    slug: { type: DataTypes.STRING, unique: true },
  });

  TenantSubscription = sequelize.define('TenantSubscription', {
    stripeCustomerId: { type: DataTypes.STRING },
    status: { type: DataTypes.STRING },
  });

  User.belongsTo(Team);
  Team.hasMany(User);
  Prediction.belongsTo(User);
  Prediction.belongsTo(Match);
  User.hasMany(Prediction);
  Match.hasMany(Prediction);
  BonusPrediction.belongsTo(User);
  BonusPrediction.belongsTo(BonusQuestion);
  Notification.belongsTo(User);
  AuditLog.belongsTo(User);
  User.hasMany(AuditLog);
  RefreshToken.belongsTo(User);
  TenantSubscription.belongsTo(Tenant);
}
