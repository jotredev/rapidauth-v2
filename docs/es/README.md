# Documentación en español

Elige una ruta para empezar en [Quick Start](../README.md#quick-start): asistente, setup manual o Docker. Son alternativas; no tienes que seguirlas en orden ni completar las tres. Las guías de variables de entorno y Turnstile sirven como referencia para cualquiera de las rutas.

1. [Setup manual](00-manual-setup.md) — instala RapidAuth sin el asistente, configura los servicios, prepara la base de datos y la cuenta admin, e inicia la app.
2. [Variables de entorno](01-environment-variables.md) — referencia de cada variable: propósito, origen, entornos donde se necesita y notas de uso.
3. [Cloudflare Turnstile](02-turnstile.md) — crea un widget, usa claves de prueba en local y actívalo en producción con variables de ejecución.
4. [Docker](03-docker.md) — instala Docker, inicia la app y la base local, y prepara una imagen de producción.
5. [Almacenamiento de archivos](05-file-storage.md) — elige almacenamiento local o compatible con S3 para avatares y migra entre proveedores.
6. [Monitoreo de errores](06-error-monitoring.md) — conecta Sentry opcionalmente, sube source maps, comprueba los reportes y conoce los filtros de privacidad.
7. [Limpieza programada e IP real del cliente](07-scheduled-cleanup.md) — activa la limpieza diaria con Vercel o GitHub Actions y configura cabeceras de proxy seguras.
8. [Actualización de dependencias](04-dependency-updates.md) — revisa Dependabot, actualiza dependencias por etapas probadas y respeta los límites de herramientas.
