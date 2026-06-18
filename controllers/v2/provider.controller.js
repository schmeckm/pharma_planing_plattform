const { getProvider } = require('../../providers');

function getInfo(_req, res, next) {
  try {
    const provider = getProvider();
    res.json(provider.getProviderInfo?.() || { name: provider.getProviderName() });
  } catch (err) { next(err); }
}

module.exports = { getInfo };
