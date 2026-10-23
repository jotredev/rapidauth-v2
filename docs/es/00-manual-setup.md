# Setup manual

Esta guía instala y configura RapidAuth sin ejecutar `bun run init:setup`. Sigue los pasos en orden.

## Inicio rápido para desarrollo

Para desarrollar en local solo necesitas Docker encendido y luego:

```sh
bun install
bun dev
```

`bun dev` prepara todo lo demás, sin que tengas que configurar ni leer nada antes:

- **`.env`:** si no existe, `bun dev` lo crea desde `.env.example` con valores locales: un `BETTER_AUTH_SECRET` aleatorio, `BETTER_AUTH_URL=http://localhost:3000`, la `DATABASE_URL` del PostgreSQL local en Docker y un `SUPPORT_EMAIL` local. Un `.env` existente nunca se sobrescribe.
- **Base de datos:** inicia el PostgreSQL local en Docker solo si `DATABASE_URL` apunta a él: host `localhost`, `127.0.0.1` o `::1`, usuario, contraseña y base `rapidauth`, y puerto `DB_PORT` (por defecto `5432`). Con cualquier otra URL, como la de Neon, no toca Docker ni la base.
- **Tablas:** en cada inicio de la base local ejecuta `prisma migrate deploy`, que crea las tablas si la base está vacía y, si no, aplica solo las migraciones pendientes. Si la base ya tiene tablas pero no historial de migraciones, como una creada con `prisma db push`, se detiene y explica cómo adoptarla (consulta [Migraciones de la base de datos](#migraciones-de-la-base-de-datos)); nunca modifica esa base por sí solo. No crea ninguna cuenta de admin: abre la app y usa la pantalla **Create your admin account** (consulta la [sección 9](#9-inicia-la-app-y-crea-el-admin)), o ejecuta `bun run db:seed`.
- **Mailpit:** inicia la bandeja local en `http://localhost:8025` solo si `RESEND_API_KEY` está vacía.
- **Prioridad:** las variables ya exportadas en tu terminal ganan a `.env`, igual que en Next.js y Prisma. Todas las decisiones anteriores usan ese valor efectivo. Por ejemplo, si exportas una `DATABASE_URL` de Neon, no se inicia Docker aunque `.env` apunte a la base local.
- **Resumen:** al terminar muestra qué servicios están activos y la línea `For production, run bun run init:setup`.

El resto de esta guía sirve para configurar todo a mano, por ejemplo antes de desplegar.

## 1. Prepara los requisitos

- Instala [Bun](https://bun.sh/).
- Si ejecutas Next.js directamente con Node.js, usa la versión 20.9 o posterior.
- Ten acceso a una base de datos PostgreSQL, como Neon u otro proveedor de PostgreSQL.
- Crea una cuenta en [Resend](https://resend.com/) para enviar correo. Es opcional en desarrollo: sin clave, los correos van a Mailpit en `http://localhost:8025` (lo arranca Docker Compose); en producción es obligatoria.
- Opcional pero recomendado en producción: crea una cuenta gratis en Cloudflare y obtén claves reales de Turnstile. Consulta [Cloudflare Turnstile](02-turnstile.md).
- OAuth es opcional. Crea aplicaciones OAuth de Google o GitHub solo si quieres habilitar el inicio de sesión social.
- El monitoreo de errores con Sentry es opcional. La app no hace peticiones a Sentry sin un DSN válido; consulta [Monitoreo de errores](06-error-monitoring.md) si quieres activarlo.

Clona el proyecto y entra en su carpeta:

```sh
git clone https://github.com/yourusername/rapidauth-better-auth.git
cd rapidauth-better-auth
```

## 2. Instala las dependencias

```sh
bun install
```

El script `postinstall` ejecuta automáticamente `prisma generate`. No necesitas ejecutarlo por separado después de una instalación normal con `bun install`.

## 3. Crea y completa `.env`

Para desarrollar en local, `bun dev` crea `.env` por ti (consulta el inicio rápido). Para configurarlo tú, copia el archivo de ejemplo y luego edita `.env`:

```sh
cp .env.example .env
```

Usa la [referencia de variables de entorno](01-environment-variables.md) para completar la base de datos, Better Auth, correo y los demás valores. Genera un `BETTER_AUTH_SECRET` único con cualquiera de estos comandos:

```sh
openssl rand -hex 32
```

```sh
node -p "require('node:crypto').randomBytes(32).toString('hex')"
```

Pega en `.env` el valor hexadecimal de 64 caracteres. Para desarrollo local, configura `BETTER_AUTH_URL` como `http://localhost:3000`. En cada entorno publicado, usa su URL base pública.

## 4. Configura y comprueba el correo

Configura `RESEND_API_KEY` y `FROM_EMAIL`. En desarrollo puedes dejar `RESEND_API_KEY` vacía: los correos van entonces a Mailpit en `http://localhost:8025` en lugar de Resend. En producción, verifica el dominio del remitente en Resend y usa una dirección de ese dominio. Puedes comprobar la API con un remitente y destinatario verificados:

```sh
export RESEND_API_KEY="re_reemplazar_con_tu_api_key"

curl https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"from":"RapidAuth <noreply@example.com>","to":["you@example.com"],"subject":"Prueba de correo RapidAuth","html":"<p>El envío de correo funciona.</p>"}'
```

Sustituye el remitente y destinatario de ejemplo por direcciones que controles. Una respuesta exitosa incluye un ID de correo; comprueba también que llegue el mensaje.

## 5. Configura OAuth opcional

Para cada proveedor que quieras habilitar, configura su client ID y secret en `.env` y asigna `true` a su variable `NEXT_PUBLIC_*_ENABLED`. Usa `false` si el proveedor está deshabilitado. Agrega estas URLs de callback a la aplicación OAuth:

- Google: `<BETTER_AUTH_URL>/api/auth/callback/google`
- GitHub: `<BETTER_AUTH_URL>/api/auth/callback/github`

Por ejemplo, en desarrollo local el callback de Google es `http://localhost:3000/api/auth/callback/google`.

Cada proveedor, y su botón, se activa solo cuando están definidos su client ID y su client secret. El servidor los lee al arrancar, así que para cambiarlos basta con reiniciarlo; no hace falta reconstruir.

El inicio de sesión con Google y GitHub solo abre cuentas existentes. Las personas nuevas deben comenzar en la página de registro y aceptar los Términos de servicio y la Política de privacidad antes de continuar con el proveedor.

## 6. Configura Turnstile

Turnstile es opcional. Se activa solo cuando están definidas `NEXT_PUBLIC_TURNSTILE_SITE_KEY` y `TURNSTILE_SECRET_KEY`; con ninguna de las dos queda apagado y nada falla. Recomendamos activarlo siempre en producción, poniendo ambas variables en el servidor donde despliegas. Para `next dev` puedes usar claves de prueba de Cloudflare. El build de producción no necesita las claves: el servidor las lee al arrancar, así que para cambiarlas solo hace falta reiniciar. Sigue la [guía de Turnstile](02-turnstile.md) para crear un widget y autorizar los hostnames desde los que se servirá la app.

## 7. Aplica las migraciones y elige cómo crear el admin

Sentry sigue siendo opcional. Puedes ejecutar `bun run setup:sentry` en cualquier momento para configurarlo con una guía, o seguir la [guía manual de Sentry](06-error-monitoring.md). Omitirlo no afecta los builds ni las funciones de la app.

Con `DATABASE_URL` configurada en `.env`, ejecuta:

```sh
bun run db:deploy
```

Si `db:deploy` se detiene con el error `P3005`, la base se creó con `prisma db push`; sigue [Migraciones de la base de datos](#migraciones-de-la-base-de-datos).

El esquema de usuario guarda la fecha y la versión de los términos aceptados, además del estado y la caducidad de las contraseñas temporales. Ejecuta `bun run db:deploy` al desplegar esta versión en una instalación existente, además de hacerlo en una instalación nueva. Después de actualizar el esquema, toda persona sin una aceptación guardada —incluidas las cuentas existentes— verá la pantalla de aceptación de términos al iniciar sesión. Quien tenga guardada una versión anterior verá de nuevo la misma pantalla. Cambia `termsVersion` en `config/site.ts` cuando los cambios legales requieran una nueva aceptación; ese cambio hace obligatoria la versión actual para todas las cuentas.

Toda persona creada desde el panel de administración recibe un email de invitación. La invitación es válida durante 7 días, permite definir una contraseña y aceptar los términos actuales, y se puede reenviar desde la tabla de usuarios mientras siga pendiente. Una contraseña temporal generada por un admin debe cambiarse en el siguiente inicio de sesión y caduca después de 72 horas. Un admin no puede generar una contraseña temporal para otro admin; en ese caso debe enviar el enlace de restablecimiento por email.

Hay dos formas de crear la primera cuenta de admin. La predeterminada es la pantalla de configuración: mientras no exista un admin, el inicio, el inicio de sesión y el registro te llevan a **Create your admin account** (`/auth/setup`), donde escribes nombre, email y contraseña y aceptas los términos. La pantalla se cierra 15 minutos después de que arranca la app si nadie la usó; entonces lo explica en pantalla y debes reiniciar la app para abrirla de nuevo. La alternativa es el seed, que no necesita pantalla: ejecuta `bun run db:seed`. Con el seed, `SEED_ADMIN_EMAIL` tiene como valor predeterminado `admin@admin.com`. Puedes configurar `SEED_ADMIN_PASSWORD` con una contraseña de al menos 8 caracteres antes de ejecutar el seed. Si no la defines, el seed genera una y la muestra una sola vez; guárdala porque el seed no volverá a mostrarla. Si ya existe una cuenta con ese email, el seed no crea otra. Después de iniciar sesión, este admin con contraseña debe activar la autenticación de dos factores en **Profile → Security** antes de usar el panel de administración. Los admins solo OAuth quedan exentos porque su proveedor aporta el segundo factor.

## 8. Elige un tema de auth (opcional)

```sh
bun run theme:select
```

El selector de temas es opcional. Algunos temas premium requieren un token personal de acceso de GitHub. El selector lo solicita y lo guarda en `.env.local`; no hace falta para el tema gratis o predeterminado.

Antes de reemplazar archivos, el selector muestra todas las rutas afectadas. Comprueba los cambios de Git y compara esas rutas con el tema Classic. Si encuentra cambios, escribe el nombre del tema para confirmar. Siempre guarda una copia en `.theme-backups/<timestamp>/` antes de reemplazar archivos; Git ignora esa carpeta. Para restaurar, copia cada ruta guardada desde esa carpeta de fecha a su misma ruta en la raíz del proyecto.

Los temas nunca incluyen ni reemplazan el dashboard. Un `theme.json` v2 debe declarar un `coreVersion` compatible, por ejemplo `">=0.2.0"`. Solo se admite la forma `>=x.y.z`, y la versión debe ser al menos `0.2.0` (la versión que llevó Turnstile y el nuevo flujo de verificación de email a las páginas de auth) y no mayor que la versión instalada. RapidAuth rechaza los temas sin versión o con una versión incompatible antes de cambiar archivos. Aurora y Nexus necesitan actualizarse para RapidAuth 0.2.0.

Quienes mantienen la plantilla deben ejecutar `bun run theme:sync-classic` después de cambiar auth, landing, layout, estilos o UI compartida. Usa `bun run theme:sync-classic --check` para ver diferencias sin escribir; CI también lo comprueba.

## Cambiar de base de datos (Neon ↔ Docker)

Ejecuta `bun run db:switch` y elige una base PostgreSQL externa o la base local en Docker. El asistente guarda la URL anterior como comentario en `.env` y luego ejecuta `prisma migrate deploy` y el seed contra la base nueva (el asistente de configuración sigue ejecutando el seed). Si esa base ya tiene tablas creadas con `db push`, se detiene con el mensaje de [Migraciones de la base de datos](#migraciones-de-la-base-de-datos). Los datos no se copian entre bases.

También puedes cambiarla manualmente editando `DATABASE_URL` en `.env`. `bun dev` solo inicia Docker si apunta a la base local de Docker. Luego ejecuta:

```sh
bun run db:deploy
```

Después crea el admin en la pantalla de configuración o ejecuta `bun run db:seed`.

Usa `sslmode=disable` solo con la base local de Docker. Nunca lo uses en producción.

## Migraciones de la base de datos

El esquema se versiona con Prisma Migrate. Cada cambio vive en una carpeta dentro de `prisma/migrations/`, y la primera, `0_init`, crea todas las tablas. `bun dev`, `bun run init:setup` y el contenedor de desarrollo con Docker aplican las migraciones pendientes con `prisma migrate deploy`. Es seguro repetirlo: solo aplica lo que falta. Nunca uses `prisma db push` contra una base con datos reales; puede borrar columnas sin avisar.

### Crear una migración nueva

1. Edita `prisma/schema.prisma`.
2. Con la base local de Docker encendida (`bun dev` la inicia), ejecuta:

   ```sh
   bun run db:migrate -- --name <nombre_corto>
   ```

   Prisma crea `prisma/migrations/<fecha>_<nombre_corto>/migration.sql` y la aplica a la base local. Lee el SQL generado antes de continuar, sobre todo si borra o renombra una columna.
3. Haz commit de la carpeta nueva de `prisma/migrations/` junto con el cambio en `schema.prisma`.

Ejecuta `bun run db:migrate` solo contra la base local de Docker, nunca contra una base de producción.

### Aplicar las migraciones en un servidor o en Neon

Ejecuta esto con el `DATABASE_URL` de esa base **antes** del commit y push que despliega el código nuevo, para que la base esté lista cuando arranque la nueva versión:

```sh
bun run db:deploy
```

Con Docker y sin Bun en tu computadora, consulta [Crear tablas de producción y el primer admin con Docker](03-docker.md#crear-tablas-de-producción-y-el-primer-admin-con-docker).

### Adoptar una base existente creada con `db push`

Si la base ya tiene tablas pero no tiene la tabla `_prisma_migrations`, `prisma migrate deploy` se detiene con el error `P3005` y no cambia nada. `bun dev`, `bun run init:setup` y el contenedor de Docker muestran esta guía cuando ocurre. RapidAuth nunca lo resuelve automáticamente: **tú ejecutas estos comandos, en tu propia base.**

1. Comprueba que la base coincide con el esquema. El comando debe informar que no hay diferencias (código de salida 0):

   ```sh
   bunx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code
   ```

   Si muestra diferencias, no continúes: corrige primero el esquema o la base, o el historial dirá que `0_init` se aplicó cuando no es cierto.
2. Marca la migración inicial como aplicada. Solo escribe una fila en `_prisma_migrations`; no toca tus tablas:

   ```sh
   bunx prisma migrate resolve --applied 0_init
   ```

   Con el contenedor de desarrollo de Docker, usa la misma URL en ambos comandos:

   ```sh
   docker compose run --rm -e DATABASE_URL="<url-de-la-base>" app bunx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code
   docker compose run --rm -e DATABASE_URL="<url-de-la-base>" app bunx prisma migrate resolve --applied 0_init
   ```

   Para la base local de Docker, omite `-e DATABASE_URL=...`; el servicio ya apunta a ella.
3. Ejecuta `bun run db:deploy`. Debe decir `No pending migrations to apply`.

## CI y versión de Bun

Usa Bun **1.4.2**, la versión fijada en `package.json`. GitHub Actions tiene jobs de calidad, build de producción, guarda del build, auditoría y Docker. Ejecuta localmente `bun run lint`, `bun run typecheck`, `bun run theme:sync-classic --check` y `bun audit --audit-level=high`. La guía de Docker explica cómo repetir las pruebas del stack. Para comprobar el build de producción, usa valores ficticios para la base y Better Auth; el build no se conecta a la base:

```sh
BUILD_ENV='DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build?sslmode=disable BETTER_AUTH_URL=http://localhost:3000 BETTER_AUTH_SECRET=0000000000000000000000000000000000000000000000000000000000000000 NEXT_TELEMETRY_DISABLED=1'
env $BUILD_ENV SUPPORT_EMAIL=support@example.invalid bun run build # debe compilar sin ninguna clave de Turnstile
env $BUILD_ENV SUPPORT_EMAIL= bun run build # debe fallar: SUPPORT_EMAIL es obligatorio
```

El build de producción no necesita claves de Turnstile.

## Eliminación de cuenta

Las personas con sesión iniciada pueden borrar permanentemente su cuenta desde **Profile → Security**. Se eliminan los datos del perfil, las sesiones, las cuentas conectadas, la configuración de 2FA, el historial de actividad y el avatar almacenado; después se envía un email de aviso. Las cuentas con contraseña deben confirmarla. Las cuentas solo OAuth necesitan una sesión creada en los últimos 10 minutos. El último administrador activo debe añadir a otra persona como admin activo antes de eliminar su cuenta.

## Avisos de seguridad

RapidAuth envía un aviso por email al dueño de la cuenta cuando cambia su contraseña desde el perfil, la restablece mediante el enlace del email o un admin crea una contraseña temporal. También envía un aviso después de confirmar la activación del 2FA o al desactivarlo. Estos avisos incluyen la hora UTC y el email de soporte, pero nunca contraseñas, secretos TOTP ni códigos de respaldo.

## 9. Inicia la app y crea el admin

```sh
bun dev
```

Si Docker está encendido, `bun dev` también inicia la base local y Mailpit cuando corresponde (consulta el inicio rápido). Abre [http://localhost:3000](http://localhost:3000). Si no ejecutaste el seed, la app muestra **Create your admin account**: crea ahí el admin dentro de los 15 minutos posteriores al arranque (reinicia la app si la ventana se cerró). Después inicia sesión con esa cuenta, o con `SEED_ADMIN_EMAIL` y la contraseña impresa o configurada durante el seed. Abre **Profile → Security**, activa la autenticación de dos factores y después confirma que cargue el panel de admin.

## Antes de desplegar

- Revisa y personaliza los Términos de servicio (`/terms`) y la Política de privacidad (`/privacy`) antes de publicar. Configura `legalEntityName`, `governingLaw`, `lastUpdated` y `termsVersion` en `config/site.ts`, y configura `SUPPORT_EMAIL` en tu entorno (consulta [Variables de entorno](01-environment-variables.md)); después adapta el texto de `app/(legal)/terms/page.tsx` y `app/(legal)/privacy/page.tsx` a tu servicio. Aumenta `termsVersion` cuando debas pedir que se acepte una versión revisada. Estos documentos son plantillas, no asesoría legal; pide a un abogado que los revise.
- Ejecuta `bun run db:deploy` con el `DATABASE_URL` de producción antes del commit y push que despliega, para que la base tenga todas las migraciones que necesita el código nuevo (consulta [Migraciones de la base de datos](#migraciones-de-la-base-de-datos)).
- Configura un `BETTER_AUTH_SECRET` único, el `BETTER_AUTH_URL` público correcto y un `DATABASE_URL` de producción.
- Configura `RESEND_API_KEY` y un remitente `FROM_EMAIL` con dominio verificado. Sin la clave, los correos van a Mailpit y no llegan a nadie.
- Recomendado: activa Turnstile en producción poniendo `NEXT_PUBLIC_TURNSTILE_SITE_KEY` y `TURNSTILE_SECRET_KEY` como variables normales de ejecución en el servidor donde despliegas (Vercel, Docker en un VPS o cualquier otro host). El build no las necesita; reinicia para aplicar cambios. Consulta [Cloudflare Turnstile](02-turnstile.md).
- Agrega todos los hostnames desde donde se sirve la app, o un hostname padre que cubra sus subdominios, al widget de Turnstile.
- Si habilitaste OAuth, configura las URLs de callback con el `BETTER_AUTH_URL` publicado. Define el client ID y el secret del proveedor como variables de ejecución; los botones las siguen tras un reinicio.
- Elige el almacenamiento de avatares para producción: configura `STORAGE_DRIVER=s3` con el bucket, las llaves y la URL pública, o usa Local solo si el servidor tiene disco persistente y escribible. Consulta [Almacenamiento de archivos](05-file-storage.md).
- Crea el admin antes de que la app reciba tráfico público: mientras no exista un admin, cualquiera que llegue a `/auth/setup` en los 15 minutos posteriores al arranque del servidor puede crearlo. Prefiere el seed con un `SEED_ADMIN_EMAIL` deliberado y un `SEED_ADMIN_PASSWORD` seguro, o guarda la contraseña generada que solo se muestra una vez y cámbiala tras iniciar sesión.
- Mantén `.env`, `.env.local` y todos los secretos fuera del control de versiones y de los argumentos de build de imágenes.

Al cambiar de motor, primero ejecuta `bun run storage:migrate` para ver el plan y después `bun run storage:migrate --apply` para mover los avatares existentes.

---

← [Documentación del proyecto](../README.md) · [Índice en español](README.md) · [Siguiente: Variables de entorno →](01-environment-variables.md)
