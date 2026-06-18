const { randomUUID } = require('crypto');

function generateId(prefix) {
  return `${prefix}-${randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

module.exports = { generateId };
