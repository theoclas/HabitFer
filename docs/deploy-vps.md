# Despliegue en VPS — HabitFer

Guía para subir HabitFer a una VPS **conviviendo con el Dashboard Fersua** (u otros proyectos en el puerto 80).

## Arquitectura

```
Internet
    │
    ├── :80  ──► Dashboard (ya instalado)     http://TU_IP/app/...
    │
    └── :8080 ──► HabitFer (Docker)           http://TU_IP:8080
                      ├── Caddy (proxy)
                      ├── web (React)
                      ├── api (NestJS)
                      └── db (MySQL, solo red interna)
```

HabitFer **no usa el puerto 80** para no chocar con el Dashboard.

---

## Requisitos

- VPS con Ubuntu (acceso SSH).
- Docker y Docker Compose instalados.
- Git.
- Puertos abiertos: **22**, **8080** (y **80** solo si el Dashboard ya lo usa).
- Repo: https://github.com/theoclas/HabitFer.git

---

## 1. Actualizar código en la VPS

Si es la primera vez:

```bash
cd ~/apps
git clone https://github.com/theoclas/HabitFer.git
cd HabitFer
```

Si ya clonaste el repo, actualiza a la última versión (incluye los fixes de deploy):

```bash
cd ~/apps/HabitFer
git pull origin main
```

---

## 2. Variables de entorno

### 2.1 Raíz del proyecto — `.env`

```bash
cp .env.prod.example .env
nano .env
```

Ejemplo **sin dominio** (sustituye `177.7.40.130` por la IP de tu VPS):

```env
MYSQL_ROOT_PASSWORD=TuPasswordRootMuyLarga123!
MYSQL_USER=habitfer
MYSQL_PASSWORD=TuPasswordDBFuerte456!

VITE_API_URL=http://177.7.40.130:8080/api

CADDY_HTTP_PORT=8080
CADDYFILE=./deploy/Caddyfile
```

> `VITE_API_URL` se embebe en el build del frontend. Si la cambias, debes reconstruir el contenedor `web`.

### 2.2 API — `api/.env.prod`

```bash
cp api/.env.example api/.env.prod
nano api/.env.prod
```

```env
PORT=4001
NODE_ENV=production
DATABASE_URL=mysql://habitfer:TuPasswordDBFuerte456!@db:3306/habitfer
JWT_SECRET=PEGA_AQUI_SECRETO_LARGO
CORS_ORIGINS=http://177.7.40.130:8080
COOKIE_SECURE=false
PRISMA_DB_PUSH=true
```

Generar `JWT_SECRET`:

```bash
openssl rand -base64 48
```

**Importante:**

| Variable | Regla |
|----------|--------|
| `DATABASE_URL` | Host **`db`** (nombre del servicio Docker), misma contraseña que `MYSQL_PASSWORD` en `.env` |
| `CORS_ORIGINS` | Misma URL pública que usas en el navegador (sin `/api`) |
| `COOKIE_SECURE=false` | Obligatorio mientras uses **HTTP** (IP:8080). Con HTTPS pon `true` |

---

## 3. Firewall

```bash
sudo ufw allow 8080/tcp
sudo ufw status
```

---

## 4. Construir y levantar

```bash
cd ~/apps/HabitFer
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d
```

Verificar:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f --tail 50
```

El contenedor `api` aplica el schema de Prisma al arrancar (`prisma db push`). Si falla, revisa logs de `api`.

### Actualizar schema tras nuevos módulos (p. ej. Fernance)

Tras desplegar cambios que añaden tablas en `api/prisma/schema.prisma` (como `FinanceAccount`, `Income`, `Credit`, `CreditInstallment` del módulo **Fernance**):

```bash
cd ~/apps/HabitFer
git pull origin main
docker compose -f docker-compose.prod.yml build api web
docker compose -f docker-compose.prod.yml up -d
```

Si las tablas no se crean al arrancar, aplica el schema manualmente:

```bash
docker compose -f docker-compose.prod.yml exec api npx prisma db push
docker compose -f docker-compose.prod.yml restart api
```

En desarrollo local:

```bash
cd api
npx prisma db push
```

Luego accede a Fernance en `/app/fernance` desde el App Picker tras iniciar sesión.

---

## 5. Primer usuario (administrador)

Con la base de datos vacía, el **primer registro** queda como **ADMIN** y **ACTIVE**.

1. Abre: http://177.7.40.130:8080/register
2. Crea tu cuenta (contraseña: mín. 12 caracteres, mayúscula, minúscula, número).
3. Inicia sesión en http://177.7.40.130:8080/login

### Promover admin manualmente (opcional)

Si ya existe un usuario pendiente:

```bash
docker compose -f docker-compose.prod.yml exec db mysql -u habitfer -p habitfer
```

```sql
UPDATE User SET role = 'ADMIN', status = 'ACTIVE', approvedAt = NOW()
WHERE email = 'tu@email.com';
EXIT;
```

---

## 6. Comprobar que todo funciona

| Prueba | Resultado esperado |
|--------|-------------------|
| http://TU_IP:8080 | Carga la app HabitFer |
| http://TU_IP:8080/register | Formulario de registro |
| Login | Entras al panel |
| http://TU_IP/app/... | Dashboard sigue funcionando (puerto 80) |
| MySQL público | Cerrado (no hay puerto 3306 expuesto) |

---

## 7. Actualizar después de cambios en GitHub

```bash
cd ~/apps/HabitFer
git pull origin main

# Si cambió frontend o VITE_API_URL:
docker compose -f docker-compose.prod.yml build web api
docker compose -f docker-compose.prod.yml up -d

# Solo API:
docker compose -f docker-compose.prod.yml build api
docker compose -f docker-compose.prod.yml up -d api
```

---

## 8. Dominio con Hostinger (opcional, más adelante)

Cuando tengas un dominio (ej. `habitfer.tudominio.com`):

### DNS en Hostinger

| Tipo | Nombre | Valor |
|------|--------|-------|
| A | `habitfer` | IP de tu VPS |

### Opción A — Proxy en el host (recomendada si Dashboard usa el puerto 80)

1. HabitFer sigue en **8080** (no cambies `CADDY_HTTP_PORT`).
2. Instala Caddy/nginx en la VPS y enruta `habitfer.tudominio.com` → `localhost:8080`.
3. Ver plantilla: `deploy/Caddyfile.host.example`.

### Opción B — HTTPS directo en el compose de HabitFer

Solo si **80 y 443 están libres** (sin Dashboard en esos puertos):

`.env`:

```env
VITE_API_URL=https://habitfer.tudominio.com/api
CADDY_HTTP_PORT=80
CADDYFILE=./deploy/Caddyfile.domain
DOMAIN=habitfer.tudominio.com
```

`api/.env.prod`:

```env
CORS_ORIGINS=https://habitfer.tudominio.com
COOKIE_SECURE=true
```

Reconstruir y levantar:

```bash
docker compose -f docker-compose.prod.yml build web
docker compose -f docker-compose.prod.yml up -d
```

Caddy obtendrá el certificado Let's Encrypt automáticamente.

---

## Solución de problemas

### `curl localhost:8080` falla / timeout en el navegador

**Síntoma:** `curl: (7) Failed to connect to localhost port 8080`

**Causa habitual:** el `deploy/Caddyfile` en la VPS sigue con `{$DOMAIN}` pero no hay dominio configurado. Caddy no levanta el sitio.

**Arreglo rápido** (en `~/apps/HabitFer`):

```bash
sh deploy/fix-caddyfile-ip.sh
docker compose -f docker-compose.prod.yml restart caddy
curl -I http://localhost:8080
```

O manualmente, `deploy/Caddyfile` debe empezar con `:80 {` (no `{$DOMAIN}`).

Si `curl` en la VPS responde pero el navegador no, abre el puerto en UFW y en el firewall del panel de Hostinger:

```bash
sudo ufw allow 8080/tcp
```

### Build de `web` falla

Ya no hace falta copiar `nginx.conf` a mano; está en `web/deploy/nginx.conf`. Haz `git pull`.

### `api` no arranca — error de base de datos

- Revisa que `DATABASE_URL` use `@db:3306`.
- Contraseña igual en `.env` (`MYSQL_PASSWORD`) y `api/.env.prod`.

### CORS / login falla

- `CORS_ORIGINS` debe ser exactamente `http://TU_IP:8080` (sin barra final, sin `/api`).
- `VITE_API_URL` debe ser `http://TU_IP:8080/api`.
- Tras cambiar `VITE_API_URL`, rebuild de `web`.

### Puerto 8080 en uso

Cambia en `.env`: `CADDY_HTTP_PORT=8090` y actualiza las URLs en `.env` y `api/.env.prod`. Rebuild `web`.

### Ver logs

```bash
docker compose -f docker-compose.prod.yml logs api --tail 100
docker compose -f docker-compose.prod.yml logs caddy --tail 50
docker compose -f docker-compose.prod.yml logs web --tail 30
```

### Parar / reiniciar

```bash
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d
```

---

## Checklist de seguridad

Ver también `docs/security.md`.

- [ ] `JWT_SECRET` único y largo (32+ caracteres)
- [ ] Contraseñas MySQL fuertes
- [ ] MySQL no expuesto al exterior
- [ ] `COOKIE_SECURE=true` cuando uses HTTPS
- [ ] Primer admin creado; registros nuevos quedan `PENDING` hasta aprobación

---

## Resumen de comandos (copiar/pegar)

```bash
cd ~/apps/HabitFer
git pull origin main
cp .env.prod.example .env
cp api/.env.example api/.env.prod
# Editar .env y api/.env.prod con tus valores
sudo ufw allow 8080/tcp
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
# Abrir http://TU_IP:8080/register
```
