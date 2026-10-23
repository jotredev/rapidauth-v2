# Limpieza programada e IP real del cliente

RapidAuth incluye una ruta opcional de mantenimiento diario. Borra, en lotes limitados a 500 registros por tipo:

- filas de límites con más de 24 horas;
- registros caducados de verificación, restablecimiento de contraseña, invitación y estado OAuth; y
- cuentas que siguen sin verificar más de 7 días después del registro, excepto administradores y cuentas pendientes.

Las cuentas pendientes creadas por un administrador nunca se borran automáticamente. Si `CRON_SECRET` falta o tiene menos de 32 caracteres, la ruta responde HTTP 404 y el resto de la aplicación funciona igual.

Puedes configurar el secreto de forma guiada con `bun run setup:cleanup`.

## Camino A: Vercel

1. En el panel de Vercel, abre el proyecto y entra a **Settings → Environment Variables**.
2. Agrega `CRON_SECRET` como variable secreta de producción con al menos 32 caracteres aleatorios y vuelve a desplegar.

No necesitas configurar nada más. El `vercel.json` de la raíz ya llama `/api/cron/cleanup` todos los días a las 03:00 UTC. Vercel envía automáticamente `Authorization: Bearer <CRON_SECRET>`.

En el plan Hobby de Vercel, los cron solo pueden ejecutarse una vez al día y pueden hacerlo en cualquier momento dentro de la hora elegida. Los planes de pago normalmente ejecutan dentro del minuto configurado.

## Camino B: cualquier otro despliegue

1. Agrega `CRON_SECRET`, con al menos 32 caracteres aleatorios, al entorno del servidor y reinicia la aplicación.
2. En el repositorio de GitHub, abre **Settings → Secrets and variables → Actions** y agrega los secretos de repositorio `CRON_SECRET` y `APP_URL`. `APP_URL` es el origen público, por ejemplo `https://auth.example.com`.

El workflow `.github/workflows/scheduled-cleanup.yml` incluido llama la ruta todos los días a las 03:00 UTC. Si falta cualquiera de los dos secretos de GitHub, muestra un aviso de configuración y termina correctamente sin hacer la petición.

## Camino C: Docker

1. Agrega `CRON_SECRET`, con al menos 32 caracteres aleatorios, a tu archivo `.env` en la raíz (o expórtalo en tu terminal):

   ```env
   CRON_SECRET="tu-secreto-aleatorio-seguro-de-al-menos-32-caracteres"
   ```

2. Inicia los contenedores con `docker compose up` (o `bun run docker:dev` para desarrollo).

Cuando existe `CRON_SECRET`, Docker Compose enciende automáticamente el contenedor mínimo de `cron` (`docker/cron.yaml`). Este llama a `/api/cron/cleanup` una vez al día a las 03:00 UTC con la cabecera `Authorization: Bearer <CRON_SECRET>`. Sin `CRON_SECRET`, el contenedor permanece apagado (`scale: 0`).

Puedes personalizar el horario con la variable `CRON_SCHEDULE` (predeterminado: `0 3 * * *`).

## Probarla manualmente

En Docker, puedes ejecutar la limpieza a mano dentro del contenedor de cron en ejecución:

```bash
docker compose exec cron cleanup
```

En GitHub, abre **Actions → Scheduled cleanup → Run workflow**. Una ejecución correcta muestra el JSON devuelto por la ruta.

También puedes llamarla desde una terminal de confianza:

```bash
curl --fail --silent --show-error \
  --header "Authorization: Bearer ${CRON_SECRET}" \
  "http://localhost:3000/api/cron/cleanup"
```

La respuesta solo contiene contadores:

```json
{"rateLimits":0,"verifications":0,"unverifiedUsers":0,"operationalLogs":0}
```

Puedes llamarla otra vez sin riesgo; los registros ya borrados no se vuelven a contar.

## Cambiar la hora

La expresión `0 3 * * *` significa minuto `0`, hora `3`, cualquier día del mes, cualquier mes y cualquier día de la semana. Los horarios cron usan UTC. Cambia la expresión tanto en `vercel.json` como en `.github/workflows/scheduled-cleanup.yml` para mantener alineados los dos caminos.

## Configurar `TRUSTED_PROXY`

Ejecuta `bun run setup:proxy` o define uno de estos valores en el entorno del servidor:

- `none` (predeterminado): no confía en ninguna cabecera IP. Los límites por IP quedan desactivados; los límites por correo o usuario siguen funcionando.
- `vercel`: usa la cabecera protegida `X-Vercel-Forwarded-For` de Vercel.
- `cloudflare`: usa `CF-Connecting-IP`. Configura el origen para aceptar tráfico únicamente desde Cloudflare; de lo contrario, un cliente directo puede falsificar esta cabecera.
- `proxy`: usa `X-Real-IP` de nginx u otro proxy inverso que controles. El origen no debe ser accesible directamente por clientes que puedan enviar esa cabecera.

RapidAuth solo acepta la cabecera configurada cuando su valor completo es una dirección IPv4 o IPv6 válida. Un valor desconocido de `TRUSTED_PROXY` se comporta como `none`. En producción, `none` genera un solo aviso al arrancar para hacer visible una configuración faltante.
