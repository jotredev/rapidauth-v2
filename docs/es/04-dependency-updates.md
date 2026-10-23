# Actualización de dependencias

RapidAuth mantiene cada dependencia directa en una versión exacta en `package.json`. Así, las instalaciones son predecibles y una dependencia solo cambia mediante una actualización revisada. Bun usa `bunfig.toml` (`[install] exact = true`) y Dependabot usa `versioning-strategy: increase` para conservar los especificadores exactos en sus pull requests. Acepta un pull request solo cuando CI esté en verde, incluidas las pruebas de punta a punta.

## Revisar un pull request de Dependabot

Para cada actualización propuesta:

1. Lee las notas de versión y los cambios enlazados del paquete y de todos los paquetes del grupo. Busca cambios incompatibles, API eliminadas o renombradas, pasos de migración, correcciones de seguridad, versiones de runtime compatibles y cambios en dependencias pares.
2. Confirma que la versión sea estable, compatible con este proyecto y con los demás paquetes modificados. Revisa las versiones exactas en `package.json` y los cambios resueltos en `bun.lock`.
3. Revisa los resultados de CI y el diff generado. Acepta el pull request solo si entiendes el cambio, todos los trabajos de CI están en verde y completaste la lista de su etapa.
4. Ciérralo o déjalo pendiente si es una versión preliminar, rebasa un límite de herramientas, necesita una migración que no está incluida, rompe una comprobación o no puedes verificar su comportamiento. Anota el motivo y revísalo en la etapa planeada correspondiente.

Dependabot agrupa las actualizaciones menores y de parche. Puedes separar un paquete del grupo si requiere una investigación propia.

## Actualizaciones grandes por etapas

La actualización de octubre de 2026 sirve como modelo: primero versiones menores y de parche; luego librerías críticas como Better Auth; después versiones mayores; y al final componentes de shadcn. Mantén cada etapa aislada y termina su lista de comprobación antes de iniciar la siguiente. **En cada etapa** deben pasar todos estos puntos:

- [ ] CI está en verde, incluidos lint, versiones exactas, revisión de tipos, build de producción, auditoría de dependencias, sincronización del tema y trabajos de Docker.
- [ ] Funcionan el inicio y cierre de sesión con credenciales válidas e inválidas.
- [ ] Funcionan la creación, el cambio y la recuperación de contraseñas, incluidos los pasos de verificación de esos flujos.
- [ ] Funcionan la verificación de email con código de 6 cifras y el reenvío del código de verificación.
- [ ] Turnstile funciona en registro, reenvío del código de verificación y recuperación de contraseña; se rechazan tokens inválidos o ausentes.
- [ ] Revisa visualmente las páginas principales frente a la versión anterior e inspecciona las áreas modificadas.
- [ ] Compila la imagen de Docker de producción y ejecuta su comprobación de salud o las pruebas de Docker del proyecto.

### Etapa 1: versiones menores y de parche

Revisa las actualizaciones agrupadas de Dependabot y mantén juntas las versiones menores y de parche compatibles. Separa un paquete si sus notas de versión o los resultados de CI requieren investigarlo individualmente. Completa la lista de comprobación antes de aceptar la etapa.

### Etapa 2: librerías críticas como Better Auth

Actualiza una librería crítica a la vez. Lee sus notas de migración y seguridad, verifica la configuración de autenticación y los adaptadores, y prueba el inicio de sesión, las sesiones, las contraseñas y los flujos de email. Completa la lista de comprobación antes de aceptar cada actualización.

**Etapa 2 completada (18 de octubre de 2026):** Better Auth está fijado en 1.7.10. Sus paquetes coordinados de runtime y adaptadores también se resolvieron en 1.7.10; `@better-auth/utils` se mantiene en 0.5.0 porque lleva una línea de versiones independiente y no existe una publicación 1.7.10. La comparación del esquema 1.7 solo requirió los campos `verified`, `failedVerificationCount` y `lockedUntil` en `twoFactor`; `account` permanece igual que en 1.6 y `rateLimit` conserva `id`, `key`, `count` y `lastRequest`. Siguen vigentes los límites de TypeScript, ESLint y Node indicados abajo, y las dependencias continúan fijadas a versiones exactas.

#### Actualizar una instalación existente a Better Auth 1.7

En **cada entorno** (desarrollo, staging y producción), ejecuta `bun run db:deploy` para aplicar las migraciones y agregar `verified`, `failedVerificationCount` y `lockedUntil` a `twoFactor`; después ejecuta `bun run db:seed` para normalizar las cuentas de contraseña antiguas. Sin este paso, el administrador creado por un seed anterior no puede iniciar sesión con Better Auth 1.7. El seed se puede repetir de forma segura y no borra datos.

### Etapa 3: versiones mayores

Actualiza un paquete mayor o un conjunto estrechamente relacionado a la vez. Sigue su guía de migración, actualiza el código y la configuración del proyecto, y revisa los requisitos de dependencias pares. Completa la lista de comprobación antes de aceptar cada actualización mayor.

**Etapa 3 completada (18 de octubre de 2026):** TypeScript está fijado en 6.0.3 y `typescript-eslint` en 8.71.2 como dependencia directa de desarrollo, así `eslint-config-next` y todos los paquetes `@typescript-eslint/*` usan esa misma versión sin overrides. TypeScript permanece en 6.0.x porque `typescript-eslint` requiere TypeScript `<6.1.0`. TypeScript 7 queda pendiente hasta que `typescript-eslint` lo admita. `dotenv` está fijado en 18.0.8, React Email en 6.11.3 y Recharts en 3.10.1. Los componentes y el render de React Email ahora se importan de `react-email`, que es dependencia de producción porque la app genera los correos con él; su servidor de vista previa no se incluye en el build de producción. Además, `bun run email:preview` abre las plantillas en `http://localhost:3200`.

### Etapa 4: componentes de shadcn

Usa la CLI local de shadcn 4.22.0 fijada por el proyecto para actualizar o agregar componentes, por ejemplo `bunx shadcn add button`. `components.json` usa `radix-vega`: el estilo antiguo `default` está congelado, mientras que `radix-vega` conserva la familia de primitivas Radix y ofrece el conjunto actual de componentes shadcn. Cambiar el estilo no requiere cambiar los colores ni las fuentes del proyecto.

**Etapa 4 completada (18 de octubre de 2026):** Se regeneraron los 46 componentes de UI existentes con `radix-vega` y se agregaron estos 14: `attachment`, `bubble`, `button-group`, `direction`, `empty`, `field`, `item`, `kbd`, `marker`, `message`, `native-select`, `resizable`, `spinner` y `trace`. La dependencia común de primitivas queda fijada exactamente como `radix-ui` 1.8.1; se quitan las dependencias individuales `@radix-ui/react-*` cuando ningún archivo del repositorio las importa. Se reutiliza la dependencia existente `react-resizable-panels`.

Actualmente la CLI importa `cn` del paquete independiente `cn` y agrega esa dependencia, aunque este proyecto conserva su helper `cn`, basado en `clsx` y `tailwind-merge`, en `@/lib/utils`. El esquema de `components.json` admite el alias `utils`, pero no ofrece una opción para elegir el paquete desde el que se importa `cn`. Por eso, todos los imports generados usan `@/lib/utils` y ESLint rechaza los imports del paquete `cn` con un mensaje que indica el helper local. La CLI también bajó Recharts a 3.8.0; se restauró la versión fijada 3.10.1. Además, se borró el duplicado `hooks/use-mobile.ts` y se conserva el hook existente `.tsx`.

Se excluyeron deliberadamente estos componentes: `combobox` (agrega `@base-ui/react`, una familia de primitivas distinta), `code-block` (agrega `shiki`), `message-scroller` y `questionnaire` (ambos agregan `@shadcn/react`). Después de la migración se revisan en ambos temas el contraste de la casilla de términos del registro y el espacio alrededor de los enlaces Terms of Service y Privacy Policy.

Compara el diff generado con las personalizaciones locales y restáuralas o combínalas de forma deliberada; no reemplaces componentes personalizados a ciegas. Ejecuta `bun run theme:sync-classic` para copiar los cambios de UI compartida al tema Classic, inspecciona el resultado y ejecuta `bun run theme:sync-classic --check`. Completa la lista de comprobación antes de aceptar las actualizaciones de componentes.

## Límites de herramientas

- **TypeScript:** permanece en 6.0.x mientras `typescript-eslint` requiera TypeScript `<6.1.0`. TypeScript 7 queda pendiente hasta que `typescript-eslint` lo admita. Antes de elegir una versión, revisa el rango de dependencia par de las herramientas instaladas.
- **ESLint:** permanece en la versión 9. La versión de `eslint-plugin-react` incluida por `eslint-config-next` actualmente admite ESLint 9; revisa esa compatibilidad antes de pasar a una versión mayor más nueva.
- **Node.js:** usa una versión LTS con soporte activo. Dependabot ignora las actualizaciones mayores de Node para que el proyecto pase manualmente a la siguiente LTS.

Para pasar Node a la siguiente LTS, actualiza la imagen base de Node en cada etapa de `Dockerfile` y en `docker/Dockerfile.dev`, actualiza `@types/node` a la versión mayor correspondiente y revisa cualquier declaración de versión de Node en CI o en la configuración del proyecto. Mantén `packageManager` de `package.json` alineado si también cambias la versión de Bun; en este proyecto identifica Bun, no Node. CI lee la versión de Bun desde `package.json`. Reconstruye y valida las imágenes de desarrollo y producción, y completa la lista de comprobación. Cambia las exclusiones de Node en Dependabot solo si el proyecto modifica deliberadamente su política de actualizaciones manuales de LTS.

## Agregar o actualizar una dependencia

Agrega una dependencia con su versión completa exacta, por ejemplo `bun add paquete@1.2.3`, o no indiques la versión con `bun add paquete`. No uses versiones incompletas como `bun add paquete@7`, porque Bun las guarda como un rango. `bunfig.toml` establece versiones exactas por defecto y `bun run deps:check` las verifica. Para una actualización deliberada, cambia a la versión exacta elegida, ejecuta `bun install` y revisa que `bun.lock` cambie solo como se esperaba. Sigue la etapa aplicable y su lista de comprobación. Mantén `bun install --frozen-lockfile` funcionando para que CI instale la resolución confirmada sin cambiarla.

## Vista previa de plantillas de correo

Ejecuta `bun run email:preview` para abrir las plantillas de `emails/` en `http://localhost:3200`. El servidor de vista previa usa un puerto separado de la app.
