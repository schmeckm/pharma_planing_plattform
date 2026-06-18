/**
 * Unified orders loader — orders.json (legacy combined) with fallback to split files.
 * Used by DataService and JsonProvider so packaging orders are never "lost".
 */
function loadOrdersData(repo) {
  const legacy = repo.read('orders');
  if (legacy?.packagingOrders?.length) {
    return {
      salesOrders: legacy.salesOrders || [],
      packagingOrders: legacy.packagingOrders,
      source: 'orders',
    };
  }

  const salesOrders = repo.readArray('salesOrders');
  const packagingOrders = repo.readArray('packagingOrders');
  if (salesOrders.length || packagingOrders.length) {
    return { salesOrders, packagingOrders, source: 'split' };
  }

  return { salesOrders: [], packagingOrders: [], source: 'empty' };
}

function syncSplitOrderFiles(repo) {
  const data = loadOrdersData(repo);
  if (!data.packagingOrders.length && !data.salesOrders.length) return data;

  repo.writeArray('packagingOrders', data.packagingOrders);
  repo.writeArray('salesOrders', data.salesOrders);

  const legacy = repo.read('orders');
  if (!legacy?.packagingOrders?.length) {
    repo.write('orders', {
      salesOrders: data.salesOrders,
      packagingOrders: data.packagingOrders,
    });
  }

  return data;
}

module.exports = { loadOrdersData, syncSplitOrderFiles };
