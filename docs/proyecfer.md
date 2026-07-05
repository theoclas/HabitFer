# ProyecFer

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
