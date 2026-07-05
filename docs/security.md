# Checklist de seguridad — HabitFer / ProyecFer

## Pre-deploy (produccion en internet)

- [ ] `JWT_SECRET` aleatorio de al menos 32 caracteres (nunca el valor de `.env.example`)
- [ ] `CORS_ORIGINS` limitado a tu dominio HTTPS
- [ ] MySQL sin puerto expuesto publicamente (solo red Docker interna)
- [ ] TLS activo (Caddy/nginx/Cloudflare)
- [ ] `NODE_ENV=production`
- [ ] Credenciales DB unicas y fuertes
- [ ] Primer admin creado y registro publico con aprobacion activo
- [ ] `npm audit` sin vulnerabilidades high/critical en `api/` y `web/`

## Autenticacion

- Registro crea cuentas `PENDING`; solo ADMIN aprueba via `/app/users`
- Login bloqueado hasta `status=ACTIVE`
- JWT en cookie `httpOnly` + fallback Bearer en dev
- Rate limiting: login 5/15min, register 3/hora
- Contrasenas: min 12 chars, mayuscula, minuscula, numero

## Rotacion de secrets

1. Generar nuevo `JWT_SECRET`
2. Actualizar env y reiniciar API (invalida todas las sesiones)
3. Notificar usuarios si es necesario

## Respuesta a incidentes

1. Suspender cuenta comprometida (`PATCH /users/:id/suspend`)
2. Rotar `JWT_SECRET` si hubo filtracion de tokens
3. Revisar logs de actividad en workspaces afectados
4. Ejecutar `npm audit` y actualizar dependencias

## Comandos utiles

```bash
cd api && npm audit
cd web && npm audit
cd api && npx prisma db push   # aplicar cambios de schema
```
