# Cloudflare Turnstile

Cloudflare Turnstile es opcional en RapidAuth. Se activa solo cuando están definidas `TURNSTILE_SITE_KEY` y `TURNSTILE_SECRET_KEY`; con ninguna de las dos queda apagado y nada falla. Recomendamos activarlo siempre en producción, poniendo ambas variables en el servidor donde despliegas. En desarrollo puedes usar las claves de prueba de abajo. El build de producción nunca necesita las claves.

## Crear un widget

1. Crea una cuenta gratis en [dash.cloudflare.com](https://dash.cloudflare.com/). No necesitas mover tu dominio a Cloudflare.
2. Busca **Turnstile** en el menú del panel, o presiona **Cmd + K** en Mac / **Ctrl + K** en Windows y busca Turnstile.
3. Selecciona **Add widget** y escribe un nombre, por ejemplo `RapidAuth`.
4. En **Hostnames**, agrega `localhost` y los hostnames desde donde se servirá la app, sin `https://` (por ejemplo, `example.com` o `app.example.com`). Cloudflare no acepta comodines `*`. Al agregar un hostname también se autorizan sus subdominios: `example.com` cubre `app.example.com` y `staging.example.com`; `app.example.com` no cubre `example.com` ni otros subdominios hermanos. Agrega cada hostname no relacionado o crea un widget separado para cada entorno. Consulta la [guía de administración de hostnames de Cloudflare](https://developers.cloudflare.com/turnstile/additional-configuration/hostname-management/).
5. Configura **Widget Mode** en **Managed** y **Pre-clearance** en **No**.
6. Crea el widget y copia la **Site Key** y la **Secret Key**.

Configura las claves en tu entorno:

```env
TURNSTILE_SITE_KEY="tu-site-key"
TURNSTILE_SECRET_KEY="tu-secret-key"
```

La site key es pública: el servidor la lee y se la pasa a la página. La secret key debe permanecer solo en el servidor. Ambas son variables normales de ejecución, que se leen al arrancar el servidor; para cambiarlas, reinicia el servidor. No hace falta reconstruir.

## Despliegue en producción

Define `TURNSTILE_SITE_KEY` y `TURNSTILE_SECRET_KEY` en el servidor donde despliegas, como variables de entorno de ejecución normales. Vercel, Netlify, Railway, Render, Coolify y Docker en un VPS son solo ejemplos; lo mismo aplica a cualquier otro host. El build, incluidos staging, vistas previas y CI, no las necesita.

Con Docker, pasa ambas variables solo al iniciar el contenedor (por ejemplo con `--env-file`). Nada de Turnstile entra en `docker build`. Sigue la [guía de Docker](03-docker.md#produccion-con-docker) para ver los comandos.

Por ejemplo, en Vercel agrega ambas variables en **Project Settings → Environment Variables** para cada entorno que deba usar Turnstile, y vuelve a desplegar o reinicia para que surtan efecto. En CI solo las necesitas si una prueba inicia la app con Turnstile activo.

El asistente `bun run init:setup` también pide las claves de Turnstile y puede guardar claves reales o de prueba para uso local en `.env`.

## Claves de prueba de Cloudflare

Las claves de prueba son solo para desarrollo local. No las uses en producción: el servidor solo registra un aviso si lo haces, así que no te protegerían.

| Site key | Secret key | Resultado |
| --- | --- | --- |
| `1x00000000000000000000AA` | `1x0000000000000000000000000000000AA` | Siempre aprueba |
| `2x00000000000000000000AB` | `2x0000000000000000000000000000000AA` | Siempre rechaza |
| `1x00000000000000000000AA` | `3x0000000000000000000000000000000AA` | Siempre rechaza con `timeout-or-duplicate` |

Otras site keys de prueba de Cloudflare: `1x00000000000000000000BB`, `2x00000000000000000000BB` y `3x00000000000000000000FF`. Cloudflare publica la [referencia completa de claves de prueba](https://developers.cloudflare.com/turnstile/troubleshooting/testing/).

## Comprobar que funciona

Inicia la app local, abre [`/auth/forgot-password`](http://localhost:3000/auth/forgot-password) y confirma que el widget de Turnstile muestre una palomita después de verificar.

## Solución de problemas

### “Invalid domain”

Asegúrate de que el hostname aparezca exactamente como lo usa el navegador. Escribe solo el hostname, sin `https://`, rutas ni diagonal final. Agrega `localhost` para el desarrollo local.

### “Captcha verification failed”

Confirma que la Site Key y la Secret Key pertenezcan al mismo widget y que el hostname esté permitido. Las claves de prueba solo funcionan con las combinaciones documentadas. Revisa también que la server action reciba el token del widget.

### La app no arranca

La app se detiene si solo configuraste una de las dos claves de Turnstile. Define ambas (o ninguna) en el entorno del servidor y reinicia. En producción, define ambas claves reales; las claves de prueba solo generan un aviso en el log.

### Turnstile está apagado y quiero activarlo

Revisa el resumen de arranque: muestra `Turnstile: off` salvo que `TURNSTILE_SITE_KEY` y `TURNSTILE_SECRET_KEY` estén definidas en el entorno del servidor en ejecución (no solo durante el build). Define ambas y reinicia.

---

← [Variables de entorno](01-environment-variables.md) · [Índice en español](README.md) · [Siguiente: Docker →](03-docker.md) · [Documentación del proyecto →](../README.md)
