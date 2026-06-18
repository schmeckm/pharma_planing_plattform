// Neo4j schema — run in Neo4j Browser for production deployment
// MVP 3.0: In-memory GraphRepository mirrors this model

CREATE CONSTRAINT packaging_order_id IF NOT EXISTS FOR (p:PackagingOrder) REQUIRE p.packagingOrderId IS UNIQUE;
CREATE CONSTRAINT batch_id IF NOT EXISTS FOR (b:Batch) REQUIRE b.batchId IS UNIQUE;
CREATE CONSTRAINT sales_order_id IF NOT EXISTS FOR (s:SalesOrder) REQUIRE s.salesOrderId IS UNIQUE;
CREATE CONSTRAINT country_code IF NOT EXISTS FOR (c:Country) REQUIRE c.countryCode IS UNIQUE;
CREATE CONSTRAINT rule_id IF NOT EXISTS FOR (r:Rule) REQUIRE r.ruleId IS UNIQUE;

// Sample seed (adapt from data/orders.json and data/batches.json)
// MERGE (c:Country {countryCode: 'DE'}) SET c.name = 'Germany';
// MERGE (b:Batch {batchId: 'BATCH-DE-001'})-[:APPROVED_FOR]->(c);
