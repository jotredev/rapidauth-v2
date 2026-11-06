# Actualizaciones de la plantilla

Este proyecto se creó a partir de una plantilla. Cuando la plantilla publica una versión nueva, `bun run template:pull` trae esas mejoras a tu proyecto sin sobrescribir tu trabajo. Tú decides cuándo ejecutarlo; nada se actualiza solo.

## Cuándo usarlo

Ejecútalo cuando quieras las últimas correcciones y funciones de la plantilla, por ejemplo después de leer sus notas de versión. Solo funciona en un proyecto que ya se inicializó con `bun run project:init`. Dentro de la plantilla misma se niega a correr.

## Antes de ejecutarlo

El comando se niega a empezar, y no cambia nada, en estos casos:

- **El árbol de trabajo de Git tiene cambios sin guardar.** Haz commit o descártalos primero. Así el pull es fácil de revisar y de deshacer.
- **Un pull anterior dejó conflictos.** Si en el proyecto sigue algún archivo `*.pull-conflict-*` o un archivo con marcadores de conflicto, resuélvelo primero (consulta «Resolver conflictos» más abajo).
- **El proyecto no está inicializado**, o `.setup/project.json` falta o no es válido.
- **No hay red.** El comando lee las versiones publicadas de la plantilla desde Git.

## Ejecutarlo

```bash
bun run template:pull
```

Opciones útiles:

| Opción | Qué hace |
| --- | --- |
| `--dry-run` | Muestra qué se actualizaría, añadiría, borraría y quedaría en conflicto. No escribe nada. Úsala primero si tienes dudas. |
| `--allow-major` | Acepta el salto a una versión mayor nueva (por ejemplo de 1.4.0 a 2.0.0). |

## Qué versión trae

- Mira las etiquetas de versión de la plantilla (`X.Y.Z`, como `2.4.0`) y elige la **más alta**, comparando números (así `2.10.0` es más nueva que `2.9.0`).
- Si esa versión no es más nueva que la que ya tiene tu proyecto, te dice que estás al día. Nunca vuelve a una versión anterior.
- Una versión **mayor** nueva (el primer número crece) puede traer cambios incompatibles. El comando se detiene y te pide leer las notas de versión de la plantilla y volver a ejecutarlo con `--allow-major`.
- Si salta varias versiones de una vez, lista las versiones intermedias.
- La versión que tiene tu proyecto se guarda en `.setup/project.json`.

## Qué viaja y qué no

Cada archivo pertenece a una de cuatro clases:

| Clase | Qué significa | Archivos |
| --- | --- | --- |
| Plantilla | Viaja. El pull la actualiza. | Código de la aplicación, `scripts/`, `prisma/` (con las migraciones), `docker/`, `.github/`, `.husky/`, `.agents/`, `.claude/`, `skills-lock.json`, `docs/en/`, `docs/es/`, `AGENTS.md` y los archivos de configuración de la raíz |
| Arranque | `project:init` la escribió por ti. Después es tuya y el pull nunca la toca. | `README.md`, `app/page.tsx`, `components/landing-content.tsx`, `config/site.ts` y las copias de los dos archivos de la landing dentro de cada carpeta de `themes/` |
| Proyecto | Es tuya. El pull nunca la toca. | `.env` y otros archivos `.env*` (no los `.example`), `docker/.env`, `.setup/`, `bun.lock`, `.forge614/` |
| Solo plantilla | Es parte de la plantilla y nunca llega a un proyecto. | `docs/superpowers/`, el código de `project:init` y su guía |

Los archivos que Git ignora no existen para el pull. Además, el pull aplica el nombre de tu proyecto a lo que trae, con las respuestas guardadas en `.setup/project.json`, así que nunca recibes el nombre propio de la plantilla.

### Quedarte con un archivo de la plantilla

Si cambiaste un archivo de la clase plantilla y quieres que el pull lo deje en paz para siempre, anótalo en `.setup/template-exclusions.json`:

```json
{
  "schemaVersion": 1,
  "exclude": [
    ".agents/skills/mi-skill-propia/",
    "lib/special.ts"
  ]
}
```

- Cada entrada es una ruta exacta, o una carpeta que termina en barra (cubre todo lo que hay dentro).
- Las rutas son relativas a la raíz del proyecto y usan barras normales. No se permiten comodines (`*`), `..` ni rutas absolutas.
- El archivo es opcional. Si no es válido, el pull se detiene y te explica por qué.

## Cómo se fusionan los archivos

Para cada archivo, el pull compara tres estados: la versión de la plantilla de la que viene tu proyecto, la versión nueva de la plantilla y tu archivo.

- **Solo la plantilla lo cambió:** se toma la versión nueva (también archivos nuevos y borrados).
- **Solo tú lo cambiaste:** tu archivo se queda como está.
- **Ambos lo cambiaron:** Git fusiona los dos cambios. Si tocan líneas distintas, la fusión es automática. Si tocan las mismas líneas, el archivo conserva ambas versiones marcadas para que tú decidas (un conflicto).
- **Un lado lo borró y el otro lo cambió:** cuenta como conflicto y se conserva tu archivo.
- **Un archivo binario cambió en los dos lados:** se conserva el tuyo y la versión de la plantilla se escribe al lado.

## Resolver conflictos

El comando termina con normalidad incluso con conflictos y los lista al final. En un archivo de texto, ábrelo y busca los marcadores de conflicto. Un conflicto se ve así (aquí los marcadores aparecen con sangría; en el archivo real empiezan en la primera columna):

```text
  <<<<<<< project
  tu versión de las líneas
  ||||||| template 2.3.0
  las líneas como estaban en la versión que tenías
  =======
  la versión nueva de las líneas
  >>>>>>> template 2.4.0
```

1. Decide cómo deben quedar las líneas finales: las tuyas, las de la plantilla o una mezcla.
2. Borra todas las líneas de marcadores (la primera empieza con signos «menor que», la última con signos «mayor que», y en medio hay una línea de barras verticales y una de signos igual) y las líneas que no quieras.
3. Guarda el archivo.

Cuando se conservó el archivo del proyecto y el lado de la plantilla se escribió al lado, verás un archivo con un nombre como `lib/example.ts.pull-conflict-2.4.0`. Compáralo con tu archivo, copia a tu archivo lo que quieras y **borra el archivo `*.pull-conflict-*`**.

Mientras quede algún marcador o algún archivo `*.pull-conflict-*`, el siguiente `template:pull` se niega a correr.

## Siguientes pasos después de un pull

El comando imprime los pasos que aplican. Los más comunes:

1. `bun install`, cuando cambió `package.json`. Resuelve antes sus conflictos. También actualiza `bun.lock`. El pull nunca lo ejecuta por ti.
2. `bun run db:deploy`, cuando llegaron migraciones nuevas.
3. `bun run theme:sync-classic`, cuando cambiaron los archivos que copia el tema Classic.
4. Revisa el resultado con `git diff`, ejecuta `bun run lint`, `bun run typecheck` y `bun run test`, y haz commit en tu propia rama.

El pull **nunca hace commit**. Además escribe todo en un solo paso: si algo falla a la mitad, se deshacen todos los cambios.

Si algún archivo traído todavía menciona el nombre de la plantilla, el comando te avisa y los lista para que los renombres a mano. El siguiente pull manejará esa grafía por sí solo.

## Códigos de salida

| Código | Significado |
| --- | --- |
| `0` | Terminó (también con conflictos por resolver) o ya estaba al día. |
| `1` | Se negó o falló sin cambiar nada (árbol con cambios, conflictos pendientes, sin red, versión mayor nueva sin `--allow-major`...). |
| `2` | Argumentos inválidos. |
