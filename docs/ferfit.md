# FerFit: ejercicio en casa

App de la plataforma (`/app/ferfit`) para entrenar en casa: rutinas listas y propias, chulear lo hecho y la racha
por semanas. Propuesta y fases: https://claude.ai/artifact/Pe5D3bn3rXScTw858jFRNQ (la fase 0 es lo que hay aquí).

## Cómo está armada

- **Biblioteca en el código** (`api/src/fit/data/`): `exercises.ts` (ejercicios con textos propios y su figura) y
  `routines.ts` (rutinas listas). La clave (`key`) de cada ejercicio es fija: las rutinas y lo hecho la guardan.
  La API la sirve armada en `GET /api/fit/library` y la web la guarda en el teléfono (`fit_library`).
- **Figuras** (`api/src/fit/figure.ts`): una persona de palitos descrita con ángulos (tronco, hombro, codo, cadera,
  rodilla) en una pose A y una B; el código calcula los puntos y la web los anima con SVG (sin imágenes de nadie).
  Ángulos: 0 = abajo, 90 = adelante, 180 = arriba; la figura mira a la derecha y el piso está en y = 108.
  En desarrollo, `/app/ferfit/ejercicios?figuras` muestra las dos poses una encima de la otra para revisarlas.
  La prueba `fit.spec.ts` revisa que ninguna figura se salga del dibujo.
- **Base de datos**: `FitRoutine` + `FitRoutineItem` (rutinas propias), `FitWorkout` (lo chuleado: una rutina por
  día, con sus ejercicios y cuáles se hicieron, o una actividad suelta) y `FitSettings` (meta de días por semana).
- **Racha** (`api/src/fit/fit-math.ts`): semanas seguidas con la meta cumplida. Los días de descanso no rompen nada;
  la semana en curso suma cuando se cumple y no rompe mientras no termine.
- **Web** (`web/src/apps/ferfit/`): Hoy, Rutinas (detalle y editor) y Ejercicios. Estilo «Ciclovía» en
  `theme/ferfit.css`, con prefijo `fit-` (FerFinance usa `ff-`: no reutilizarlo).

## Rutas de la API (con la sesión)

| Ruta | Para qué |
|---|---|
| `GET /api/fit/library` | Ejercicios con su figura y rutinas listas |
| `GET /api/fit/home?date=` | La racha, lo chuleado ese día y las rutinas propias |
| `GET/POST /api/fit/routines`, `GET/PUT/DELETE /api/fit/routines/:id` | Rutinas propias (borrar las archiva) |
| `POST /api/fit/routines/copy` | Copiar una rutina lista (`{ readyKey }`) |
| `GET /api/fit/workouts?from&to`, `POST /api/fit/workouts`, `PATCH/DELETE /api/fit/workouts/:id` | Chulear |
| `PUT /api/fit/settings` | Meta de días por semana |
