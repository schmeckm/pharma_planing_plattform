# MVP 3.0 — AI Copilot Design

## 1. Evolution from MVP 2.0

| Capability | MVP 2.0 | MVP 3.0 |
|------------|---------|---------|
| Engine | Pattern matching | Graph + Rules + Twin + optional LLM |
| Context window | Single order | Multi-entity graph neighborhood |
| Questions | 5 templates | Open conversational |
| Evidence | Rule checks | Graph paths + rule checks + twin data |
| Actions | None | Suggest → trigger agent / simulation |

## 2. Copilot Architecture

```
User Question
     │
     ▼
┌─────────────┐     ┌─────────────┐
│  Intent     │────►│  Context    │
│  Classifier │     │  Assembler  │
└─────────────┘     └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │  Graph   │ │  Rules   │ │  Twin    │
        │  Query   │ │  Engine  │ │  Data    │
        └────┬─────┘ └────┬─────┘ └────┬─────┘
             └────────────┼────────────┘
                          ▼
                 ┌─────────────────┐
                 │ Reasoning Layer │
                 │ (Internal + LLM)│
                 └────────┬────────┘
                          ▼
                 ┌─────────────────┐
                 │ Explainable     │
                 │ Response + Cite │
                 └─────────────────┘
```

## 3. Supported Question Types

| Intent | Example | Data Sources |
|--------|---------|--------------|
| BATCH_SELECTION | "Why was Batch B002 selected?" | Audit, graph, FIFO engine |
| ORDER_BLOCKED | "Why is PO-10001235 blocked?" | Exceptions, rule checks |
| MARKET_GUIDANCE | "Which batch for Japan?" | Sequence state, graph, twin |
| TIMING_IMPACT | "Impact of moving order 3 days?" | What-if + twin T+7 |
| RISK_EXPLAIN | "What's the risk for DE market?" | Predictive engine |
| INVENTORY | "Can we cover JP demand?" | Twin + SC agent context |

## 4. Response Format (Explainable)

```json
{
  "answer": "Batch BATCH-JP-002 was selected because it is the next compliant batch in the Japan continuous sequence (B01→B02→B03). It passes TRIC, RMSL (36 months remaining), and quality release status.",
  "confidence": 0.92,
  "intent": "BATCH_SELECTION",
  "evidence": [
    { "type": "RULE_CHECK", "id": "RULE-005", "result": "PASSED" },
    { "type": "GRAPH_PATH", "path": "PO-20004→DEPENDS_ON→PO-20003→ALLOCATED_TO→BATCH-JP-001" },
    { "type": "TWIN", "projection": "Sequence gap closed if PO-20003 executed by T+3" }
  ],
  "suggestedActions": [
    { "label": "Run What-If +3 days", "action": "what_if", "params": {} },
    { "label": "View Japan sequence state", "action": "navigate", "route": "/rules" }
  ],
  "disclaimer": "Decision support only. Production allocation requires planner approval."
}
```

## 5. LLM Integration (Optional, Governed)

| Mode | Description |
|------|-------------|
| **Rules-only** (default MVP 3) | No external LLM; graph + template synthesis |
| **Hybrid** | LLM polishes internal reasoning; evidence required |
| **Full LLM** | MVP 4+ with Azure OpenAI in VNet; PHI/PII filtered |

**Guardrails:**
- LLM never invents batch IDs — must cite graph/query results
- All LLM prompts logged; responses audited
- Fallback to rules-only on LLM failure

## 6. MCP Integration

Copilot exposed as MCP server for external tools (Cursor, SAP Joule):

```
Tool: allocation_copilot_ask
Input: { question, packagingOrderId?, horizon? }
Output: ExplainableResponse
```

## 7. UI Design (Vue)

- Full-page Copilot with conversation history
- Evidence expandable panels (rule / graph / twin tabs)
- "Ask about this order" context button on Simulation panel
- Suggested follow-up chips

## 8. GMP Compliance

- Copilot responses marked **non-GxP decision support**
- No autonomous execution from Copilot in MVP 3.0
- Audit: question + response + evidence hash stored 7 years
