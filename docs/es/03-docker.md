# Docker

RapidAuth tiene dos modos con Docker. **Usar la app** con la imagen de producción y un comando, o **programar dentro de Docker** con la carpeta del código montada para recarga automática. Ambos modos inician PostgreSQL. Mailpit se inicia cuando `RESEND_API_KEY` está vacío; con una clave, la app envía por Resend y Mailpit permanece apagado.

## Requisitos

Instala Docker Engine o Docker Desktop con Docker Compose v2 y Buildx. Desde una terminal en la carpeta del proyecto, confirma que Docker esté activo:

```sh
docker version
docker compose version
docker buildx version
```

## Usar la app

El archivo `.env` es opcional. Sin él, Compose usa valores locales predeterminados y usa la imagen publicada `ghcr.io/jotredev/rapidauth-v2:2.3.0`. Si esa imagen no está disponible, Compose la construye desde el `Dockerfile` raíz:

```sh
docker compose up
```

La versión de la imagen se define en `docker/app.yaml`. Para usar una versión nueva, cambia allí la etiqueta por la versión publicada (por ejemplo, `2.4.0`) y ejecuta `docker compose up`. Para construir la app localmente, ejecuta `docker compose up --build`.

Para publicar una versión, crea y sube una etiqueta como `2.4.0`. GitHub Actions construye el `Dockerfile` raíz y publica `2.4.0` y `2` en GitHub Container Registry. Después de la primera publicación, haz pública la imagen `rapidauth-v2` en GitHub Packages para que Compose pueda descargarla sin autenticación.

Abre [http://localhost:3000](http://localhost:3000). En una base nueva, usa la pantalla de primer inicio para crear el primer administrador y luego entra al dashboard. La pantalla de configuración está disponible durante 15 minutos después de iniciar la app.

El primer inicio descarga la imagen de la app (o la construye localmente si no está disponible) y aplica las migraciones versionadas de Prisma antes de arrancar la app. Compose mantiene la app, la base de datos y Mailpit activos en la terminal. Presiona **Ctrl+C** para detenerlos. Inícialos de nuevo con `docker compose up`.

Los valores predeterminados son para uso local:

- `BETTER_AUTH_URL=http://localhost:3000`
- Un `BETTER_AUTH_SECRET` de ejemplo, identificado como tal
- `SUPPORT_EMAIL=support@example.invalid`
- PostgreSQL en el servicio `db`
- Los correos llegan a Mailpit en [http://localhost:8025](http://localhost:8025)

El secreto de ejemplo solo se acepta con una URL de localhost. Si configuras un `BETTER_AUTH_URL` público y dejas el secreto de ejemplo, la app se detiene e indica cómo generar un secreto real con `openssl rand -hex 32`.

No necesitas copiar `.env.example`. Si creas un `.env` en la raíz, sus valores reemplazan los predeterminados de Compose. Los servicios de migración y de la app siempre usan la base `db` de Compose; se ignora `DATABASE_URL` del `.env`. Para desplegar en producción, configura al menos un `BETTER_AUTH_SECRET` único, el `BETTER_AUTH_URL` público y `SUPPORT_EMAIL`. Agrega `RESEND_API_KEY` y un `FROM_EMAIL` verificado para entregar correos reales. Sin una clave de Resend, Mailpit captura los correos y su bandeja se inicia en el puerto 8025; con clave, Mailpit permanece apagado. Agrega `CRON_SECRET` para habilitar la limpieza programada diaria; sin el secreto, el contenedor de cron permanece apagado. Consulta [Limpieza programada](07-scheduled-cleanup.md).

Para activar Sentry, define `NEXT_PUBLIC_SENTRY_DSN` en el `.env` raíz y reinicia el contenedor de la app. El servidor en ejecución entrega el DSN público al navegador; no hace falta reconstruir la imagen. `SENTRY_ORG`, `SENTRY_PROJECT` y `SENTRY_AUTH_TOKEN` solo se necesitan durante el build para subir source maps. El token se monta como secreto de BuildKit y nunca se pasa como argumento de build. Consulta [Monitoreo de errores](06-error-monitoring.md).

Solo la app se publica en el puerto 3000. PostgreSQL y Mailpit se enlazan a `127.0.0.1`; la bandeja web de Mailpit usa el puerto 8025 y su puerto SMTP es 1025. En un VPS se usa el mismo archivo Compose y un `.env` protegido; coloca un proxy TLS delante de la app si necesitas HTTPS.

La base de datos y los avatares subidos sobreviven al reemplazo de contenedores y a `docker compose down`. Para borrar también todos los datos guardados, ejecuta `docker compose down -v`.

## Programar dentro de Docker

Para editar el código montado dentro del contenedor, ejecuta:

```sh
bun run docker:dev
```

Este modo requiere Bun en la computadora. Monta el proyecto dentro del contenedor y ejecuta Next.js en modo desarrollo. El `.env` de la raíz es opcional; si existe, se usan sus valores. La app está en [http://localhost:3000](http://localhost:3000) y Mailpit en [http://localhost:8025](http://localhost:8025).

Detén el stack de desarrollo con **Ctrl+C**. Para quitar los contenedores y conservar los datos, ejecuta:

```sh
docker compose -f compose.dev.yaml down
```

Ambos modos guardan los datos de PostgreSQL en un volumen con nombre. El modo de producción también guarda los avatares locales en un volumen montado en `/app/storage`. No uses `down -v` salvo que quieras borrar la base y los avatares guardados.

## Solución de problemas

- **El puerto 3000 ya está ocupado:** detén la otra app que lo usa antes de iniciar RapidAuth.
- **La app no inicia:** revisa sus registros con `docker compose logs app migrate db mailpit`. La app espera a que la base y Mailpit estén saludables y a que las migraciones terminen correctamente.
- **Faltan correos:** sin `RESEND_API_KEY`, abre Mailpit en [http://localhost:8025](http://localhost:8025). Con una clave, revisa la configuración de Resend y el remitente verificado.
- **Desaparecieron los datos:** `docker compose down -v` elimina los volúmenes con nombre. Inicia de nuevo y crea otro administrador.

---

← [Turnstile](02-turnstile.md) · [Índice de documentación](README.md) · [Actualización de dependencias →](04-dependency-updates.md) · [Documentación del proyecto](../README.md)
