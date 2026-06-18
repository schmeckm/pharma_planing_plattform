# LLM Agents & Learning from Data

Real LLM agents (OpenAI / Azure OpenAI) with **RAG learning** from audit trail and planner approve/dismiss feedback.

## Architecture

```
Rule-based agents (baseline)
        ↓
LLM enrichAgentRun (RAG + chat completion)
        ↓
Recommendations (human approval required)

Audit trail + APPROVED/DISMISSED feedback → agentLearningIndex.json → embeddings → future RAG
```

## Setup

1. Copy `.env.example` to `.env` and set API keys:

```bash
OPENAI_API_KEY=sk-...
COPILOT_MODE=hybrid
AGENT_LLM_ENABLED=true
RAG_ENABLED=true
```

Or Azure OpenAI:

```bash
LLM_PROVIDER=azure-openai
AZURE_OPENAI_ENDPOINT=https://....openai.azure.com
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_DEPLOYMENT=gpt-4o
```

2. Start backend and index historical audit data:

```bash
npm start
curl -X POST http://localhost:8000/api/v3/llm/reindex \
  -H "X-User-Role: PLANNER" -H "X-User-Id: USR-PLANNER01"
```

3. Run agents (Tages-Wizard or Agent Console):

```bash
curl -X POST http://localhost:8000/api/v3/agents/run \
  -H "Content-Type: application/json" \
  -H "X-User-Role: PLANNER" \
  -d '{"trigger":"SCHEDULED_DAILY","horizonDays":7}'
```

Response includes `llmMode`: `HybridRules+LLM` | `rules-only` | `rules-fallback`.

## Learning loop

| Event | Stored in |
|-------|-----------|
| Audit decisions (`auditTrail.json`) | RAG index on reindex / bootstrap |
| Approve recommendation | `agentLearningIndex.json` outcome=approved |
| Dismiss recommendation | outcome=dismissed + dismissReason |

Each planner decision improves future RAG context for LLM agents and Copilot v3.

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v3/llm/status` | LLM configured, mode, learning stats |
| POST | `/api/v3/llm/reindex` | Re-index audit trail into learning store |
| POST | `/api/v3/agents/run` | Rule agents + LLM enrichment |
| POST | `/api/v3/copilot/ask` | Hybrid copilot (rules + LLM+RAG) |

## Modes

| `COPILOT_MODE` | Behavior |
|----------------|----------|
| `rules-only` | No LLM — previous MVP behavior |
| `hybrid` | Rules baseline + LLM synthesis with RAG (default) |
| `full` | LLM-first (same pipeline, higher LLM weight) |

## Compliance

- LLM never auto-executes allocations
- Evidence citations required (`learning:LRN-...`, rule checks)
- Fallback to rule-based agents on LLM error (`LLM_FALLBACK_TO_RULES=true`)
- All prompts/responses auditable via `LLM_LOG_PROMPTS=true`

## Files

- `services/llm/llmClient.js` — OpenAI/Azure chat + embeddings
- `services/llm/learningStore.js` — RAG index + feedback
- `services/llm/llmAgentService.js` — Agent enrichment + copilot
- `agents/toolRegistry.js` — MCP-style tools
- `data/agentLearningIndex.json` — persisted learning chunks
