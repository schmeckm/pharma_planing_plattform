# Portal project structure

Scaffold aligned with [PORTAL_BLUEPRINT.md](../docs/PORTAL_BLUEPRINT.md) section 2.

```
portal/
├── .github/workflows/          # CI + Docker publish
├── backend/
│   ├── server.js               # Process entry
│   ├── app.js                  # Express wiring
│   ├── instrument.js           # Sentry init
│   ├── config/                 # loadEnv, validateEnv
│   ├── routes/                 # Domain routers
│   ├── models/                 # Sequelize models + associations
│   ├── services/               # Business logic (+ providers/)
│   ├── middleware/             # Auth, locale, rate limits, metrics, logging
│   ├── database/               # initDatabase, migrate
│   ├── utils/                  # apiResponse, mountApiRoutes, validation
│   ├── locales/                # Backend i18n (en, de)
│   └── tests/
├── frontend/
│   └── src/
│       ├── main.js
│       ├── router/
│       ├── stores/             # auth, theme, locale, settings, notifications, toasts
│       ├── services/           # api (Axios), socket
│       ├── layouts/            # Public, App, Admin
│       ├── views/              # + admin/
│       ├── components/
│       ├── composables/        # useUserNavLinks, useAdminNavLinks
│       ├── styles/main.css     # Design tokens
│       ├── locales/            # en, de
│       ├── i18n/
│       └── sentry/
├── e2e/                        # Playwright
├── scripts/
├── docs/
├── docker-compose.yml
├── docker-compose.prod.yml
└── .env.docker.example
```

Placed under `portal/` to avoid colliding with the existing HAP root layout (`frontend/` React app, root Express server).
