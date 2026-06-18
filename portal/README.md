# Prediction Portal Boilerplate

Reusable portal framework extracted from the WM 2026 architecture. See [../docs/PORTAL_BLUEPRINT.md](../docs/PORTAL_BLUEPRINT.md) for the full specification.

## Structure

| Path | Purpose |
|------|---------|
| `backend/` | Node/Express API, scheduler, Sequelize models, services |
| `frontend/` | Vue 3 SPA + PWA (Vite, Pinia, vue-i18n) |
| `e2e/` | Playwright end-to-end tests |
| `scripts/` | Build and repo helper scripts |
| `docs/` | Deployment and operations notes |
| `.github/workflows/` | CI and Docker publish |

## Quick start (local)

```bash
# Backend
cd backend && npm install && cp .env.example .env && npm run dev

# Frontend (separate terminal)
cd frontend && npm install && cp .env.example .env && npm run dev

# Full stack via Docker
docker compose up --build
```

## Environment

- Backend: `backend/.env.example`
- Frontend (Vite): `frontend/.env.example`
- Production / Portainer: `.env.docker.example`
