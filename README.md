# HabitFer

App de habitos y tareas (mobile-first) con React + NestJS + MySQL.

## Requisitos

- Node.js 20+
- Docker Desktop (MySQL local)

## Arranque local

1. Levanta MySQL:

```bash
docker compose up -d
```

2. API (`api/`):

```bash
cp .env.example .env
npm install
npx prisma migrate dev --name init
npm run start:dev
```

API en http://localhost:4001/api

3. Web (`web/`):

```bash
cp .env.example .env
npm install
npm run dev
```

Web en http://localhost:5174

## Estructura

- `api/` — NestJS + Prisma + JWT auth
- `web/` — React + Vite + Ant Design (bottom nav en movil)
- `docker-compose.yml` — MySQL puerto 3308

## Proximos pasos

- Modulo de habitos con rachas configurables
- Modulo de tareas y proyectos
- Recordatorios y estadisticas
