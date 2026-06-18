/**
 * Resolve packaging order IDs for mass actions from table selection.
 */
export function resolveMassOrderIds(tableRows, selectedOrderIds, { filter } = {}) {
  const selected = new Set(selectedOrderIds || []);
  if (!selected.size) return { orderIds: [], error: 'select_orders' };

  const rows = tableRows.filter((r) => selected.has(r.packagingOrderId));
  const orderIds = rows
    .filter((r) => (filter ? filter(r) : true))
    .map((r) => r.packagingOrderId)
    .filter(Boolean);

  if (!orderIds.length) {
    return { orderIds: [], error: 'no_matching_orders' };
  }

  return { orderIds: orderIds.slice(0, 15), error: null };
}
