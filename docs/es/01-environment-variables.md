# Variables de entorno

Esta referencia cubre todas las variables que leen la aplicación y los scripts de setup. El archivo `.env.example` sirve como plantilla para copiar. Nunca subas secretos reales al repositorio.

## Base de datos

### `DATABASE_URL`

- **Propósito:** Conexión PostgreSQL usada por la app, Prisma y los scripts de base de datos.
- **Obligatoria:** En desarrollo y producción.
- **Dónde obtenerla:** Copia la cadena de conexión del proveedor PostgreSQL, por ejemplo Neon.
- **Formato de ejemplo:** `postgresql://USUARIO:CONTRASENA@HOST:5432/BASE?sslmode=require`
- **Base local de Docker:** `postgresql://rapidauth:rapidauth@localhost:5432/rapidauth?sslmode=disable` (usa tu `DB_PORT` si lo cambiaste).
- **Advertencia:** `sslmode=disable` solo se usa con la base PostgreSQL local en Docker. Nunca lo uses en producción.
- **Secreta:** Sí. Contiene credenciales de la base de datos.

### `DOCKER_DATABASE`

- **Propósito:** Activa el inicio automático del servicio PostgreSQL local en Docker antes de que `bun dev` ejecute lint y Next.js.
- **Obligatoria:** No. Su valor predeterminado es `false`; `init:setup` la establece como `true` cuando eliges una base local en Docker.
- **Valores:** `true` o `false`. Solo el valor exacto `true` inicia Docker. Al elegir una base externa, el asistente elimina esta variable; al conservar una `DATABASE_URL` existente, también conserva su valor actual.
- **Secreta:** No.

## Better Auth

### `BETTER_AUTH_SECRET`

- **Propósito:** Firma y cifra los datos de sesión de Better Auth.
- **Obligatoria:** En desarrollo y producción.
- **Dónde obtenerla:** Genera un valor único con `openssl rand -hex 32` o `node -p "require('node:crypto').randomBytes(32).toString('hex')"`.
- **Formato de ejemplo:** `64-caracteres-hexadecimales-aleatorios`
- **Secreta:** Sí. Usa un valor diferente por entorno y nunca lo expongas al cliente.

### `BETTER_AUTH_URL`

- **Propósito:** URL base pública que Better Auth usa para crear callbacks y enlaces de correo.
- **Obligatoria:** En desarrollo y producción.
- **Dónde obtenerla:** Usa `http://localhost:3000` localmente y la URL HTTPS canónica de cada entorno publicado.
- **Formato de ejemplo:** `https://auth.example.com`
- **Secreta:** No. Debe coincidir con la URL desde la que se sirve la app.

## Limpieza programada e IP del cliente

### `CRON_SECRET`

- **Propósito:** Protege la ruta opcional `GET /api/cron/cleanup` que usa Vercel Cron o el workflow incluido de GitHub Actions.
- **Obligatoria:** No. Si falta o tiene menos de 32 caracteres, la ruta queda desactivada y responde HTTP 404.
- **Dónde obtenerla:** Ejecuta `bun run setup:cleanup` para generar un secreto aleatorio de 64 caracteres, o genera uno equivalente por tu cuenta.
- **Secreta:** Sí. Usa el mismo valor en la aplicación desplegada y en su programador; nunca la expongas al navegador ni la subas al repositorio.

### `TRUSTED_PROXY`

- **Propósito:** Elige la única cabecera que RapidAuth puede confiar como IP del cliente para límites, registros de actividad y sesiones de Better Auth.
- **Obligatoria:** No. El valor seguro predeterminado es `none`.
- **Valores:** `none`, `vercel`, `cloudflare` o `proxy`.
- **Comportamiento:** Un valor desconocido se trata como `none` y genera un aviso al arrancar. Producción también avisa una sola vez con `none`, porque los límites por IP quedan desactivados; los límites por correo y usuario siguen funcionando.
- **Secreta:** No. Ejecuta `bun run setup:proxy` o consulta [Limpieza programada y proxy de confianza](07-scheduled-cleanup.md).

## Correo

### `EMAIL_DELIVERY`

- **Propósito:** Elige el transporte de correo. El valor predeterminado `resend` envía mediante Resend; `outbox` guarda los mensajes de prueba en disco.
- **Obligatoria:** No.
- **Valores:** `resend` o `outbox`.
- **Advertencia:** `outbox` es solo para pruebas automatizadas y la aplicación lo rechaza en producción.
- **Secreta:** No.

### `EMAIL_OUTBOX_DIR`

- **Propósito:** Carpeta donde `EMAIL_DELIVERY=outbox` guarda mensajes JSON, incluidos destinatario, asunto, HTML y enlace principal.
- **Obligatoria:** No. El valor predeterminado es `.e2e-outbox/`.
- **Advertencia:** Solo para pruebas; Git ignora la carpeta predeterminada.
- **Secreta:** No.

### `RESEND_API_KEY`

- **Propósito:** Autoriza el envío de correo mediante Resend.
- **Obligatoria:** Para enviar correos en desarrollo y producción; usa credenciales de producción en producción.
- **Dónde obtenerla:** Crea una API key en el panel de Resend.
- **Formato de ejemplo:** `re_reemplazar_con_tu_api_key`
- **Secreta:** Sí. Mantenla en el servidor.

### `FROM_EMAIL`

- **Propósito:** Nombre y dirección del remitente de correos de verificación y contraseñas.
- **Obligatoria:** En desarrollo hay un remitente de respaldo; para enviar correo en producción se requiere una dirección autorizada por Resend.
- **Dónde obtenerla:** Elige una dirección en un dominio verificado en Resend.
- **Formato de ejemplo:** `RapidAuth <noreply@example.com>`
- **Secreta:** No. Verifica el dominio antes de enviar correo en producción.

## Soporte

### `SUPPORT_EMAIL`

- **Propósito:** Dirección de correo electrónico pública para soporte y contacto legal. Se muestra en la página `/support`, en las páginas legales (`/terms` y `/privacy`), y en los correos de aviso de seguridad y eliminación de cuenta.
- **Obligatoria:** Obligatoria en builds de producción (`next build` falla si falta o no es válida). Opcional en desarrollo (muestra un texto indicando que la configuración está pendiente).
- **Dónde obtenerla:** Configura la dirección de buzón de soporte (ej. `soporte@tudominio.com`). Ejecuta `bun run init:setup --only support` (o `bun run setup:support`) para configurarla.
- **Formato de ejemplo:** `soporte@example.com`
- **Nota de compilación:** El valor se fija durante el build para páginas estáticas (`/terms` y `/privacy`).
- **Secreta:** No. Es una dirección de contacto pública.

## Turnstile

### `NEXT_PUBLIC_TURNSTILE_SITE_KEY`

- **Propósito:** Clave pública que muestra el widget en el navegador.
- **Obligatoria:** Opcional para `next dev`; se requiere una clave real en cada `next build`, incluidos producción, staging, vistas previas y CI.
- **Dónde obtenerla:** Crea un widget de Cloudflare Turnstile. Consulta [Cloudflare Turnstile](02-turnstile.md).
- **Formato de ejemplo:** `tu-site-key-real-de-turnstile`
- **Secreta:** No. Los valores `NEXT_PUBLIC_*` se incrustan en el bundle del cliente al compilar; cambiar esta clave requiere un build nuevo.

### `TURNSTILE_SECRET_KEY`

- **Propósito:** Valida en el servidor los tokens de Turnstile.
- **Obligatoria:** Opcional para `next dev`; se requiere una clave real en cada `next build` y en el servidor de producción en ejecución.
- **Dónde obtenerla:** Copia la Secret Key del mismo widget de Cloudflare Turnstile que la site key.
- **Formato de ejemplo:** `tu-secret-key-real-de-turnstile`
- **Secreta:** Sí. Mantenla en el servidor. En Docker, móntala con BuildKit durante el build y vuelve a proporcionarla al contenedor en ejecución.

## Monitoreo de errores (Sentry)

Todas las variables de Sentry son opcionales. Si `NEXT_PUBLIC_SENTRY_DSN` está vacía o no es válida, el SDK no se inicializa ni hace peticiones. Consulta la [guía paso a paso de monitoreo de errores](06-error-monitoring.md).

### `NEXT_PUBLIC_SENTRY_DSN`

- **Propósito:** Activa los reportes de errores de Sentry en el servidor y el navegador.
- **Obligatoria:** No. Déjala vacía para mantener Sentry completamente apagado.
- **Dónde obtenerla:** Sentry Project Settings → Client Keys (DSN).
- **Secreta:** No. Un DSN es una clave pública de enrutamiento y se incrusta en el bundle del cliente.
- **Validación:** Un valor inválido deja Sentry apagado y produce un solo aviso al arrancar.

### `SENTRY_ORG`, `SENTRY_PROJECT` y `SENTRY_AUTH_TOKEN`

- **Propósito:** Suben los source maps durante el build para mostrar los archivos y líneas originales en las pilas de producción.
- **Obligatorias:** No. La subida solo ocurre cuando están presentes los tres valores.
- **Dónde obtenerlas:** Copia los slugs de organización y proyecto desde Sentry Settings. Crea el token en Organization Settings → Developer Settings → Auth Tokens con solo `org:read` y `project:releases`.
- **Secreta:** Solo `SENTRY_AUTH_TOKEN` es secreto. Se usa únicamente en el build, nunca llega al navegador y Docker debe montarlo como secreto de BuildKit, no como argumento ni capa de entorno.

### `SENTRY_TRACES_SAMPLE_RATE`

- **Propósito:** Define la fracción de trazas de rendimiento enviadas a Sentry.
- **Obligatoria:** No. El valor predeterminado es `0`, por lo que solo se reportan errores.
- **Valores:** Un número entre `0` y `1`; por ejemplo, `0.1` toma aproximadamente el diez por ciento de las trazas.
- **Secreta:** No.

## OAuth

Para cualquiera de los proveedores, agrega la URL de callback correspondiente a la aplicación OAuth: `<BETTER_AUTH_URL>/api/auth/callback/google` o `<BETTER_AUTH_URL>/api/auth/callback/github`. Por ejemplo, el callback local de Google es `http://localhost:3000/api/auth/callback/google`.

### `GOOGLE_CLIENT_ID`

- **Propósito:** Identifica la aplicación OAuth de Google.
- **Obligatoria:** No, salvo que habilites el inicio con Google, en desarrollo o producción.
- **Dónde obtenerla:** Google Cloud Console → APIs & Services → Credentials.
- **Formato de ejemplo:** `1234567890-ejemplo.apps.googleusercontent.com`
- **Secreta:** No. Configura la URL de callback indicada arriba.

### `GOOGLE_CLIENT_SECRET`

- **Propósito:** Autoriza a RapidAuth ante la aplicación OAuth de Google.
- **Obligatoria:** No, salvo que habilites el inicio con Google, en desarrollo o producción.
- **Dónde obtenerla:** Google Cloud Console, junto con el client ID.
- **Formato de ejemplo:** `reemplazar-con-google-client-secret`
- **Secreta:** Sí. Mantenla en el servidor.

### `GITHUB_CLIENT_ID`

- **Propósito:** Identifica la aplicación OAuth de GitHub.
- **Obligatoria:** No, salvo que habilites el inicio con GitHub, en desarrollo o producción.
- **Dónde obtenerla:** GitHub Settings → Developer settings → OAuth Apps.
- **Formato de ejemplo:** `Iv1.ejemplocliente`
- **Secreta:** No. Configura la URL de callback indicada arriba.

### `GITHUB_CLIENT_SECRET`

- **Propósito:** Autoriza a RapidAuth ante la aplicación OAuth de GitHub.
- **Obligatoria:** No, salvo que habilites el inicio con GitHub, en desarrollo o producción.
- **Dónde obtenerla:** Configuración de la OAuth App de GitHub, junto con el client ID.
- **Formato de ejemplo:** `reemplazar-con-github-client-secret`
- **Secreta:** Sí. Mantenla en el servidor.

### `NEXT_PUBLIC_GOOGLE_ENABLED`

- **Propósito:** Controla si aparece el botón de inicio con Google.
- **Obligatoria:** No; usa `true` cuando Google esté configurado y `false` cuando esté deshabilitado.
- **Dónde obtenerla:** Asígnala en `.env`.
- **Formato de ejemplo:** `false`
- **Secreta:** No. Esta opción `NEXT_PUBLIC_*` se incrusta al compilar. Usa `true` solo si configuraste las credenciales de Google correspondientes.

### `NEXT_PUBLIC_GITHUB_ENABLED`

- **Propósito:** Controla si aparece el botón de inicio con GitHub.
- **Obligatoria:** No; usa `true` cuando GitHub esté configurado y `false` cuando esté deshabilitado.
- **Dónde obtenerla:** Asígnala en `.env`.
- **Formato de ejemplo:** `false`
- **Secreta:** No. Esta opción `NEXT_PUBLIC_*` se incrusta al compilar. Usa `true` solo si configuraste las credenciales de GitHub correspondientes.

## Almacenamiento de archivos

Consulta la [guía para principiantes](05-file-storage.md) para crear un bucket y comprobar su URL pública.

### `STORAGE_DRIVER`

- **Propósito:** Elige dónde se guardan los avatares.
- **Requerida:** No. El valor predeterminado es `local`.
- **Valores:** `local` o `s3`.
- **Producción:** Local necesita disco persistente y escribible; S3 necesita todas las variables `S3_*` siguientes.
- **Secreto:** No.

### `S3_ENDPOINT`

- **Propósito:** Dirección de la API S3 para proveedores compatibles. Déjala vacía para Amazon S3.
- **Requerida:** No.
- **Ejemplo:** `https://<id-de-cuenta>.r2.cloudflarestorage.com` para Cloudflare R2.
- **Secreto:** No.

### `S3_REGION`

- **Propósito:** Región que se envía a la API S3.
- **Requerida:** Cuando `STORAGE_DRIVER=s3`.
- **Ejemplos:** `auto` para Cloudflare R2; la región asignada por Amazon S3 u otro proveedor.
- **Secreto:** No.

### `S3_BUCKET`

- **Propósito:** Nombre del bucket donde se guardan los avatares.
- **Requerida:** Cuando `STORAGE_DRIVER=s3`.
- **Secreto:** No.

### `S3_ACCESS_KEY_ID` y `S3_SECRET_ACCESS_KEY`

- **Propósito:** Credenciales del servidor con permiso para leer, escribir y borrar objetos del bucket de avatares.
- **Requeridas:** Cuando `STORAGE_DRIVER=s3`.
- **Secreto:** `S3_ACCESS_KEY_ID` es sensible y `S3_SECRET_ACCESS_KEY` es secreto. Mantén ambos solo en el servidor.

### `S3_PUBLIC_URL`

- **Propósito:** URL pública base del bucket o de un dominio propio. RapidAuth agrega la clave del objeto al final.
- **Requerida:** Cuando `STORAGE_DRIVER=s3`.
- **Ejemplo:** `https://avatars.example.com` o la URL pública del bucket del proveedor.
- **Secreto:** No. Cualquier persona con la URL puede leer los objetos.

### `S3_FORCE_PATH_STYLE`

- **Propósito:** Indica si el nombre del bucket va en la ruta (`true`) o en el hostname (`false`).
- **Requerida:** No. El valor predeterminado es `false`.
- **Ejemplos:** Usa `true` con Cloudflare R2 y muchos servicios S3 propios; usa `false` con Amazon S3.
- **Valores:** `true` o `false`.
- **Secreto:** No.

## Seed

Estas variables solo las lee `bun run db:seed`; no hacen falta en la app después de crear el admin.

### `SEED_ADMIN_EMAIL`

- **Propósito:** Correo de la cuenta admin inicial. Después del primer inicio de sesión con contraseña, activa el 2FA en **Profile → Security** antes de usar el panel de administración.
- **Obligatoria:** No. El seed usa `admin@admin.com` si no la configuras.
- **Dónde obtenerla:** Elige una dirección de correo que controles.
- **Formato de ejemplo:** `admin@example.com`
- **Secreta:** No. Solo la usa el script de seed.

### `SEED_ADMIN_PASSWORD`

- **Propósito:** Contraseña de la cuenta admin inicial.
- **Obligatoria:** No. Si no la configuras, el seed genera una contraseña y la muestra una sola vez.
- **Dónde obtenerla:** Elige una contraseña única de al menos 8 caracteres.
- **Formato de ejemplo:** `reemplazar-con-contrasena-unica`
- **Secreta:** Sí. Solo la usa el seed. No dejes activo un valor de ejemplo en un `.env` real.

## Temas

### `GITHUB_TOKEN`

- **Propósito:** Permite que el selector opcional de temas descargue temas premium de GitHub.
- **Obligatoria:** No se necesita para la app ni para los temas gratis o predeterminados.
- **Dónde obtenerla:** Crea un token personal de acceso de GitHub con acceso al repositorio del tema solicitado. El selector solicita el token y lo guarda en `.env.local`.
- **Formato de ejemplo:** `github_pat_reemplazar_con_tu_token`
- **Secreta:** Sí. El selector la lee de `.env.local`; la app en ejecución no la necesita.

## Comprobación y resumen al arrancar

Cuando el servidor arranca (`bun dev` o `bun run start`), RapidAuth lee estas variables una vez e imprime un resumen corto de lo que está activo. Solo muestra estados, nunca claves, URLs ni DSN:

```text
Environment:
  Database:  Docker PostgreSQL
  Emails:    Resend
  Files:     local disk
  Turnstile: on
  Google:    off
  GitHub:    off
  Sentry:    off
```

Algunas funciones se activan con una pareja de variables. El servidor comprueba estas parejas:

- Google: `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`.
- GitHub: `GITHUB_CLIENT_ID` y `GITHUB_CLIENT_SECRET`.
- Turnstile: `NEXT_PUBLIC_TURNSTILE_SITE_KEY` y `TURNSTILE_SECRET_KEY`.
- Almacenamiento S3: con `STORAGE_DRIVER=s3`, todas las variables `S3_*` que requiere (consulta [Almacenamiento de archivos](#almacenamiento-de-archivos)).

Si no defines ninguna de las dos variables de una pareja de Google, GitHub o Turnstile, la función queda desactivada y no hay error. Si defines solo una, el servidor imprime un único error que lista todo lo que falta y se detiene:

```text
Incomplete environment configuration:
- Google: missing GOOGLE_CLIENT_SECRET.
- GitHub: missing GITHUB_CLIENT_ID.
```

Un `STORAGE_DRIVER` inválido o una configuración S3 incompleta se reportan en ese mismo error.

## Valores públicos y momento de compilación

Todos los valores `NEXT_PUBLIC_*` son públicos y se compilan dentro del bundle del cliente. Configura los valores deseados antes de compilar; cambiar uno requiere ejecutar de nuevo `next build` y desplegar. Los builds de producción requieren claves reales de sitio y secret de Turnstile.

---

← [Setup manual](00-manual-setup.md) · [Índice en español](README.md) · [Siguiente: Cloudflare Turnstile →](02-turnstile.md)
