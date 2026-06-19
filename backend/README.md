# Layered Backend Architecture

Pharmaceutical detailed scheduling backend with clean separation of concerns.

## Layers

```
Controller → Service → Repository Interface → Repository Implementation
```

- **Controllers** (`src/routes/`) — HTTP parsing, status codes, response formatting only
- **Services** (`src/domain/base/BaseEntityService.ts` + domain services) — business validation and rules
- **Repositories** (`src/infrastructure/persistence/`) — persistence only (JSON today, PostgreSQL Phase 2)

## Persistence

| Phase | Provider | Env |
|-------|----------|-----|
| 1 (MVP) | JSON files | `PERSISTENCE_PROVIDER=json` |
| 2 | PostgreSQL (parallel) | `PERSISTENCE_PROVIDER=postgres` |
| 3 | Feature flag selects implementation via `RepositoryFactory` |
| 4 | Migration script imports JSON → PostgreSQL |
| 5 | JSON becomes seed/mock data only |

## Commands

```bash
npm run build:backend   # Compile TypeScript → backend/dist/
npm run dev:backend     # Standalone layered API (port from .env)
npm run seed            # Copy seed JSON into HAP_DATA_DIR
npm run reset-data      # Overwrite live JSON from seeds
```

## Integration

The existing `server.js` loads `backend/dist/bridge.js` and registers admin CRUD routes at:

- `/api/v1/admin/data/:slug`
- `/api/v1/{entity-slug}` (REST aliases)

If the compiled backend is unavailable, the legacy JavaScript admin layer is used as fallback.

## ID Strategy

- Internal UUID (`id`) — technical primary key (auto-assigned on read/create)
- Business keys (`orderId`, `materialNumber`, …) — SAP/external references
- Source system fields on all entities for future SAP integration

## PostgreSQL (prepared, not active)

- `src/infrastructure/persistence/postgres/postgresClient.ts`
- `src/infrastructure/persistence/postgres/migrations/001_initial_schema.sql`
- `PostgresRepository` base class throws until Phase 2

## Data directory

Default: project root `data/` via `HAP_DATA_DIR`. Seed sources: `backend/data/seeds/` or root `data/`.
