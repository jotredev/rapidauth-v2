# Setup manual

Esta guía instala y configura RapidAuth sin ejecutar `bun run init:setup`. Sigue los pasos en orden.

## 1. Prepara los requisitos

- Instala [Bun](https://bun.sh/).
- Si ejecutas Next.js directamente con Node.js, usa la versión 20.9 o posterior.
- Ten acceso a una base de datos PostgreSQL, como Neon u otro proveedor de PostgreSQL.
- Crea una cuenta en [Resend](https://resend.com/) para enviar correo.
- Para compilar en producción, crea una cuenta gratis en Cloudflare y obtén claves reales de Turnstile. Consulta [Cloudflare Turnstile](02-turnstile.md).
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

Copia el archivo de ejemplo y luego edita `.env`:

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

Configura `RESEND_API_KEY` y `FROM_EMAIL`. En producción, verifica el dominio del remitente en Resend y usa una dirección de ese dominio. Puedes comprobar la API con un remitente y destinatario verificados:

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

El inicio de sesión con Google y GitHub solo abre cuentas existentes. Las personas nuevas deben comenzar en la página de registro y aceptar los Términos de servicio y la Política de privacidad antes de continuar con el proveedor.

## 6. Configura Turnstile

Para `next dev`, puedes dejar Turnstile vacío o configurar claves de prueba de Cloudflare. Cada `next build` requiere ambas claves reales durante la compilación, incluso para staging, vistas previas o CI. Sigue la [guía de Turnstile](02-turnstile.md) para crear un widget, configurar `NEXT_PUBLIC_TURNSTILE_SITE_KEY` y `TURNSTILE_SECRET_KEY`, y autorizar los hostnames desde los que se servirá la app.

## 7. Sincroniza el esquema y crea el admin

Sentry sigue siendo opcional. Puedes ejecutar `bun run setup:sentry` en cualquier momento para configurarlo con una guía, o seguir la [guía manual de Sentry](06-error-monitoring.md). Omitirlo no afecta los builds ni las funciones de la app.

Con `DATABASE_URL` configurada en `.env`, ejecuta:

```sh
bun run db:push
bun run db:seed
```

El esquema de usuario guarda la fecha y la versión de los términos aceptados, además del estado y la caducidad de las contraseñas temporales. Ejecuta `bunx prisma db push` al desplegar esta versión en una instalación existente, además de hacerlo en una instalación nueva. Después de actualizar el esquema, toda persona sin una aceptación guardada —incluidas las cuentas existentes— verá la pantalla de aceptación de términos al iniciar sesión. Quien tenga guardada una versión anterior verá de nuevo la misma pantalla. Cambia `termsVersion` en `config/site.ts` cuando los cambios legales requieran una nueva aceptación; ese cambio hace obligatoria la versión actual para todas las cuentas.

Toda persona creada desde el panel de administración recibe un email de invitación. La invitación es válida durante 7 días, permite definir una contraseña y aceptar los términos actuales, y se puede reenviar desde la tabla de usuarios mientras siga pendiente. Una contraseña temporal generada por un admin debe cambiarse en el siguiente inicio de sesión y caduca después de 72 horas. Un admin no puede generar una contraseña temporal para otro admin; en ese caso debe enviar el enlace de restablecimiento por email.

El seed crea la primera cuenta de admin. `SEED_ADMIN_EMAIL` tiene como valor predeterminado `admin@admin.com`. Puedes configurar `SEED_ADMIN_PASSWORD` con una contraseña de al menos 8 caracteres antes de ejecutar el seed. Si no la defines, el seed genera una y la muestra una sola vez; guárdala porque el seed no volverá a mostrarla. Si el admin ya existe, el seed no crea otra cuenta. Después de iniciar sesión, este admin con contraseña debe activar la autenticación de dos factores en **Profile → Security** antes de usar el panel de administración. Los admins solo OAuth quedan exentos porque su proveedor aporta el segundo factor.

## 8. Elige un tema de auth (opcional)

```sh
bun run theme:select
```

El selector de temas es opcional. Algunos temas premium requieren un token personal de acceso de GitHub. El selector lo solicita y lo guarda en `.env.local`; no hace falta para el tema gratis o predeterminado.

Antes de reemplazar archivos, el selector muestra todas las rutas afectadas. Comprueba los cambios de Git y compara esas rutas con el tema Classic. Si encuentra cambios, escribe el nombre del tema para confirmar. Siempre guarda una copia en `.theme-backups/<timestamp>/` antes de reemplazar archivos; Git ignora esa carpeta. Para restaurar, copia cada ruta guardada desde esa carpeta de fecha a su misma ruta en la raíz del proyecto.

Los temas nunca incluyen ni reemplazan el dashboard. Un `theme.json` v2 debe declarar un `coreVersion` compatible, por ejemplo `">=0.2.0"`. Solo se admite la forma `>=x.y.z`, y la versión debe ser al menos `0.2.0` (la versión que llevó Turnstile y el nuevo flujo de verificación de email a las páginas de auth) y no mayor que la versión instalada. RapidAuth rechaza los temas sin versión o con una versión incompatible antes de cambiar archivos. Aurora y Nexus necesitan actualizarse para RapidAuth 0.2.0.

Quienes mantienen la plantilla deben ejecutar `bun run theme:sync-classic` después de cambiar auth, landing, layout, estilos o UI compartida. Usa `bun run theme:sync-classic --check` para ver diferencias sin escribir; CI también lo comprueba.

El hook local de pre-commit usa `RAPIDAUTH_SKIP_TURNSTILE_BUILD_CHECK=1` solo para comprobar que compila. Este bypass nunca se usa en producción ni en builds del hosting; esos builds deben validar claves reales de Turnstile.

## Cambiar de base de datos (Neon ↔ Docker)

Ejecuta `bun run db:switch` y elige una base PostgreSQL externa o la base local en Docker. El asistente guarda la URL anterior como comentario en `.env` y luego ejecuta `prisma db push` y el seed contra la base nueva. Los datos no se copian entre bases.

También puedes cambiarla manualmente editando `DATABASE_URL` y `DOCKER_DATABASE` en `.env`. Usa `DOCKER_DATABASE=true` con la base local en Docker; para una base externa, quita la variable o asígnale `false`. Luego ejecuta:

```sh
bun run db:push
bun run db:seed
```

Usa `sslmode=disable` solo con la base local de Docker. Nunca lo uses en producción.

## CI y versión de Bun

Usa Bun **1.4.2**, la versión fijada en `package.json`. GitHub Actions tiene jobs de calidad, build de producción, guarda de Turnstile, auditoría y Docker. Ejecuta localmente `bun run lint`, `bun run typecheck`, `bun run theme:sync-classic --check` y `bun audit --audit-level=high`. La guía de Docker explica cómo repetir las pruebas del stack. Para comprobar que se rechazan claves Turnstile, usa valores ficticios para la base y Better Auth; el build no se conecta a la base:

```sh
BUILD_ENV='DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build?sslmode=disable BETTER_AUTH_URL=http://localhost:3000 BETTER_AUTH_SECRET=0000000000000000000000000000000000000000000000000000000000000000 NEXT_TELEMETRY_DISABLED=1'
env NEXT_PUBLIC_TURNSTILE_SITE_KEY= TURNSTILE_SECRET_KEY= $BUILD_ENV bun run build # debe fallar si faltan las claves Turnstile
env $BUILD_ENV NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA TURNSTILE_SECRET_KEY=1x0000000000000000000000AA bun run build # debe fallar con claves de prueba
```

Los builds de producción siempre necesitan claves reales de Turnstile. El bypass de pre-commit nunca se usa en CI ni producción.

## Eliminación de cuenta

Las personas con sesión iniciada pueden borrar permanentemente su cuenta desde **Profile → Security**. Se eliminan los datos del perfil, las sesiones, las cuentas conectadas, la configuración de 2FA, el historial de actividad y el avatar almacenado; después se envía un email de aviso. Las cuentas con contraseña deben confirmarla. Las cuentas solo OAuth necesitan una sesión creada en los últimos 10 minutos. El último administrador activo debe añadir a otra persona como admin activo antes de eliminar su cuenta.

## Avisos de seguridad

RapidAuth envía un aviso por email al dueño de la cuenta cuando cambia su contraseña desde el perfil, la restablece mediante el enlace del email o un admin crea una contraseña temporal. También envía un aviso después de confirmar la activación del 2FA o al desactivarlo. Estos avisos incluyen la hora UTC y el email de soporte, pero nunca contraseñas, secretos TOTP ni códigos de respaldo.

## 9. Inicia la app y comprueba el acceso de admin

```sh
bun dev
```

Abre [http://localhost:3000](http://localhost:3000), entra a la página de inicio de sesión e ingresa con `SEED_ADMIN_EMAIL` y la contraseña impresa o configurada durante el seed. Abre **Profile → Security**, activa la autenticación de dos factores y después confirma que cargue el panel de admin.

## Antes de desplegar

- Revisa y personaliza los Términos de servicio (`/terms`) y la Política de privacidad (`/privacy`) antes de publicar. Configura `legalEntityName`, `governingLaw`, `lastUpdated` y `termsVersion` en `config/site.ts`, y configura `SUPPORT_EMAIL` en tu entorno (consulta [Variables de entorno](01-environment-variables.md)); después adapta el texto de `app/(legal)/terms/page.tsx` y `app/(legal)/privacy/page.tsx` a tu servicio. Aumenta `termsVersion` cuando debas pedir que se acepte una versión revisada. Estos documentos son plantillas, no asesoría legal; pide a un abogado que los revise.
- Configura un `BETTER_AUTH_SECRET` único, el `BETTER_AUTH_URL` público correcto y un `DATABASE_URL` de producción.
- Configura `RESEND_API_KEY` y un remitente `FROM_EMAIL` con dominio verificado.
- Proporciona claves reales de Turnstile a cada compilación, incluidas staging, vistas previas y CI. Con Docker, monta `TURNSTILE_SECRET_KEY` con BuildKit durante el build y vuelve a proporcionarla en runtime; pasa la site key pública como argumento de build. Consulta [Cloudflare Turnstile](02-turnstile.md).
- Agrega todos los hostnames desde donde se sirve la app, o un hostname padre que cubra sus subdominios, al widget de Turnstile.
- Si habilitaste OAuth, configura las URLs de callback con el `BETTER_AUTH_URL` publicado.
- Elige el almacenamiento de avatares para producción: configura `STORAGE_DRIVER=s3` con el bucket, las llaves y la URL pública, o usa Local solo si el servidor tiene disco persistente y escribible. Consulta [Almacenamiento de archivos](05-file-storage.md).
- Elige un email de admin y contraseña segura, o guarda la contraseña generada que solo se muestra una vez y cámbiala tras iniciar sesión.
- Mantén `.env`, `.env.local` y todos los secretos fuera del control de versiones y de los argumentos de build de imágenes.

Al cambiar de motor, primero ejecuta `bun run storage:migrate` para ver el plan y después `bun run storage:migrate --apply` para mover los avatares existentes.

---

← [Documentación del proyecto](../README.md) · [Índice en español](README.md) · [Siguiente: Variables de entorno →](01-environment-variables.md)
