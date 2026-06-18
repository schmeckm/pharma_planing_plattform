# Portal Blueprint (Boilerplate) – WM 2026 Tippspiel

Ziel dieses Dokuments: Das bestehende Portal als **sauber wiederverwendbares Boilerplate/Framework** beschreiben – inkl. Stack, Struktur, Architektur, Features und Empfehlungen, was für ein generisches “Prediction Portal” **behalten, generalisiert, verbessert oder entfernt** werden sollte.

> Hinweis: Dieses Repo ist “WM 2026”-spezifisch (Seed, Texte, Branding). Im Boilerplate sollten diese Teile als **Feature-Module** und **Konfiguration** ausgelagert werden.

---

## 1) Technology stack

### Frontend
- **Framework**: Vue \(SPA\) – `vue@^3.5.13` (`frontend/package.json`)
- **Routing**: Vue Router – `vue-router@^4.5.0` (`frontend/src/router/index.js`)
- **State management**: Pinia – `pinia@^2.3.0` (`frontend/src/main.js`, `frontend/src/stores/*`)
- **i18n**: `vue-i18n@^9.14.5` (`frontend/src/i18n/*`, `frontend/src/locales/*`)
- **HTTP client**: Axios – `axios@^1.7.9` (`frontend/src/services/api.js`)
- **Charts**: Chart.js – `chart.js@^4.4.8`, `vue-chartjs@^5.3.2`
- **Realtime**: Socket.IO Client – `socket.io-client@^4.8.1` (`frontend/src/services/socket.js`)
- **Error monitoring**: Sentry – `@sentry/vue@^10.56.0` (`frontend/src/sentry/*`, init in `frontend/src/main.js`)
- **PWA**: Vite PWA Plugin – `vite-plugin-pwa@^0.21.1` (`frontend/vite.config.js`)
- **UI/CSS**: Kein externes UI-Framework. **Custom Design Tokens** + Komponenten-CSS über `frontend/src/styles/main.css`

### Backend
- **Runtime**: Node.js (CI nutzt Node 20) (`.github/workflows/ci.yml`)
- **Framework**: Express – `express@^4.21.2` (`backend/package.json`)
- **Security middleware**: `helmet@^8.0.0`, `cors@^2.8.5`
- **Auth**:
  - JWT: `jsonwebtoken@^9.0.2` (`backend/middleware/authMiddleware.js`)
  - Password hashing: `bcryptjs@^2.4.3` (`backend/models/User.js`)
  - Refresh Tokens: eigenes Modell + Service (`backend/models/RefreshToken.js`, `backend/services/refreshTokenService.js`)
  - Token blacklist/revocation: (`backend/services/tokenBlacklistService.js`, `backend/models/RevokedToken.js`)
  - Google SSO (OIDC): `openid-client@^5.7.1` (`backend/routes/authRoutes.js`, `backend/services/oauthService.js`)
  - 2FA TOTP: `speakeasy@^2.0.0` (`backend/services/twoFactorService.js`)
- **ORM/DB**: Sequelize – `sequelize@^6.37.5`
  - SQLite dev: `sqlite3@^5.1.7`
  - Postgres prod: `pg@^8.13.3`, `pg-hstore@^2.3.4`
- **Realtime**: Socket.IO – `socket.io@^4.8.1` (`backend/services/socketService.js`)
- **Scheduler**: `node-cron@^3.0.3` (`backend/services/schedulerService.js`)
- **Email**: `nodemailer@^6.10.0` + eigene Services (`backend/services/emailService.js`, Reminder/Digest Services)
- **AI**: `openai@^4.85.4` + Guardrails/Feature Flags (`backend/services/llmService.js`, `backend/services/aiGuardrailService.js`)
- **Monitoring**:
  - Sentry Backend: `@sentry/node@^10.56.0` (`backend/instrument.js`)
  - Prometheus metrics: `prom-client@^15.1.3` (`backend/middleware/metricsMiddleware.js`)
- **Rate limiting**: `express-rate-limit@^7.5.0` + optional Redis store (`backend/middleware/rateLimiter.js`, `backend/middleware/redisRateLimitStore.js`)
- **File uploads**: `multer@^1.4.5-lts.1` (Uploads unter `/uploads` in `backend/app.js`)
- **Exports**: `exceljs@^4.4.0`, CSV parsing `csv-parse@^5.6.0`
- **Billing \(optional\)**: Stripe – `stripe@^22.2.0` (`backend/routes/billingRoutes.js`)

### Build tools & testing
- **Frontend build**: Vite – `vite@^6.0.7` (`frontend/vite.config.js`)
- **Frontend tests**: Vitest – `vitest@^3.0.5` (`frontend/package.json`)
- **Backend tests**: Node test runner + Supertest + Coverage via c8 (`backend/package.json`)
- **E2E**: Playwright – `@playwright/test@^1.51.0` (`e2e/package.json`)

### Deployment setup
- **Local dev compose**: `docker-compose.yml`
  - SQLite default backend, optional Postgres profile
  - Frontend build args: `VITE_APP_URL`
- **Production compose**: `docker-compose.prod.yml`
  - Postgres + Redis + backend + nginx-frontend
  - Healthchecks \(API + DB + Redis\)
- **Docker images**:
  - Backend: `backend/Dockerfile` \(node:20-alpine\)
  - Frontend: `frontend/Dockerfile` \(build stage node:20-alpine → nginx\)
- **CI/CD**:
  - Tests: `.github/workflows/ci.yml` (SQLite backend tests, Postgres auth smoke test, frontend tests)
  - Image publish: `.github/workflows/docker-publish.yml` to GHCR (tags: latest, version, sha)
- **Portainer env**: `.env.docker.example` (Root `.env` für Portainer “Load variables from .env”)

---

## 2) Project structure

### Repo root
- **`.github/`**: CI + Docker publish workflows
- **`backend/`**: Node/Express API, scheduler, DB models, services
- **`frontend/`**: Vue SPA + PWA, nginx deployment config
- **`docs/`**: Deployment-Anleitungen (z. B. Portainer)
- **`e2e/`**: Playwright E2E tests
- **`scripts/`**: Hilfsskripte (repo-/buildbezogen)
- **`docker-compose.yml`**: lokale Entwicklung
- **`docker-compose.prod.yml`**: Produktions-Stack (Postgres/Redis)
- **`.env.docker.example`**: Portainer/Prod-Env Vorlage (Root)
- **`README.md`**: Produkt-/Featureübersicht und Betriebshinweise

### Backend \(wichtige Ordner\)
- **`backend/server.js`**: Prozess-Entry, init DB, sockets, scheduler, bootstrap tasks, shutdown hooks
- **`backend/app.js`**: Express app wiring (helmet/cors/json/raw-body, metrics, request logging, route mounting, error middleware)
- **`backend/routes/`**: Express Router pro Domain (Auth, Matches, Predictions, Admin, Billing, …)
- **`backend/models/`**: Sequelize models + associations (`backend/models/index.js`)
- **`backend/services/`**: Business logic layer (AI, sync, scoring, emails, scheduler, youtube highlights, …)
- **`backend/middleware/`**: Auth/Role guard, locale, rate limits, metrics/logging, display restrictions
- **`backend/database/`**: DB helpers, paths, seed, migrations (`backend/database/migrate.js`)
- **`backend/utils/`**: Shared helpers (API responses, JWT utils, validation helpers)
- **`backend/locales/`**: Backend i18n keys für Fehler/Emails/Systemtexte
- **`backend/tests/`**: Unit/Integration tests

### Frontend \(wichtige Ordner\)
- **`frontend/src/main.js`**: App bootstrap (Pinia/i18n/router/theme), stale-build recovery, Sentry init
- **`frontend/src/router/index.js`**: Routen + Guards (auth/admin) + socket connect/disconnect
- **`frontend/src/stores/`**: Pinia stores (auth/theme/locale/settings/notifications/toasts)
- **`frontend/src/services/`**: API client (Axios) + socket client
- **`frontend/src/layouts/`**: Layout shells (Public/App/Admin)
- **`frontend/src/views/`**: Page views (User + `views/admin/*`)
- **`frontend/src/components/`**: Reusable UI building blocks
- **`frontend/src/styles/main.css`**: Design tokens + global styles
- **`frontend/src/locales/`**: Frontend UI translations
- **`frontend/vite.config.js`**: Vite config + PWA config + dev proxy
- **`frontend/nginx.conf`**: SPA routing + API/socket forwarding in container

---

## 3) Core architecture

### 3.1 Frontend architecture
- **SPA + layouts**: Routen hängen unter `PublicLayout`, `AppLayout`, `AdminLayout` (`frontend/src/router/index.js`)
- **Guards/Access**:
  - `requiresAuth` → redirect `/login`
  - `requiresAdmin` → redirect `/dashboard`
  - `publicDisplay` bypassed
- **State**:
  - Auth ist persisted in `localStorage` (`token`, `refreshToken`, `user`) via `frontend/src/stores/authStore.js`
  - Theme/Locale/Settings in eigenen Stores
- **API client pattern** (`frontend/src/services/api.js`):
  - Request interceptor: Bearer token + `X-Language` + `lang` query on GET
  - Response interceptor: bei 401 → **Refresh token** Flow (`/api/auth/refresh`) → retry; sonst logout + redirect
- **Realtime** (`frontend/src/services/socket.js`):
  - connect bei auth-only routes, join rooms: user, leaderboard, matches
  - separates “display socket” für public display routes
- **Styling**:
  - Design Tokens via CSS variables (dark/light) in `frontend/src/styles/main.css`
  - Kein Tailwind/Bootstrap – Komponenten stylen selbst

### 3.2 Backend architecture
- **Express composition** (`backend/app.js`):
  - Security: helmet, CORS, upload static, raw-body webhook scope
  - Observability: requestId → metrics → requestLogger (JSON logs)
  - Locale middleware auf `/api` und `/api/v1`
  - Routes werden gebündelt und **zweimal** gemountet: `/api` und `/api/v1` (`backend/utils/mountApiRoutes.js`)
  - Global error handler + optional Sentry capture
- **Process orchestration** (`backend/server.js`):
  - `validateEnv()` (prod hard-fails bei kritischen env issues)
  - `initDatabase()` (sequelize.sync + migrations + seeds)
  - optional Redis init, socket init, scheduler start, bootstrap admin, WM schedule seed

### 3.3 API design
- **Base paths**: `/api/*` und `/api/v1/*` (parallel)
- **Routing by domain**: `backend/routes/*.js` (z. B. `authRoutes`, `matchRoutes`, `bonusRoutes`, `billingRoutes`, …)
- **Response conventions**:
  - Errors über `sendError(res, req, status, key)` geben `{ error, code }` zurück (`backend/utils/apiResponse.js`)
  - Locale-aware: `req.locale` wird aus `X-Language`, `Accept-Language`, query `lang`, body `language`, oder `req.user.language` gesetzt (`backend/middleware/localeMiddleware.js`)
- **Rate limiting**:
  - global `apiLimiter` auf `/api` und `/api/v1` (prod stärker), plus spezielle limiter für Auth/Leaderboard/Display (`backend/middleware/rateLimiter.js`)
  - optional Redis store für multi-instance/consistency

### 3.4 Authentication flow
- **Access token**: JWT Bearer (`Authorization: Bearer <token>`)
  - geprüft in `backend/middleware/authMiddleware.js` inkl. blacklist check
  - `req.user` wird DB-seitig geladen (inkl. Team)
- **Refresh token**:
  - Frontend speichert `refreshToken` und nutzt `/auth/refresh`
  - Backend verwaltet Rotation/Revocation via `refreshTokenService`
- **Email/password registration**:
  - optional Email verification (backend setting-driven) in `backend/routes/authRoutes.js`
  - password rules via `backend/utils/passwordValidation.js`
- **Google SSO**:
  - `/api/auth/google` initiert OIDC
  - callback erzeugt exchange code, frontend tauscht via `/auth/exchange` (und ggf. `/complete-sso`)
- **2FA**:
  - Setup/Enable/Disable via `/auth/2fa/*`

### 3.5 Role and permission model
- **Role field**: `User.role ∈ { admin, user }` (`backend/models/User.js`)
- **Admin endpoints**: geschützt durch `authMiddleware` + `adminMiddleware` (`backend/middleware/adminMiddleware.js`)
- **Frontend**:
  - `authStore.isAdmin` aus `user.role`
  - Router guard verhindert Zugriff auf `/admin/*`

### 3.6 Data model (high-level)
Zentrale Entities (Sequelize Models in `backend/models/*`):
- **User**: Identity, role, language, profile fields (favorite team, top scorer), email verification, 2FA flags
- **Team**: Firmen-/Abteilungsteam
- **Match**: Spielplan, Status, kickoffTime, Ergebnis, `highlightsUrl` (optional)
- **Prediction**: Tipp pro User+Match
- **BonusQuestion** + **BonusPrediction**: Sonderwetten, options/correctAnswer JSON fields
- **Notification**: In-app notifications (socket-driven)
- **AuditLog**: Admin-Aktionen
- **Settings**: Feature flags/behavior toggles (registration, display mode, etc.)
- **RefreshToken** + **RevokedToken**: Session management
- **AICommentary / AIInteractionLog**: AI output + interaction logs
- **Tenant / TenantSubscription**: SaaS/Billing (optional, aktuell MVP)

### 3.7 Error handling
- **Per-route**: `try/catch` + `sendError` mit i18n key
- **Global**: Express error middleware (`backend/app.js`) – in production keine Stacktraces, optional Sentry capture
- **Client**: Axios interceptor zeigt 429 toast, 401 triggers refresh+logout (`frontend/src/services/api.js`)

### 3.8 Logging & monitoring
- **Request logs**: JSON in stdout (`backend/middleware/requestLogger.js`) mit `requestId`, `userId`, `durationMs`
- **Request correlation**: `X-Request-Id` middleware (`backend/middleware/requestIdMiddleware.js`)
- **Metrics**: Prometheus `/api/metrics` admin-only (`backend/middleware/metricsMiddleware.js`)
- **Sentry**:
  - Backend init in `backend/instrument.js` (Authorization header scrub)
  - Frontend init in `frontend/src/main.js` (idle callback)

### 3.9 Environment variable usage
- **Load order**: `backend/config/loadEnv.js` lädt `backend/.env` via dotenv, aber **Docker env wins** (override: false)
- **Validation**: `backend/config/validateEnv.js`:
  - Production hard errors z. B. weak `JWT_SECRET`, sqlite in production, CORS misconfig
- **Env templates**:
  - Backend: `backend/.env.example`
  - Frontend (Vite): `frontend/.env.example` (nur `VITE_*` exposed)
  - Portainer: `.env.docker.example` (root)

---

## 4) Main portal features

### Authentication & account lifecycle
- **Login/Register/Verify email/Forgot+Reset password** (Frontend routes: `frontend/src/router/index.js`, Backend: `backend/routes/authRoutes.js`)
- **Refresh token sessions** (Frontend: `frontend/src/services/api.js`)
- **Google SSO + “complete registration”** (Exchange code flow)
- **2FA (TOTP)** via Profile

### Core gameplay
- **Matches list** (filters open/finished/missing, group/knockout) (`backend/routes/matchRoutes.js`, `frontend/src/views/MatchesView.vue`)
- **Predictions** (create/update, lock before kickoff) (`backend/services/matchLockService.js`, prediction routes)
- **Leaderboard** (overall + breakdown, snapshots, CSV/Excel exports) (see `backend/routes/leaderboardRoutes.js`, export services)
- **Team ranking** (avg per member) + team performance views
- **Group standings + bracket** (tournament visualization)

### Bonus system
- **Bonus questions** with option types (teams, players, favorite team progress), lock times, resolution outcomes
  - User list & predictions: `backend/routes/bonusRoutes.js`
  - Admin management: `backend/routes/bonusRoutes.js` (admin router) + `frontend/src/views/admin/AdminBonusView.vue`
  - Aggregated “community picks” stats: `GET /bonus-questions/:id/stats`

### Realtime / notifications
- **Socket rooms**: user-specific, leaderboard, matches (`backend/services/socketService.js`, `frontend/src/services/socket.js`)
- **In-app notifications** store + socket listener (`frontend/src/stores/notificationStore.js`)

### Emails / automation
- **Reminder emails** + **Morning digest** (multi-locale formatting) (`backend/services/reminderEmailService.js`, `backend/services/morningDigestService.js`)
- **Scheduler** for sync/reminders/backups/etc. (`backend/services/schedulerService.js`)

### Admin area (RBAC-protected)
- **Users** (manage roles, statuses)
- **Matches** (edit schedule/results, highlightsUrl suggestions)
- **Sync** (football API)
- **Bonus questions**, **scoring rules**, **prizes**
- **Notifications**, **audit log**, **backup/export**, **system health/settings**
- **AI admin assistant** (optional)

### API integrations
- **Football Data provider** (schedule/results/live) + optional alternate providers (see `backend/services/providers/*`)
- **YouTube highlights** (optional suggestions + autofill) (see `backend/services/youtubeHighlightsService.js`, `backend/services/highlightsAutofillService.js`)
- **TheSportsDB + Wikimedia** (player images + venue enrichment) (`backend/services/*player*`, `backend/services/*wikimedia*`)
- **Stripe billing (optional)** (`backend/routes/billingRoutes.js`, gated by `SAAS_ENABLED=true`)

---

## 5) Reusable boilerplate elements (what to extract)

### Frontend (reusable)
- **App bootstrap & resilience**: stale build recovery + SW cache cleanup (`frontend/src/main.js`)
- **Auth store pattern**: localStorage persistence, `fetchMe`, SSO exchange, 2FA actions (`frontend/src/stores/authStore.js`)
- **API client**: Axios interceptors for auth + locale + refresh token + toast patterns (`frontend/src/services/api.js`)
- **Route-based access control**: `meta.requiresAuth`, `meta.requiresAdmin`, `publicDisplay` (`frontend/src/router/index.js`)
- **Socket client abstraction**: auth socket + display socket, event helpers (`frontend/src/services/socket.js`)
- **Layouts**:
  - `PublicLayout` for auth/legal pages
  - `AppLayout` for logged-in app shell (sidebar/nav/bottom nav/status bar)
  - `AdminLayout` for admin shell
- **Design token system**: dark/light CSS variables + shadows/radii (`frontend/src/styles/main.css`)
- **Navigation composables**: `useUserNavLinks` / `useAdminNavLinks` for dynamic nav + i18n labels

### Backend (reusable)
- **App wiring**: helmet/cors/parsers/static uploads + route mounting (`backend/app.js`)
- **Dual API base paths** (`/api` + `/api/v1`) pattern (`backend/utils/mountApiRoutes.js`)
- **Locale-aware API responses**: `sendError/sendSuccess` returning `{ error, code }` (`backend/utils/apiResponse.js`)
- **JWT auth middleware** with blacklist support (`backend/middleware/authMiddleware.js`)
- **Admin RBAC middleware** (`backend/middleware/adminMiddleware.js`)
- **Request correlation + JSON request logs** (`backend/middleware/requestIdMiddleware.js`, `backend/middleware/requestLogger.js`)
- **Prometheus metrics** middleware + admin endpoint (`backend/middleware/metricsMiddleware.js`)
- **Rate limiting** with optional Redis store (`backend/middleware/rateLimiter.js`)
- **Sequelize “safe sync + migrations” strategy**:
  - `sequelize.sync()` for table creation
  - `database/migrate.js` for additive column/index changes
- **Scheduler service** (cron), optional Redis for multi-instance coordination
- **Sentry integration** with header scrubbing (`backend/instrument.js`)

---

## 6) Keep / improve / remove / generalize (for a reusable boilerplate)

### Keep (strong boilerplate candidates)
- **Frontend auth + refresh token interceptor** (`frontend/src/services/api.js`) – solide UX und robust gegen abgelaufene Sessions
- **Route meta guards + layout split** (`frontend/src/router/index.js`) – klare Trennung public/app/admin
- **Locale propagation end-to-end** (frontend `X-Language` + backend `localeMiddleware` + i18n keys)
- **Observability basics**: requestId + JSON logs + metrics + Sentry hooks
- **Dockerized deploy**: multi-stage frontend build → nginx, backend node image, compose for dev/prod
- **Env validation** in production (`backend/config/validateEnv.js`)

### Improve (recommended refactors before “boilerplate extraction”)
- **Horizontal scaling safety**:
  - Scheduler + sockets sind aktuell primär für **single backend instance** gedacht.
  - Boilerplate: distributed locks (Redis), leader-election, separate “worker” service für cron jobs.
- **API versioning**:
  - Aktuell `/api` und `/api/v1` sind parallel gemountet (duplikativ).
  - Boilerplate: klare Strategie (nur `/api/v1`, oder `/api` alias) + deprecation policy.
- **Type safety / contracts**:
  - Boilerplate: OpenAPI spec + generated clients, oder mindestens shared DTO schema (zod/yup) für request/response validation.
- **Validation**:
  - Viele Routes validieren manuell; Boilerplate: request validation middleware (schema-first).
- **Auth token storage (frontend)**:
  - localStorage ist pragmatisch, aber XSS-sensitiv. Boilerplate optional: httpOnly cookie mode.
- **UI component system**:
  - Der Style ist konsistent, aber “custom everywhere”.
  - Boilerplate: kleines internes component kit (Buttons/Inputs/Dialogs/Tables) + a11y baseline.
- **Multi-tenant/SaaS**:
  - Modelle existieren, Billing ist MVP.
  - Boilerplate: entweder konsequent ausbauen (tenant scoping überall) oder als optionales Modul entkoppeln.

### Remove (tournament-specific / product-specific)
- **WM2026 branding/texts**: Namen, Turnier-spezifische Copy/Manifest (`frontend/vite.config.js`, `README.md`)
- **WM2026 schedule seed & “official” assumptions** (`backend/services/wm2026ScheduleSeedService.js`, seeds)
- **Hard-coded competition defaults** (competition IDs, seasons, tournament dates)

### Generalize (turn into reusable modules)
- **Prediction domain**:
  - Generalize “Match + Prediction + Locking + Scoring rules” als Kernmodul.
  - Make scoring a plug-in strategy (exact/diff/trend already exists conceptually).
- **Bonus questions**:
  - Generalize question types + option providers (teams, players) as adapters.
- **External providers**:
  - Make `FOOTBALL_API_PROVIDER` and YouTube highlights provider interface-based modules.
- **Emails**:
  - Extract “templating + locale formatting + scheduling” as a generic notification module.
- **Realtime events**:
  - Define an explicit event catalog (leaderboardUpdated, matchUpdated, notificationCreated) + client subscriptions.

---

## Boilerplate target shape (suggested)

Wenn du daraus ein “clean boilerplate” bauen willst, ist eine sinnvolle Zielstruktur:
- `packages/frontend` (Vue app)
- `packages/backend` (API)
- optional `packages/worker` (scheduler-only)
- `packages/shared` (DTOs, validation schemas, i18n key contracts)
- `infra/` (docker compose, k8s manifests optional)

Mit Feature-Flags/Modules:
- `modules/auth` (local + SSO + 2FA optional)
- `modules/predictions` (matches, predictions, scoring)
- `modules/leaderboard` (snapshots, exports)
- `modules/bonus` (optional)
- `modules/ai` (optional)
- `modules/billing` (optional)

