# Notion: guía en profundidad

Notion es una plataforma todo-en-uno de productividad, documentación y gestión del conocimiento. Combina lo que antes requería varias herramientas — notas, wikis, bases de datos, tableros Kanban, calendarios y páginas web — en un solo espacio de trabajo flexible basado en bloques.

---

## 1. ¿Qué es Notion y para qué sirve?

Notion nació en 2016 (fundada por Ivan Zhao) con la idea de **“un solo lugar para todo tu trabajo y tu vida”**. A diferencia de apps especializadas (Google Docs solo para documentos, Trello solo para tableros, Evernote solo para notas), Notion usa un modelo unificado:

- **Páginas** como contenedores principales
- **Bloques** como unidades de contenido intercambiables
- **Bases de datos** como tablas, listas o tableros con propiedades personalizables

### Casos de uso típicos

| Ámbito | Ejemplos |
|--------|----------|
| Personal | Diario, metas, hábitos, lecturas, finanzas |
| Estudio | Apuntes, resúmenes, calendario académico |
| Trabajo | Wikis de equipo, specs, reuniones, OKRs |
| Proyectos | Roadmaps, sprints, documentación técnica |
| Creativo | Briefs, guiones, moodboards, calendario editorial |

---

## 2. Modelo mental: bloques, páginas y espacios de trabajo

### Bloques

Todo en Notion es un **bloque**. Cada párrafo, imagen, lista, tabla o base de datos es un bloque que puedes:

- Arrastrar y reordenar
- Convertir en otro tipo (por ejemplo, texto → encabezado → lista)
- Anidar dentro de otros bloques (toggle, columnas, callouts)

Tipos de bloques más usados:

- **Texto:** párrafo, encabezados (H1–H3), lista con viñetas, lista numerada, lista de tareas (to-do)
- **Medios:** imagen, video, audio, archivo, bookmark (vista previa de enlace)
- **Estructura:** divisor, tabla de contenidos, columnas, toggle (contenido colapsable)
- **Referencia:** mención de página (`@`), mención de fecha (`@hoy`), mención de persona
- **Datos:** base de datos inline, base de datos en página completa, synced block
- **Integraciones:** embed (Figma, GitHub, Google Maps, etc.), código con syntax highlighting

### Páginas

Una **página** es un documento que contiene bloques. Las páginas pueden:

- Vivir en la barra lateral como hijas de un espacio o de otra página
- Tener icono y portada (cover)
- Ser públicas (publicadas en web) o privadas
- Contener subpáginas ilimitadas (jerarquía tipo wiki)

### Espacios de trabajo (Workspaces)

Un **workspace** es el contenedor de nivel superior. Puede ser:

- **Personal:** un solo usuario
- **Team / Business / Enterprise:** varios miembros con permisos por página

Dentro del workspace tienes:

- **Private:** páginas solo tuyas
- **Shared:** páginas compartidas con otros
- **Teamspaces** (planes de equipo): áreas dedicadas por departamento o proyecto

---

## 3. Bases de datos: el corazón de Notion

Las **bases de datos** (databases) son la funcionalidad más potente. No son hojas de cálculo clásicas: son **colecciones de páginas** donde cada fila es una página con propiedades.

### Vistas (views)

La misma base de datos puede mostrarse de muchas formas:

| Vista | Descripción |
|-------|-------------|
| **Table** | Tabla clásica con columnas |
| **Board** | Kanban por estado, prioridad, etc. |
| **Timeline** | Línea temporal (Gantt simplificado) |
| **Calendar** | Eventos por fecha |
| **List** | Lista compacta |
| **Gallery** | Tarjetas con imagen de portada |
| **Feed** (nuevo) | Flujo tipo red social / changelog |

Cada vista puede tener **filtros**, **orden** y **agrupación** independientes sin duplicar datos.

### Tipos de propiedades

- **Text** — texto libre
- **Number** — números (con formato moneda, porcentaje, etc.)
- **Select / Multi-select** — etiquetas con colores
- **Date** — fecha o rango (con recordatorios)
- **Person** — miembro del workspace
- **Files & media** — adjuntos
- **Checkbox** — booleano
- **URL** — enlace
- **Email / Phone** — contacto
- **Formula** — cálculos sobre otras propiedades (similar a Excel)
- **Relation** — enlace a otra base de datos (ej. tareas ↔ proyectos)
- **Rollup** — agrega datos de la relación (conteo, suma, etc.)
- **Created time / Created by / Last edited** — metadatos automáticos
- **Status** — flujo de estados (Not started → In progress → Done)
- **Unique ID** — identificador automático (TASK-42)
- **Button** (planes Business+) — acciones automatizadas al pulsar

### Relaciones y rollups

Ejemplo clásico:

```
Proyectos (DB)  ←——relation——→  Tareas (DB)
                                      ↑
                                 rollup: "Progreso %"
                                 (tareas Done / total)
```

Esto permite CRMs, gestión de proyectos, inventarios y wikis interconectados sin salir de Notion.

---

## 4. Colaboración y permisos

### Compartir

- **Invite** por email al workspace o a una página concreta
- **Share to web:** página pública con URL (solo lectura o editable según config)
- **Permisos por página:** Full access, Can edit, Can comment, Can view
- **Guest access:** usuarios externos limitados a páginas específicas (planes de pago)

### Comentarios y menciones

- Comentarios en bloques o páginas enteras
- `@persona` para notificar
- Hilos de discusión resueltos/archivados

### Historial de versiones

- **Page history** (planes Plus+): restaurar versiones anteriores
- Útil para documentos legales, specs o notas de reuniones

### Notificaciones

- Inbox con menciones, comentarios, asignaciones y recordatorios
- Integración con email y (en móvil) push

---

## 5. Plantillas (Templates)

Notion ofrece miles de **plantillas** oficiales y de la comunidad:

- Second brain / PARA method
- GTD (Getting Things Done)
- CRM
- Roadmap de producto
- Wiki de startup
- Tracker de hábitos
- Planificador de contenido

Puedes crear **template buttons** dentro de tus propias bases de datos para generar páginas pre-rellenadas (ej. “Nueva reunión” con secciones fijas).

---

## 6. Notion AI

Desde 2023, Notion integra **IA generativa** (add-on o incluido según plan):

- Resumir páginas largas
- Mejorar redacción, traducir, cambiar tono
- Generar borradores desde un prompt
- Q&A sobre tus páginas (busca en tu workspace)
- Autocompletar tablas y listas
- Extraer action items de notas de reunión

La IA tiene acceso contextual a la página actual o al workspace (según permisos).

---

## 7. Automatizaciones e integraciones

### Notion API

Notion expone una **API REST** oficial que permite:

- Crear, leer, actualizar y archivar páginas y bloques
- Consultar bases de datos
- Construir integraciones custom (bots, sync con otras apps)

Casos habituales: sincronizar GitHub issues, formularios web → Notion, dashboards externos.

### Automations (nativas)

En bases de datos puedes definir reglas del tipo:

- “Cuando Status = Done → mover a archivo”
- “Cuando se crea fila → asignar persona X”

### Integraciones de terceros

- **Zapier / Make:** conectar con cientos de apps
- **Slack:** notificaciones y slash commands
- **Google Drive, GitHub, Figma:** embeds en vivo
- **Calendar sync** (Google Calendar ↔ bases de datos con fechas)

---

## 8. Aplicaciones y sincronización

Notion está disponible en:

- **Web** (notion.so)
- **Desktop** (Windows, macOS — app Electron)
- **Mobile** (iOS, Android)
- **Web Clipper** (extensión navegador para guardar páginas)

**Offline mode** (limitado): lectura y edición local con sync al reconectar (mejor en apps nativas que en web).

---

## 9. Planes y precios (referencia 2024–2025)

| Plan | Público | Lo esencial |
|------|---------|-------------|
| **Free** | Individual / pequeños equipos | Bloques ilimitados, sync, 10 guests |
| **Plus** | Uso personal avanzado | Historial ilimitado, archivos grandes |
| **Business** | Equipos | SAML, permisos avanzados, Notion AI |
| **Enterprise** | Grandes orgs | SCIM, audit log, soporte dedicado |

Los precios cambian; conviene revisar [notion.so/pricing](https://www.notion.so/pricing).

---

## 10. Fortalezas y limitaciones

### Fortalezas

- **Flexibilidad extrema:** un solo tool para notas, proyectos y docs
- **Bases de datos relacionales** sin ser una app de BD tradicional
- **Estética limpia** y experiencia unificada
- **Comunidad enorme** de plantillas y tutoriales
- **API madura** para integraciones

### Limitaciones

- **Curva de aprendizaje:** configurar relaciones, fórmulas y rollups lleva tiempo
- **Rendimiento:** workspaces muy grandes pueden sentirse lentos
- **Offline** menos robusto que apps nativas de notas (Obsidian, Apple Notes)
- **No es un Excel:** fórmulas y tablas masivas tienen techo
- **Bloqueo de vendor:** migrar fuera de Notion requiere export (Markdown, CSV, HTML)

---

## 11. Notion vs alternativas (visión rápida)

| Herramienta | Enfoque | vs Notion |
|-------------|---------|-----------|
| **Obsidian** | Notas locales, Markdown, grafos | Más rápido offline; menos colaboración |
| **Coda** | Docs + tablas + automatizaciones | Más “app builder”; menos wiki |
| **ClickUp / Asana** | Gestión de proyectos pura | Menos flexible para documentación |
| **Confluence** | Wiki empresarial (Atlassian) | Más rígido; mejor para Jira |
| **Google Workspace** | Docs/Sheets/Drive | Mejor colaboración en tiempo real en docs; peor estructura |
| **Airtable** | Bases de datos visuales | Más potente en datos; peor para texto largo |

Notion brilla cuando quieres **documentación + datos + tareas** en un mismo sitio sin pegar con Zapier diez herramientas.

---

## 12. Metodologías populares en Notion

### PARA (Tiago Forte)

- **Projects** — resultados con fecha límite
- **Areas** — responsabilidades continuas
- **Resources** — temas de interés
- **Archives** — lo inactivo

### Second Brain

- **Inbox** → procesar → **Projects / Areas**
- Base de datos de notas con tags y estados
- Resúmenes semanales y revisión GTD

### OKRs

- Objetivos (Objectives) relacionados con Key Results medibles
- Vistas por trimestre y por equipo

---

## 13. Buenas prácticas

1. **Empieza simple:** una página + una base de datos antes de construir un “sistema perfecto”.
2. **Usa templates** oficiales y adáptalos; no reinventes la rueda.
3. **Nombra bien las propiedades** en bases de datos; el yo del futuro te lo agradecerá.
4. **Evita duplicar datos:** usa relaciones en lugar de copiar/pegar.
5. **Archiva** páginas viejas en lugar de borrarlas.
6. **Define permisos** por teamspace en equipos grandes.
7. **Exporta backups** periódicos (Settings → Export) si el workspace es crítico.

---

## 14. Atajos de teclado útiles (Windows / Mac)

| Acción | Atajo |
|--------|-------|
| Paleta de comandos | `Ctrl/Cmd + P` |
| Buscar en workspace | `Ctrl/Cmd + K` |
| Nueva página | `Ctrl/Cmd + N` |
| Nuevo bloque / menú slash | `/` |
| Negrita / cursiva | `Ctrl/Cmd + B` / `I` |
| Enlace | `Ctrl/Cmd + K` |
| Comentario | `Ctrl/Cmd + Shift + M` |
| Toggle bloque | `Ctrl/Cmd + Shift + H` |

---

## 15. Resumen

Notion no es solo una app de notas: es un **constructor de espacios de trabajo** donde páginas, bloques y bases de datos se combinan para crear desde un diario personal hasta el wiki completo de una empresa. Su poder está en la **reutilización de la misma información en múltiples vistas**, las **relaciones entre bases de datos** y la **colaboración** en torno al contenido.

Para sacarle el máximo partido, invierte tiempo en entender **bloques**, **propiedades** y **relaciones** — una vez dominados, Notion escala contigo durante años.

---

## Referencias

- [Notion Help Center](https://www.notion.so/help)
- [Notion Developers (API)](https://developers.notion.com/)
- [Template Gallery](https://www.notion.so/templates)

*Documento generado como referencia. Precios y funciones pueden cambiar según actualizaciones de Notion.*
