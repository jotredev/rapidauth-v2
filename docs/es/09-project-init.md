# Crea tu proyecto desde la plantilla

Esta guía es solo para el repositorio de la plantilla. `bun run project:init` convierte una copia nueva de RapidAuth en un proyecto propio: tu nombre en todas partes, sin restos de la plantilla y listo para arrancar. El comando, su código y esta guía se borran de tu proyecto al terminar.

## Antes de empezar

1. Crea tu copia: en GitHub, abre el repositorio de la plantilla y pulsa **Use this template**, o clónalo. Una copia hecha con «Use this template» tiene un solo commit y no tiene historial; es lo esperado.
2. Abre una terminal en la carpeta de tu copia y ejecuta `bun install`.
3. Comprueba que Git no tenga cambios sin guardar (`git status` no muestra nada). Si los hay, el comando se niega a correr.
4. Comprueba la conexión a internet: el comando descarga el historial de la plantilla para averiguar de qué versión viene tu copia.

## Ejecutarlo

```bash
bun run project:init
```

El init corre **una sola vez**. Si el proyecto ya está inicializado, el comando se detiene con un error y no hay opción para forzarlo.

### Qué pregunta

1. **Nombre del proyecto**, por ejemplo `Acme Portal`.
2. **Slug del proyecto**: minúsculas, dígitos y guiones, sugerido a partir del nombre (`acme-portal`).
3. **Descripción de una línea**: se usa en el README nuevo y en la landing. Puede quedar vacía.
4. **Repositorio de GitHub** (`dueño/repo`): se sugiere desde `origin` cuando ya apunta a tu repositorio. Define la imagen de Docker por defecto (`ghcr.io/dueño/repo`) y la línea `git clone` de la guía del VPS. Si lo dejas vacío, se escribe un marcador visible `OWNER/<slug>` para que lo reemplaces.
5. **¿Cómo quieres arrancar?**
   - **Usar Docker en local** (recomendada): crea `.env` con valores locales, levanta PostgreSQL y Mailpit con Docker, aplica las migraciones y termina con «Corre `bun dev` y abre http://localhost:3000». Si el puerto 5432 está ocupado, elige uno libre. Si Docker no está o no responde, termina y te dice qué hacer.
   - **Poner mis valores de producción ahora**: ejecuta `bun run setup:prod`. La base de datos que configures ahí es la que la app también usa en tu computadora.
   - **Lo configuro después**: no toca `.env` y muestra los dos caminos.

Para saltarte las preguntas, pasa banderas: `--name`, `--slug`, `--description`, `--repo`, `--start docker|prod|later`. Sin terminal, `--name`, `--slug` y `--start` son obligatorias.

## Qué cambia

- Renombra toda forma del nombre de la plantilla en los archivos versionados: textos, correos, el emisor del segundo factor, el nombre del paquete, el nombre del proyecto de Docker, el usuario y la base local, la documentación y los temas.
- Reinicia `package.json` a la versión `0.1.0`.
- Borra `.forge614/` (la carpeta de memoria de Engram de la plantilla; Engram crea una nueva para tu proyecto), `docs/superpowers/` y el código, las pruebas y la documentación de `project:init`.
- Reemplaza `README.md`, `app/page.tsx` y `components/landing-content.tsx` por versiones neutras con tu nombre.
- Escribe `.setup/project.json` con tus respuestas y la versión de la plantilla de la que viene tu copia. `template:pull` lo usa después.
- Ejecuta `bun install` (para actualizar `bun.lock`) y `bun run theme:sync-classic`.

Es atómico: calcula todos los cambios antes y, si falla alguna escritura o queda alguna mención de la plantilla, restaura cada archivo tal como estaba.

**No hace commit y no toca el remoto de Git.** Revisa los cambios con `git status` y haz commit en tu propia rama.

## Avisos al final

- **`origin` todavía apunta a la plantilla.** Cámbialo antes de abrir el proyecto con un agente de IA: `git remote set-url origin <tu repositorio>`. Si no, Engram vuelve a ligar la carpeta a la memoria de la plantilla.
- **No hay `.env`.** Pasa cuando elegiste «después», o cuando Docker o el setup de producción no crearon uno. Cada commit ejecuta el build del pre-commit, que necesita `SUPPORT_EMAIL` y las demás variables obligatorias, así que tu primer commit falla hasta que las tengas. Arranca con Docker (`cd docker && docker compose up -d db mailpit`, y `bun dev` crea `.env`), ejecuta `bun run setup:prod` o crea `.env` a partir de `.env.example`.

## Si lo ejecutas dentro de la propia plantilla

Cuando `origin` es el repositorio de la plantilla, el init te pide escribir el slug de la plantilla para confirmar (o pasar `--confirm-template <slug>`), porque convertiría la plantilla en un proyecto y borraría su carpeta de memoria. Hazlo solo en una copia.

## Recibir actualizaciones de la plantilla después

Consulta la guía de actualizaciones de la plantilla (`docs/es/10-template-updates.md`): `bun run template:pull`.

## Códigos de salida

| Código | Significado |
| --- | --- |
| `0` | El proyecto se inicializó (también cuando el paso de arranque dio avisos). |
| `1` | Se negó o falló sin cambiar nada. |
| `2` | Argumentos inválidos. |
