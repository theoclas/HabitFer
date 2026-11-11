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
| `GET /api/fit/workouts?from&to`, `POST /api/fit/workouts`, `PATCH/DELETE /api/fit/workouts/:id` | Chulear (el modo guiado manda `addDone`, `logs`, `minutes`; el esfuerzo va con `PATCH`) |
| `GET /api/fit/history?keys=a,b` | La última vez de cada ejercicio con series anotadas |
| `PUT /api/fit/settings` | Meta de días por semana |

## Fase 1: entreno guiado

Ruta `/app/ferfit/rutinas/:id/entrenar` o `/app/ferfit/listas/:key/entrenar` (pantalla completa, sin menú).

- **Plan** (`web/src/apps/ferfit/player/plan.ts`): convierte la rutina en pasos (prepárate, trabajo, descanso) con lo
  que dice la voz. Modos: como está (series o circuito), intervalos (trabajo y descanso fijos, con vueltas) y cada
  minuto (EMOM). Agrega el calentamiento y el estiramiento de la biblioteca (`api/src/fit/data/blocks.ts`, unos 5 min
  cada uno), apagados por defecto en rutinas de movilidad o estiramiento.
- **Reloj** (`player/engine.ts`): con marcas de tiempo, no con un contador; si el celular deja la app en segundo
  plano, al volver se pone al día. Pausa, saltar, atrás (repite el ejercicio o vuelve al anterior) y +10 s.
- **Voz y pitidos** (`player/coach.ts`): la voz en español del celular (prefiere es-CO) y tonos del audio del
  navegador; el primer sonido tiene que salir de un toque (iPhone). La pantalla no se apaga con la Wake Lock API.
- **Series reales**: repeticiones, peso (ejercicios con mancuernas) y segundos (los «terminé antes»); se guardan en
  `FitWorkout.items[].log` y la rutina muestra «La última vez». Al terminar se pide el esfuerzo de 1 a 10
  (`FitWorkout.effort`). El calentamiento y el estiramiento no se anotan.
- **A medias (fase 1)**: el entrenamiento se guarda en el teléfono (`fit_player_session`) en cada paso; al volver se ofrece
  «Seguir donde ibas» por 12 horas, si la rutina no cambió. Las preferencias (voz, pitidos, calentar, estirar,
  intervalos) quedan en `fit_player_prefs`.

## Fase 2: tu semana

Página `/app/ferfit/semana` (pestaña «Semana») y la tarjeta «Hoy te toca» en Hoy.

- **Plan de la semana** (`FitWeekPlan`): una rutina por día (0 = lunes … 6 = domingo); sin fila = descanso.
- **Programas** (`api/src/fit/data/programs.ts` y `FitProgramRun`): «Empieza desde cero» (4 semanas, 3 días) y «Bajo
  impacto para bajar de peso» (6 semanas, 4 días). Cada sesión es una rutina lista con clave
  `<programa>--s<semana>-<número>` (se abre en `/app/ferfit/listas/<clave>` y tiene su entreno guiado). La persona
  escoge los días y si empieza esta semana o la próxima. Mientras un programa corre, el plan queda en pausa; al
  terminar su última semana, o al dejarlo, vuelve el plan.
- **Mover** (`FitPlanChange`): una rutina pendiente pasa a otro día de la misma semana, de hoy en adelante; se puede
  deshacer (también deshace lo que se movió después desde ese día).
- **Qué quedó hecho** (`api/src/fit/fit-plan.ts`, funciones puras): lo planeado cuenta como hecho si se entrenó esa
  rutina ese día, o un día después en la misma semana (cada entreno cuenta una sola vez).
- **Meta por días o por minutos** (`FitSettings.goalKind`, `weeklyGoalMinutes`): la racha cuenta semanas cumplidas.
  Los minutos de lo chuleado a mano se calculan con lo que se hizo.
- **Recordatorio** (`FitSettings.remindOn`, `remindAt`): el revisor de avisos de HabitFer (cada minuto) manda
  «Hoy te toca…» los días que hay algo pendiente: notificación (abre el entreno guiado), la campana (`WORKOUT`), y
  correo o WhatsApp si la persona los tiene en «Todo». Uno por día.

| Ruta | Para qué |
|---|---|
| `GET /api/fit/week?date=` | La semana: los 7 días con lo planeado y cómo va, el plan, el programa y los ajustes |
| `PUT /api/fit/plan` | El plan de la semana (`days: [{ weekday, routineId \| readyKey }]`) |
| `POST /api/fit/plan/moves`, `DELETE /api/fit/plan/moves/:id` | Mover una rutina de día y deshacerlo |
| `POST /api/fit/programs/start`, `POST /api/fit/programs/stop` | Empezar (`programKey`, `weekdays`, `start`) o dejar un programa |
| `PUT /api/fit/settings` | Meta (días o minutos) y recordatorio; se manda solo lo que cambia |
