# Componente de tablas reutilizable (TableView) — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Objetivo:** un único componente `TableView` que dé a cualquier lista del dashboard lo que hoy solo tiene `/dashboard/users`
(buscador, filtros, etiquetas de filtros activos, selector de columnas, «Showing X–Y of N», paginación con tamaño de
página, casillas con barra de acciones masivas, acciones por fila y mensaje sin resultados), configurado por props.

**Arquitectura:** el estado de la lista vive en la URL. Una definición pura por lista (`defineTableQuery`) sabe leer y
escribir esa URL y la usan a la vez la página (servidor) y el componente (cliente). La página lee los parámetros, pide
los datos y se los pasa al `*-content.tsx`, que monta `TableView` con columnas, filtros, `rowActions` y `bulkActions`.
`TableView` usa por dentro `DataTable` y `TableFooter`, que ya existen.

**Tecnología:** Next.js 16 (App Router), React 19, shadcn (`radix-vega`), Tailwind v4, Zod, `bun test`.

**Origen:** petición de la persona del 2026-10-26: todas las listas tienen que ser como la de usuarios, con un componente
totalmente reutilizable, hecho en la plantilla y llevado después al auditor de skills.

## Restricciones globales

- Rama `feat/table-view` de `~/Desktop/rapidauth-v2`. Los workers no hacen commits: los cambios de todas las tareas se
  quedan sin confirmar y la persona hace el commit y el push al final, después de validarlo todo. Nunca `push`,
  `merge` a `main` ni `--no-verify`.
- Código, nombres, archivos y el texto visible de la plantilla, en inglés (la plantilla está en inglés). Los textos de
  `TableView` se pueden cambiar con `labels`, que es como el auditor los pone en español.
- Sin dependencias nuevas, sin `bunx shadcn add` y sin tocar `components/ui/`.
- No usar el `.env` de la plantilla (apunta a la base de producción) ni los contenedores o volúmenes `rapidauth*`.
- Server Components por defecto; las páginas pasan solo props serializables. Las funciones (`render`, `onSelect`…) se
  crean dentro de los `*-content.tsx`, que ya son Client Components. Iconos solo en Client Components.
- Cada server action que reciba parámetros de lista los valida con el `schema` de su definición.
- Los enlaces que ya existen siguen funcionando con los mismos nombres de parámetro: `page`, `pageSize`, `q`, `role`,
  `status`, `provider`, `action`, `level`, `source`, `code` y `userId` (por ejemplo
  `/dashboard/logs?userId=<id>&source=emails`, que sale del menú de cada usuario).
- La cookie de columnas conserva su nombre `rapidauth-columns-<tableId>`.
- Mismo aspecto que hoy tiene `/dashboard/users`: barra de búsqueda con icono y botón de borrar, popover «Filters» con
  botones de opción, etiquetas «Active filters», «Columns n/m», contador a la derecha, tabla con opacidad mientras
  navega, barra de acciones flotante abajo y `TableFooter`.
- Validación final: `bun run test`, `bun run typecheck`, `bun run lint`, `bun run deps:check`,
  `bun run theme:sync-classic --check` y el build con
  `DATABASE_URL='postgresql://ci:ci@127.0.0.1:5432/ci?sslmode=disable' BETTER_AUTH_URL=http://localhost:3000
  BETTER_AUTH_SECRET=<64 ceros> SUPPORT_EMAIL=support@example.invalid NEXT_TELEMETRY_DISABLED=1 bun run build`.

## Decisiones del orquestador

1. **Pruebas con `bun test`** sin dependencias nuevas: script `"test": "bun test lib"`, tipos de `bun:test` escritos a
   mano en `types/bun-test.d.ts` (mismo contenido que `lib/auditor/bun-test.d.ts` del auditor) y el paso
   `- run: bun run test` en `.github/workflows/ci.yml`, justo después de `bun run typecheck`, igual que en el auditor.
2. **Todos los filtros van dentro del popover «Filters»**, con los botones de opción de usuarios. En registros del
   sistema, «Level», «Source» y «Code» dejan de ser menús sueltos: pasan al popover. Un filtro `multiple: false` deja
   marcada una sola opción.
3. **Un filtro puede no salir en el popover** (`showInPanel: false`) y solo mostrarse como etiqueta: es el caso de
   `userId` en registros del sistema.
4. **Etiquetas de filtros activos** con el formato por defecto `<filtro>: <opción>` (por ejemplo `Role: admin`), con el
   estilo de las de usuarios (`Badge` `outline`, clic para quitar, icono `X`). Cada filtro puede cambiar el texto con
   `formatChip`. Si el valor no está entre las opciones, la etiqueta muestra el valor tal cual. «Clear all» borra
   filtros y búsqueda.
5. **La selección se borra** al cambiar de página, de búsqueda, de filtros o de tamaño de página. «Seleccionar todo»
   marca solo las filas de la página visible, como ahora.
6. **Las columnas ocultas** se leen en el servidor sin registro central: `readHiddenColumns` solo valida el formato, y
   `TableView` ignora ids desconocidos o de columnas `required`. Desaparece `TABLE_COLUMNS`.
7. **La navegación usa siempre `router.replace(..., { scroll: false })`** de `nextjs-toploader/app`, con la lógica de
   `components/dashboard/users/hooks/use-users-filters.ts` que evita que una respuesta vieja pise lo que se acaba de
   escribir.
8. **Todas las listas se ven como `/dashboard/users` y cada una lo arma a su medida.** `TableView` trae siempre las
   mismas piezas con el mismo aspecto; lo que cambia lo pone cada `*-content.tsx` por props: columnas y su `render`,
   filtros y sus opciones (con icono opcional), formato de las etiquetas, acciones por fila y masivas con sus iconos,
   todos los textos visibles (`labels`, incluido el contador con su sustantivo: «users», «logs»), el mensaje vacío
   (`ReactNode`) y botones extra en la barra (`toolbarActions`). Ningún texto, icono ni dato de una lista concreta vive
   dentro de `components/dashboard/table-view/`.
9. **La selección es controlada o interna.** Si se pasan `selectedIds` y `onSelectionChange`, `TableView` usa esos;
   si no, guarda la suya. En los dos modos llama a `onSelectionChange([])` al navegar (decisión 5) y solo entrega a las
   acciones masivas y a la barra los ids que siguen en `rows` (tras un `router.refresh()` pueden desaparecer filas).
10. **Las server actions conservan su formato de respuesta** (`{ response, message, data }` en `getUsers`,
    `getActivityLogs` y `getOperationalLogs`): solo cambia el esquema con que validan los parámetros.

## Puntos que más pueden fallar

1. Escribir en el buscador y, antes de 300 ms, pulsar un filtro: la búsqueda escrita no se puede perder ni volver atrás.
2. Abrir un enlace con parámetros que ya circulan (`/dashboard/logs?userId=abc&source=emails`, `?role=admin&role=user`,
   `?page=abc`, `?pageSize=7`): tiene que abrir la vista correcta sin error. Prueba en la tarea 1.
3. Una cookie de columnas manipulada (ids raros, columnas obligatorias, más de 200 caracteres): se ignora sin romper la
   tabla. Prueba en la tarea 1.
4. Pedir una página que ya no existe tras filtrar: la página redirige a la última válida, como ahora.
5. Marcar filas, cambiar de página y pulsar una acción masiva: no puede actuar sobre filas que ya no se ven (decisión 5).

---

### Tarea 1: definición de listas en la URL

**Archivos:**
- Crear: `lib/table-query.ts`, `lib/table-query.test.ts`, `lib/table-columns.test.ts`, `types/bun-test.d.ts`
- Modificar: `lib/table-columns.ts`, `package.json` (script `test`), `.github/workflows/ci.yml`

**Interfaces:**
- Produce (en `lib/table-query.ts`):

```ts
export type TableFilterDefinition =
  | { param: string; values: readonly string[]; multiple: boolean }
  | { param: string; pattern: RegExp; multiple: false };

export interface TableQueryConfig<F extends string> {
  searchMaxLength?: number; // sin valor = la lista no tiene buscador
  filters: Record<F, TableFilterDefinition>;
}

export interface TableParams<F extends string> {
  page: number;
  pageSize: PageSize;
  q: string;
  filters: Record<F, string[]>;
}

export type RawSearchParams = Record<string, string | string[] | undefined>;

export interface TableQuery<F extends string> {
  config: TableQueryConfig<F>;
  schema: z.ZodType<TableParams<F>>;
  parse(input: RawSearchParams): TableParams<F>;
  toQueryString(params: TableParams<F>): string;
  empty(pageSize?: PageSize): TableParams<F>;
}

export function defineTableQuery<F extends string>(config: TableQueryConfig<F>): TableQuery<F>;
export function getTableRange(page: number, pageSize: number, total: number): { from: number; to: number };
```

- Produce (en `lib/table-columns.ts`, sustituye a la versión con `TableId` y `TABLE_COLUMNS`):
  `getColumnsCookieName(tableId: string): string`,
  `writeHiddenColumnsCookie(tableId: string, hidden: readonly string[]): void` y
  `readHiddenColumns(cookieValue: string | undefined): string[]`.

- [ ] **Paso 1: escribir las pruebas que fallan** en `lib/table-query.test.ts`, con una definición de ejemplo
  `{ searchMaxLength: 100, filters: { role: { param: 'role', values: ['admin', 'user'], multiple: true },
  source: { param: 'source', values: ['emails', 'auth'], multiple: false },
  user: { param: 'userId', pattern: /^[A-Za-z0-9_-]{1,64}$/, multiple: false } } }`:
  - `parse({})` → `{ page: 1, pageSize: 20, q: '', filters: { role: [], source: [], user: [] } }`;
  - `parse({ page: 'abc', pageSize: '7' })` → página 1 y tamaño 20; `parse({ page: '3', pageSize: '50' })` → 3 y 50;
  - `q` se recorta y se corta a 100 caracteres; sin `searchMaxLength`, `q` siempre es `''`;
  - `parse({ role: ['admin', 'bad', 'admin', 'user'] })` → `role: ['admin', 'user']`;
  - `parse({ source: ['bad', 'auth', 'emails'] })` → `source: ['auth']` (el primer valor válido);
  - `parse({ userId: 'abc', source: 'emails' })` → `user: ['abc']`, `source: ['emails']`;
    `parse({ userId: 'a b' })` → `user: []`;
  - `toQueryString` escribe `page` siempre, `pageSize` solo si no es 20, `q` solo si no está vacío y los filtros en el
    orden de la definición: `toQueryString({ page: 2, pageSize: 20, q: 'ana', filters: { role: ['admin', 'user'],
    source: [], user: ['abc'] } })` → `'page=2&q=ana&role=admin&role=user&userId=abc'`;
  - ida y vuelta: pasar `toQueryString(p)` por `URLSearchParams`, juntar las claves repetidas en arrays y llamar a
    `parse` devuelve `p` para el ejemplo anterior;
  - `schema.safeParse` rechaza un valor de filtro fuera de `values` y acepta `empty()`;
  - `getTableRange(1, 20, 0)` → `{ from: 0, to: 0 }`; `getTableRange(3, 20, 45)` → `{ from: 41, to: 45 }`.
- [ ] **Paso 2:** en `lib/table-columns.test.ts`: `readHiddenColumns('role.status')` → `['role', 'status']`;
  `readHiddenColumns(undefined)` → `[]`; un valor de más de 200 caracteres → `[]`; ids con caracteres fuera de
  `[A-Za-z0-9_-]` se descartan; sin repetidos.
- [ ] **Paso 3:** `bun run test` → fallan porque no existen los módulos.
- [ ] **Paso 4:** implementar `lib/table-query.ts` (reutiliza `parsePageSize` y `pageSizeSchema` de
  `lib/list-pagination.ts`; página con el mismo `z.coerce.number().int().min(1).max(1_000_000_000).catch(1)` de hoy) y
  el nuevo `lib/table-columns.ts`. Añadir `types/bun-test.d.ts`, el script `test` y el paso de CI.
- [ ] **Paso 5:** transición. `readHiddenColumns` cambia de firma: cambia ya sus tres llamadas en
  `app/dashboard/users/page.tsx`, `app/dashboard/activity/page.tsx` y `app/dashboard/logs/page.tsx` a
  `readHiddenColumns(cookieStore.get(getColumnsCookieName('<id>'))?.value)`. Conserva `TABLE_COLUMNS`, `TableId` y
  `TableColumnOption` (con un comentario `// Removed in task 4`) porque los siguen usando `ColumnPicker` y
  `system-logs-content.tsx`. Como el servidor ya no descarta ids desconocidos u obligatorios, `ColumnPicker` (que aún
  usa `TABLE_COLUMNS`) filtra `hidden` contra sus columnas antes de contar `visibles/total` y de pintar, y
  `system-logs-content.tsx` calcula `visibleColumnsCount` con ese mismo filtrado.
- [ ] **Paso 6:** `bun run test`, `bun run typecheck`, `bun run lint` y el build en verde.

### Tarea 2: el componente `TableView`

**Archivos:**
- Crear: `components/dashboard/table-view/table-view.tsx`, `table-toolbar.tsx`, `table-active-filters.tsx`,
  `table-bulk-actions-bar.tsx`, `table-row-actions.tsx`, `use-table-url-state.ts`, `types.ts` e `index.ts`, todos en
  `components/dashboard/table-view/`
- Modificar: `components/dashboard/data-table.tsx` (añadir `emptyMessage?: React.ReactNode`, fila única con
  `colSpan` de todas las columnas visibles, casillas incluidas), `components/dashboard/table-footer.tsx` (añadir
  `labels?: Partial<TableFooterLabels>` con los textos actuales como valor por defecto),
  `components/dashboard/column-picker.tsx` (recibe `tableId: string`, `columns: { id: string; label: string;
  required?: boolean }[]` y `labels`) y `components/dashboard/index.ts` (exporta `TableView` y sus tipos)

**Interfaces:**
- Consume: `TableQuery`, `TableParams`, `getTableRange` y `writeHiddenColumnsCookie` de la tarea 1.
- Produce (en `components/dashboard/table-view/types.ts`):

```ts
export interface TableViewColumn<T> {
  id: string;
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
  required?: boolean; // no se puede ocultar
}
export interface TableViewFilterOption {
  value: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>; // Lucide o propio (p. ej. GoogleIcon)
}
export interface TableViewFilter<F extends string> {
  key: F;
  label: string;
  options: TableViewFilterOption[];
  showInPanel?: boolean; // por defecto true
  formatChip?: (option: TableViewFilterOption) => string; // por defecto `${label}: ${option.label}`
}
export interface RowAction<T> {
  id: string;
  label: string;
  icon?: LucideIcon;
  onSelect?: (row: T) => void;
  href?: string;
  disabled?: boolean;
  hint?: string; // texto pequeño a la derecha, p. ej. «OAuth»
  destructive?: boolean;
  separatorBefore?: boolean;
}
export interface BulkActionHelpers { clearSelection: () => void }
export interface BulkAction {
  id: string;
  label: string;
  icon?: LucideIcon;
  onSelect?: (ids: string[], helpers: BulkActionHelpers) => void;
  items?: { id: string; label: string; onSelect: (ids: string[], helpers: BulkActionHelpers) => void }[];
  disabled?: boolean;
  hint?: string; // visible dentro del botón y en `title`
  destructive?: boolean;
}
export interface TableViewLabels {
  searchPlaceholder: string; clearSearch: string; filters: string; clearAll: string; activeFilters: string;
  columns: string; toggleColumns: string; results: (range: { from: number; to: number; total: number }) => string;
  selected: (count: number) => string; clearSelection: string; openRowMenu: string; rowMenuTitle: string;
  removeFilter: (chip: string) => string; // aria-label de cada etiqueta
  empty: React.ReactNode; footer: Partial<TableFooterLabels>;
}
export interface TableViewProps<T extends { id: string }, F extends string> {
  tableId: string;
  basePath: string;
  query: TableQuery<F>;
  params: TableParams<F>;
  rows: T[];
  total: number;
  totalPages: number;
  columns: TableViewColumn<T>[];
  hiddenColumns: string[];
  filters?: TableViewFilter<F>[];
  rowActions?: (row: T) => RowAction<T>[];
  bulkActions?: BulkAction[];
  selectedIds?: string[]; // selección controlada opcional
  onSelectionChange?: (ids: string[]) => void;
  onRowClick?: (row: T) => void;
  labels?: Partial<TableViewLabels>;
  toolbarActions?: React.ReactNode; // botones extra junto a «Columns»
  tableClassName?: string;
}
```

`TableFooterLabels` (en `table-footer.tsx`): `rowsPerPage`, `page: (page, totalPages) => string`, `firstPage`,
`previousPage`, `nextPage` y `lastPage`, con los textos actuales como valor por defecto.

- Produce (en `use-table-url-state.ts`): `useTableUrlState<F>({ basePath, query, params, onChange })` →
  `{ searchQuery, setSearchQuery, filters, toggleFilterValue(key, value), removeFilterValue(key, value), clearAll,
  goToPage, setPageSize, getPageHref, isPending }`. Es la lógica de `use-users-filters.ts` hecha genérica: espera de
  300 ms en la búsqueda, claves pendientes para no pisar lo escrito y conservar en la URL los parámetros que la lista no
  maneja.

- [ ] **Paso 1:** reglas de pintado, sin pruebas automáticas (no hay entorno de componentes; el orquestador lo revisa en
  el navegador):
  - el buscador sale solo si `query.config.searchMaxLength` existe; el botón «Filters», solo si hay algún filtro con
    `showInPanel !== false`; su número cuenta todos los valores marcados;
  - las casillas salen solo si hay `bulkActions`; la barra flotante sale con al menos una fila marcada;
  - la columna de acciones por fila sale solo si hay `rowActions`; es la última, no tiene cabecera ni se puede ocultar,
    y una fila con lista vacía no muestra botón; el menú es un `DropdownMenu` con `rowMenuTitle`, `href` mediante
    `Link` con `asChild`, `separatorBefore` y `destructive`;
  - el clic en una casilla o en el menú de fila no dispara `onRowClick`;
  - sin filas se ve `labels.empty` dentro de la tabla;
  - el aspecto de cada pieza copia el de hoy en `/dashboard/users` (clases incluidas): buscador de
    `search-and-filters.tsx`, popover con botones de opción (con el icono de la opción si lo tiene) y «Clear all» en su
    cabecera, etiquetas de `active-filters.tsx`, barra de `bulk-actions-bar.tsx` (un `BulkAction` con `items` es un
    `DropdownMenu` con `ChevronDown`; `destructive` usa las clases rojas de Delete) y menú de `user-actions.tsx`;
  - textos por defecto genéricos, en inglés: `'Search...'`, `'Clear search'`, `'Filters'`, `'Clear all'`,
    `'Active filters:'`, `'Columns'`, `'Toggle columns'`, contador `` `Showing ${from}–${to} of ${total}` `` y
    `'Showing 0 of 0'` cuando `total` es 0, `` `${count} selected` ``, `'Clear selection'`, `'Open menu'`,
    `'Actions'`, `` `Remove ${chip}` `` y `'No results.'`. Cada lista pasa los suyos;
  - las columnas ocultas que recibe `ColumnPicker` y la tabla se filtran contra `columns` (fuera ids desconocidos y
    `required`) antes de usarse.
- [ ] **Paso 2:** implementar. `TableView` compone `DataTable`, `ColumnPicker` y `TableFooter`; no copies su HTML.
  Transición: `ColumnPicker` pasa a pedir `columns`, así que en esta misma tarea sus tres usuarios actuales
  (`users-content.tsx`, `activity-logs-content.tsx`, `system-logs-content.tsx`) le pasan `columns={TABLE_COLUMNS[...]}`
  sin cambiar nada más. Las tres pantallas siguen viéndose y funcionando igual.
- [ ] **Paso 3:** `bun run test`, `bun run typecheck`, `bun run lint` y el build en verde.

### Tarea 3: `/dashboard/users` con `TableView`

**Archivos:**
- Modificar: `lib/user-list-query.ts` (exporta `userTableQuery = defineTableQuery(...)` con `searchMaxLength: 100` y los
  filtros `role`, `status` y `provider`; `buildUsersWhere(params: TableParams<UserTableFilter>)`),
  `actions/users.ts` (`getUsers` valida con `userTableQuery.schema`), `app/dashboard/users/page.tsx`,
  `components/dashboard/users/users-content.tsx`
- Borrar (todo en `components/dashboard/users/`): `users-table.tsx`, `search-and-filters.tsx`, `active-filters.tsx`,
  `bulk-actions-bar.tsx`, `user-actions.tsx` (sus opciones pasan a `rowActions`), `hooks/use-users-filters.ts`, la
  carpeta `helpers/` y el tipo `Filters` de `types.ts`; quitar sus exportaciones de `users/index.ts`,
  `users/hooks/index.ts` y `components/dashboard/index.ts` (hoy exporta `UsersTable`, `SearchAndFilters`,
  `ActiveFilters`, `UserActions` y `BulkActionsBar`)
- Prueba: `lib/user-list-query.test.ts`

**Interfaces:**
- Consume: tareas 1 y 2.
- Produce: `userTableQuery`, `type UserTableFilter = 'role' | 'status' | 'provider'`.

- [ ] **Paso 1:** pruebas que fallan: `userTableQuery.parse({ role: 'admin', status: ['active', 'x'], provider: 'github' })`
  da esos valores sin `x`; `buildUsersWhere` con `role: ['admin']` contiene `{ role: { in: ['admin'] } }` y con `q: 'ana'`
  busca en `name` y `email` sin distinguir mayúsculas, igual que hoy.
- [ ] **Paso 2:** migrar. Las mismas columnas, filtros, acciones por fila (con sus condiciones: OAuth, admin, usuario
  actual, invitación) y acciones masivas (Activate, Deactivate, Change Role con sus tres opciones y Delete), con los
  mismos diálogos de confirmación. Los textos visibles no cambian: `UsersContent` pasa por `labels`
  `'Search by name or email...'` y el contador `Showing X–Y of N users` / `Showing 0 of 0 users`. Filtros con las
  etiquetas de hoy («Role», «Status», «Auth Provider»), opciones `Admin`/`Moderator`/`User`, las de `USER_STATUS_MAP` y
  las de `PROVIDER_CONFIG` con su icono. La selección es controlada (decisión 9) porque `useUserActions` y los diálogos
  leen `selectedIds`. `PageHeader`, «Add User» y los diálogos siguen fuera de `TableView`. Cambios de aspecto aceptados:
  etiquetas `Role: Admin` (decisión 4) y el mensaje vacío por defecto `No results.`.
- [ ] **Paso 3:** `bun run test`, `bun run typecheck` y `bun run lint` en verde.

### Tarea 4: actividad y registros del sistema con `TableView`

**Archivos:**
- Modificar: `lib/activity-log-query.ts` (`activityLogTableQuery`: búsqueda de 100 caracteres y filtro `action` múltiple),
  `lib/operational-log-query.ts` (`operationalLogTableQuery`: sin búsqueda; `level` múltiple; `source` y `code` de una
  opción; `user` con `param: 'userId'` y el patrón de hoy), sus `build*Where`, las acciones que los usan, las páginas
  `app/dashboard/activity/page.tsx` y `app/dashboard/logs/page.tsx`, `components/dashboard/activity-logs-content.tsx` y
  `components/dashboard/system-logs-content.tsx`; borrar las exportaciones viejas de `lib/table-columns.ts`
- Modificar: `AGENTS.md`, apartado «Dashboard UI Patterns»: «**Lists**: Use `TableView` (search, filters, columns,
  pagination, row and bulk actions); `DataTable` only for small tables without those controls».
- Prueba: `lib/activity-log-query.test.ts` y `lib/operational-log-query.test.ts`

- [ ] **Paso 1:** pruebas que fallan: `operationalLogTableQuery.parse({ userId: 'abc', source: 'emails' })` →
  `user: ['abc']`, `source: ['emails']`; `buildOperationalLogsWhere` con eso filtra por `userId: 'abc'` y
  `source: 'emails'`; `activityLogTableQuery.parse({ action: ['login', 'nope'] })` → `['login']`.
- [ ] **Paso 2:** migrar. Las dos listas adoptan el aspecto de usuarios (buscador, popover con botones de opción,
  etiquetas, contador, pie) con sus propios textos e iconos por `labels` y opciones.
  - Actividad: buscador `'Search by user, email, action, or IP...'`, filtro «Action Type» con las 16 acciones (etiqueta e
    icono de `getActionConfig`), contador `... of N logs` / `Showing 0 of 0 logs`. Conserva el panel lateral al pulsar
    una fila (`onRowClick`) y el botón del ojo pasa a ser una acción por fila «View details» con el icono `Eye`.
  - Registros del sistema: sin buscador; filtros «Level», «Source» y «Code» en el popover; contador `... of N logs`.
    Conserva el aspecto de cada celda (nivel con color, detalles). El filtro `user` (`showInPanel: false`) recibe como
    única opción `{ value: userId, label: '<nombre> (<correo>)' }` armada con el `filterUser` del servidor, o
    `label: 'deleted'` si no existe, para que la etiqueta sea `User: <nombre> (<correo>)` o `User: deleted`. Mensaje
    vacío `No logs match these filters.`
- [ ] **Paso 3:** validación final completa de las restricciones globales y `grep -rn "TABLE_COLUMNS\|TableId"` sin
  resultados.

### Ajustes de diseño ya aplicados tras la revisión en el navegador (2026-10-27)

El contador va en el pie a la izquierda (`TableFooter.summary`) con los números en negrita; buscador y botones a 32 px;
«Filters», `toolbarActions` y «Columns» siempre a la derecha; todo alineado a los 20 px de `PageHeader` (primera y
última celda con `pl-5`/`pr-5`, casilla de selección a la izquierda).

### Tarea 4b: actividad sin iconos de evento y actividad del perfil con `TableView`

Petición de la persona del 2026-10-27: los iconos por tipo de evento sobran (puede haber miles de eventos y no hay
forma de elegir icono para cada uno) y la actividad del perfil debe usar `TableView`.

**Archivos:**
- Crear: `components/dashboard/activity-action-labels.ts` (un solo mapa `action → label` en inglés y
  `getActivityActionLabel(action)`, que devuelve el propio `action` si no tiene etiqueta),
  `components/dashboard/profile-activity-content.tsx` (o el nombre que encaje) y pruebas de la definición nueva.
- Modificar: `lib/table-query.ts` (`TableQueryConfig.paramNames?: { page?: string; pageSize?: string; q?: string }`,
  por defecto `page`, `pageSize`, `q`; `parse`, `toQueryString`, `schema` y `use-table-url-state.ts` los respetan; la
  ida y vuelta con nombres propios tiene prueba), `lib/profile-query.ts` (`profileActivityTableQuery`: sin búsqueda,
  filtro `action` múltiple con `ACTIVITY_ACTIONS`, `paramNames: { page: 'activityPage' }`; `pageSize` sigue siendo
  compartido con sesiones, como hoy), `actions/profile.ts` (nueva `getMyActivityLogs(params)` que valida la sesión y
  el `schema`, filtra por `userId` de la sesión y devuelve `{ response, message, data }` con filas, `total`,
  `totalPages` y `page`; `getProfileData` deja de cargar la actividad), `app/dashboard/profile/page.tsx` (redirige a
  la última página válida conservando `tab` y el resto de parámetros), `components/dashboard/profile-content.tsx`,
  `components/dashboard/activity-logs-content.tsx` e `index.ts`.
- Borrar: `components/dashboard/activity-log.tsx` y sus exportaciones.

- [ ] **Paso 1:** pruebas que fallan: `paramNames` (parse y toQueryString con `activityPage`), y
  `profileActivityTableQuery.parse({ tab: 'activity', activityPage: '2', action: ['login', 'x'] })` →
  página 2 y `action: ['login']`.
- [ ] **Paso 2:** `/dashboard/activity` sin iconos de evento: ni en la columna «Action» (etiqueta de texto con el
  mismo estilo `rounded bg-muted px-2 py-0.5 font-mono text-[13px]`), ni en las opciones del filtro, ni en el panel de
  detalles; la columna «Device» sin el icono del monitor. Usa el mapa compartido. El ojo de «View details» se queda.
- [ ] **Paso 3:** pestaña «Activity» del perfil con `TableView`: tableId `profile-activity`, basePath
  `/dashboard/profile`, columnas Action (required), Details (`provider` o `field: newValue` cuando existan, si no
  `—`), IP Address, Device (navegador / sistema, sin icono) y Time (mismo formato que `/dashboard/activity`); filtro
  «Action Type»; contador `Showing X–Y of N events` / `Showing 0 of 0 events`; mensaje vacío `No activity yet.`. Sin
  `bulkActions` ni `rowActions`. Textos en inglés: desaparecen las etiquetas en español de `activity-log.tsx`.
- [ ] **Paso 4:** las seis validaciones y `grep -rn "activity-log'\|ActivityLog\b"` sin restos de la lista vieja.

### Tarea 4c: sesiones del perfil con `TableView` y revocación masiva

**Archivos:**
- Modificar: `components/dashboard/data-table.tsx` y `table-view/*` (prop genérica
  `isRowSelectable?: (row: T) => boolean`: su casilla sale desactivada, «seleccionar todo» la salta y nunca llega a
  la selección), `lib/profile-query.ts` (`profileSessionsTableQuery`: sin búsqueda ni filtros,
  `paramNames: { page: 'sessionsPage' }`), `actions/sessions.ts` (nueva `revokeSessions(ids: string[])`: valida con
  Zod un array de 1 a 100 ids, comprueba la sesión, borra solo `userId` = usuario actual e `id` distinto de la sesión
  actual, devuelve `{ response, message, data: { count } }` y hace `revalidatePath` como las otras dos),
  `actions/profile.ts` (nueva `getMySessions(params)` con `isCurrent`; `getProfileData` deja de cargar sesiones),
  `app/dashboard/profile/page.tsx`, `components/dashboard/profile-content.tsx` e `index.ts`.
- Borrar: `components/dashboard/active-sessions.tsx` si queda sin uso, y sus exportaciones.

- [ ] **Paso 1:** pruebas: `profileSessionsTableQuery` con `sessionsPage` y que convive con `activityPage` y `tab` en
  la misma URL.
- [ ] **Paso 2:** pestaña «Sessions» con `TableView`: tableId `profile-sessions`, columnas Device (navegador /
  sistema y la etiqueta «Current» en la sesión actual; required), IP Address, Signed in y Expires; contador
  `Showing X–Y of N sessions`; mensaje vacío `No active sessions.`. `rowActions`: «Revoke session» (destructive, no
  sale en la actual) con el mismo `ConfirmDialog` de hoy. `bulkActions`: «Revoke» (destructive) con confirmación
  `Revoke N sessions? Those devices will be signed out immediately.`; la sesión actual no se puede marcar
  (`isRowSelectable`). `toolbarActions`: el botón «Revoke other sessions» de hoy con su confirmación. Tras revocar:
  `toast` y `router.refresh()`.
- [ ] **Paso 3:** las seis validaciones.

### Tarea 5 (repositorio del auditor): traer la plantilla y usar `TableView`

Se hace en `~/Desktop/auditor-skills` después de que la fase 3 esté en `main`, en la rama `feat/table-view`.

- [ ] **Paso 1:** traer la rama de la plantilla (remoto local `template` → `~/Desktop/rapidauth-v2`) con `git merge`.
  Conflictos esperados: `package.json` (`"test"` queda en `bun test lib`), `lib/auditor/bun-test.d.ts` (se borra; vale
  `types/bun-test.d.ts`) y las pantallas de usuarios que el auditor recortó en la fase 2 (sin «Add user», «Resend
  invitation» ni «Reset password»: esas acciones no vuelven).
- [ ] **Paso 2:** «Mis envíos» y la cola del admin con `TableView`, con textos en español por `labels`. Búsqueda por skill y
  repositorio (en la cola también por quién envió); filtro por estado (`queued`, `checking`, `running`, `done` y
  `failed`); en la cola también por tipo (`analysis` y `fingerprint_check`). Las consultas de `lib/auditor/queries.ts`
  pasan a recibir `TableParams` y devuelven `total` y `totalPages`. Acción por fila: «Ver avance» o «Ver análisis» según el
  estado. Acciones masivas de la cola: «Reintentar» y «Cancelar» desactivadas con la nota «Disponible en la fase 7».
- [ ] **Paso 3:** el orquestador revisa en el navegador `/dashboard/users`, `/dashboard/activity`, `/dashboard/logs`,
  `/dashboard/submissions` y `/dashboard/auditor/queue`, y la persona da el visto bueno antes de integrar la plantilla.
