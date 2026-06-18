const { IDataProvider } = require('./IDataProvider');
const { JsonProvider } = require('./JsonProvider');
const { SAPODataProvider } = require('./SAPODataProvider');

function createProvider(type = process.env.HAP_DATA_PROVIDER || 'json') {
  switch (type.toLowerCase()) {
    case 'sap':
    case 'odata':
      return new SAPODataProvider();
    case 'json':
    default:
      return new JsonProvider();
  }
}

let _instance = null;

function getProvider() {
  if (!_instance) _instance = createProvider();
  return _instance;
}

function setProvider(provider) {
  _instance = provider;
}

module.exports = { IDataProvider, JsonProvider, SAPODataProvider, createProvider, getProvider, setProvider };
