# ProyecFer

> **Retirada el 10 nov 2026 (solo oculta).** Fernando pidió retirarla y eligió la opción que se puede deshacer:
> ProyecFer ya no sale en el lanzador de apps, en «Bienvenido a Fersua» ni en la pantalla de entrada, y cualquier
> dirección `/app/proyecfer/*` lleva a HabitFer. Su código (web y API) y sus tablas siguen intactos, y la API
> `/api/proyecfer` sigue respondiendo. Ninguna otra app usa sus datos (ni el respaldo de HabitFer ni los avisos).
>
> Para volver a prenderla: borrar `retired: true` de `proyecfer` en `web/src/platform/apps.ts` (la marca también
> controla la ruta en `web/src/router.tsx`) y desplegar la web. Si algún día se borra del todo, sus tablas son
> Workspace, WorkspaceMember, CollabProject, CollabProjectMember, CollabTask, CollabTaskCompletion, Page, Block,
> Database, DatabaseProperty, DatabaseRow, DatabaseView, Comment, ActivityLog, CollabNotification, WorkGuide y
> WorkGuideStep. Hace falta respaldo antes, y ojo: el arranque de la API corre `db push` sin `--accept-data-loss`, así
> que si se quitan del esquema sin borrarlas a mano en producción, la API no arranca.

Modulo colaborativo tipo Notion dentro de la plataforma Fersua (HabitFer + ProyecFer).

## Rutas frontend

| Ruta | Descripcion |
|------|-------------|
| `/app/picker` | Selector de app tras login |
| `/app/habitfer/*` | Habitos y tareas personales (sin cambios de datos) |
| `/app/proyecfer/*` | Workspaces, proyectos, paginas, bases de datos |
| `/app/profile` | Perfil compartido |

## API (`/api/proyecfer`)

- **Workspaces:** CRUD, miembros, busqueda de usuarios, actividad, estadisticas
- **Proyectos colaborativos:** CRUD dentro de un workspace
- **Tareas:** CRUD con asignacion a miembros del workspace
- **Comentarios:** En tareas, proyectos y paginas (soporta `@username`)
- **Paginas y bloques:** Editor por bloques con guardado debounced
- **Bases de datos:** Propiedades, filas y vistas Tabla/Kanban/Calendario/Galeria
- **Notificaciones:** Asignacion de tareas y menciones en comentarios

## Permisos

Roles por workspace: `OWNER`, `ADMIN`, `EDITOR`, `VIEWER`.

`PermissionsService` centraliza la comprobacion antes de cada operacion. Los colaboradores se eligen de usuarios existentes en la BD (`GET /proyecfer/workspaces/:id/users/search?q=`).

## Modelos de datos

Separados de `Project`/`Task` de HabitFer:

- `Workspace`, `WorkspaceMember`
- `CollabProject`, `CollabProjectMember`, `CollabTask`
- `Page`, `Block`
- `Database`, `DatabaseProperty`, `DatabaseRow`, `DatabaseView`
- `Comment`, `ActivityLog`, `CollabNotification`

## Desarrollo

```bash
cd api && npx prisma db push && npx prisma generate
cd api && npm run build
cd web && npm run build
```

## Flujo recomendado para probar

1. Login → elegir ProyecFer
2. Crear workspace
3. Invitar usuario existente por busqueda
4. Crear proyecto colaborativo
5. Crear tarea y asignar colaborador
6. Comentar en proyecto/tarea (usar `@username` para mencion)
7. Crear pagina con bloques
8. Crear base de datos y probar vistas
