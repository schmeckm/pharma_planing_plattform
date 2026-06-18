/**
 * In-memory Knowledge Graph — Neo4j API-compatible scaffold for MVP 3.0.
 * Production: replace with neo4j-driver Bolt connection.
 */
class GraphRepository {
  constructor() {
    this.nodes = new Map();
    this.relationships = [];
  }

  addNode(label, properties) {
    const key = properties.id
      || properties.batchId
      || properties.packagingOrderId
      || properties.ruleId
      || properties.countryCode
      || properties.lineId
      || properties.lotId
      || properties.inspectionLotId
      || properties.salesOrderId
      || properties.customerName
      || properties.marketId
      || properties.plantId;
    const id = `${label}:${key}`;
    this.nodes.set(id, { label, properties: { ...properties } });
    return id;
  }

  addRelationship(fromId, type, toId, props = {}) {
    this.relationships.push({ from: fromId, type, to: toId, properties: props });
  }

  findNode(label, key, value) {
    for (const [id, node] of this.nodes) {
      if (node.label === label && node.properties[key] === value) return { id, ...node };
    }
    return null;
  }

  query(pattern) {
    // Simplified query interpreter for common patterns
    if (pattern.type === 'ALLOCATION_EXPLAIN') {
      const po = this.findNode('PackagingOrder', 'packagingOrderId', pattern.orderId);
      if (!po) return null;
      const allocRel = this.relationships.find((r) => r.from === po.id && r.type === 'ALLOCATED_TO');
      const batch = allocRel ? this.nodes.get(allocRel.to) : null;
      const countryRels = this.relationships.filter((r) => r.from === po.id && r.type === 'SHIPPED_TO');
      const countries = countryRels.map((r) => this.nodes.get(r.to)).filter(Boolean);
      const tricRels = batch
        ? this.relationships.filter((r) => r.from === batch.id && r.type === 'APPROVED_FOR')
        : [];
      return { order: po, batch, countries, tricApprovals: tricRels.map((r) => this.nodes.get(r.to)) };
    }

    if (pattern.type === 'MARKETS_AT_RISK') {
      const atRisk = [];
      for (const [, node] of this.nodes) {
        if (node.label === 'Batch' && node.properties.riskLevel === 'HIGH') {
          const approved = this.relationships
            .filter((r) => r.from.startsWith('Batch:') && r.type === 'APPROVED_FOR')
            .map((r) => this.nodes.get(r.to))
            .filter(Boolean);
          atRisk.push({ batch: node, markets: approved });
        }
      }
      return atRisk;
    }

    if (pattern.type === 'JAPAN_SEQUENCE') {
      return this.relationships
        .filter((r) => r.type === 'DEPENDS_ON')
        .map((r) => ({
          from: this.nodes.get(r.from),
          to: this.nodes.get(r.to),
        }));
    }

    return [];
  }

  getStats() {
    const labels = {};
    const relationshipTypes = {};
    for (const [, node] of this.nodes) {
      labels[node.label] = (labels[node.label] || 0) + 1;
    }
    for (const rel of this.relationships) {
      relationshipTypes[rel.type] = (relationshipTypes[rel.type] || 0) + 1;
    }
    return {
      nodeCount: this.nodes.size,
      relationshipCount: this.relationships.length,
      labels,
      relationshipTypes,
    };
  }
}

module.exports = { GraphRepository };
