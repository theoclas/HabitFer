# NutriFer: API para Claude (solo lectura)

Para que un asistente (Claude Code u otro) lea el diario de NutriFer y ayude con la dieta. **Solo lee**: no hay
ninguna ruta que anote, cambie o borre.

## La llave

- Se crea en **NutriFer › Meta › Claude, tu asistente › Crear llave** (se muestra una sola vez) o en el servidor:

  ```bash
  docker compose -f docker-compose.prod.yml exec -T api \
    node dist/nutrition/assistant/create-agent-key.js --name "Claude en el PC" > llave.txt
  ```

  Sin `--user <id o correo>` es para quien más ha anotado en NutriFer. Por la salida estándar sale **solo la
  llave** (para guardarla sin verla); a quién se le creó y la pista salen por stderr.
- Empieza con `nfa_`. Se guarda solo su huella SHA-256 (tabla `NutritionAgentKey`). Máximo 10 por persona; se
  ven y se quitan en la misma tarjeta, que también dice cuándo se usó por última vez.
- Va en el encabezado `Authorization: Bearer nfa_…`. No sirve para ninguna otra ruta de la app (y la sesión de la
  app no sirve para estas).

## Rutas (con la llave)

| Ruta | Qué devuelve |
|---|---|
| `GET /api/nutrition/agent/report` | El informe. `days` (1 a 92; 14 por defecto) o `from` y `to` (AAAA-MM-DD). `format=json` (por defecto) o `format=md`. |
| `GET /api/nutrition/agent/foods?q=arepa&limit=10` | Busca en la base de NutriFer: valores por 100 g, medidas caseras con sus kcal y sellos de advertencia. |

```bash
curl -s -H "Authorization: Bearer $(cat llave.txt)" \
  "https://habitfer.fersuastudio.com/api/nutrition/agent/report?days=14&format=md"
```

Límite: 30 consultas por minuto. Las respuestas van con `Cache-Control: no-store`.

## Qué trae el informe

- **Perfil y metas**: sexo, edad, estatura, peso del perfil y de tendencia, objetivo, actividad, calorías,
  macros, fibra, azúcares, sodio y agua; si la meta se ajusta sola cada lunes.
- **Resumen** de los días completos (los que tienen al menos el 40 % de la meta; los de menos seguro quedaron a
  medias y no cuentan): promedios, frente a la meta, de dónde salen las calorías, días en la meta, proteína por
  kilo, entre semana y fin de semana, agua.
- **Por comida**, **por grupo de alimentos** y **lo que más aportó** (calorías, proteína, azúcares y sodio).
- **Peso** (última pesada, tendencia, cambio en 7 y 30 días, ritmo), **gasto real** (fórmula, observado y
  revisiones de la meta), **ayuno** y los **descubrimientos** de Progreso.
- **Día por día**: cada comida con lo que se comió, la cantidad (como en la app), las kcal y los macros.

Hoy sale en el detalle pero no cuenta en los promedios. Dos límites que el informe avisa: la tabla del ICBF no trae
azúcares (el total real es mayor) y los registros rápidos son solo calorías.

## Desde la app (con la sesión)

- **Copiar informe** copia el mismo informe en Markdown para pegarlo en cualquier chat (también en la app de
  Claude del celular). Si el navegador no deja copiar, sale el texto para copiarlo a mano.
- Rutas: `GET` y `POST /api/nutrition/agent-keys`, `DELETE /api/nutrition/agent-keys/:id` y
  `GET /api/nutrition/agent-report` (mismos parámetros que el informe).

El código está en `api/src/nutrition/assistant/` (el armado del informe, puro y con pruebas, en
`assistant-report.ts`) y la tarjeta en `web/src/apps/nutrifer/components/AssistantCard.tsx`.
