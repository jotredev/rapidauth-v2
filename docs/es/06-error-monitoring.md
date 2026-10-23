# Monitoreo de errores con Sentry

Sentry reúne errores inesperados de la aplicación para que quienes la mantienen puedan ver fallos que los usuarios no pueden diagnosticar. Es opcional en RapidAuth. Sin un `NEXT_PUBLIC_SENTRY_DSN` válido, Sentry no se inicializa, no hace peticiones y no afecta el build.

## 1. Crea el proyecto de Sentry

1. Crea una cuenta en [sentry.io](https://sentry.io/signup/).
2. Crea un proyecto y elige **Next.js** como plataforma.
3. Abre **Project Settings → Client Keys (DSN)**.
4. Copia el DSN. Tiene una forma como `https://public-key@o0.ingest.sentry.io/project-id`. El DSN es público por diseño: indica al SDK dónde enviar los eventos.

## 2. Configura RapidAuth

La opción guiada es la más sencilla:

```sh
bun run setup:sentry
```

El asistente completo `bun run init:setup` ofrece el mismo paso opcional y lo omite por defecto. Si ya hay valores, permite mantenerlos, cambiarlos o desactivar Sentry.

Para hacerlo manualmente, agrega el DSN al `.env`:

```dotenv
NEXT_PUBLIC_SENTRY_DSN="https://public-key@o0.ingest.sentry.io/project-id"
SENTRY_TRACES_SAMPLE_RATE="0"
```

El mismo DSN activa los reportes del servidor y del navegador. `0` mantiene apagado el monitoreo de rendimiento para enviar solo errores. Reinicia el desarrollo o vuelve a compilar después de cambiar un valor `NEXT_PUBLIC_*`.

## 3. Source maps opcionales

Los source maps convierten las pilas minificadas de producción en ubicaciones legibles del código original. En Sentry, copia los slugs de organización y proyecto desde sus páginas de Settings. Después abre **Organization Settings → Developer Settings → Auth Tokens** y crea un token solo con `org:read` y `project:releases`.

```dotenv
SENTRY_ORG="tu-organizacion"
SENTRY_PROJECT="tu-proyecto"
SENTRY_AUTH_TOKEN="sntrys_reemplaza_con_tu_token"
```

Los tres valores deben estar presentes durante `next build`; de lo contrario RapidAuth omite la subida sin avisos. `SENTRY_AUTH_TOKEN` es secreto y solo se usa en el build. Nunca le pongas el prefijo `NEXT_PUBLIC_`, lo imprimas ni lo subas al repositorio.

## 4. Vercel

En **Project Settings → Environment Variables**, agrega `NEXT_PUBLIC_SENTRY_DSN` a cada entorno donde deban funcionar los reportes. Agrega `SENTRY_ORG`, `SENTRY_PROJECT` y el secreto `SENTRY_AUTH_TOKEN` a los entornos de build solo si quieres source maps. Usa `SENTRY_TRACES_SAMPLE_RATE=0` salvo que actives el rendimiento deliberadamente. Vuelve a desplegar después de cambiar el DSN.

## 5. Docker

Pasa el DSN público como `NEXT_PUBLIC_SENTRY_DSN` durante la construcción de la imagen porque se incrusta en el bundle del navegador. Si activas source maps, pasa la organización y el proyecto como argumentos de build y monta el token como secreto BuildKit `sentry_auth_token`. Proporciona también el DSN y la tasa de muestreo al contenedor en ejecución para los reportes del servidor. Consulta los comandos completos en [Docker](03-docker.md).

## 6. Comprueba la integración

Ejecuta la aplicación, provoca un error inesperado en un flujo de desarrollo o staging y abre **Issues** en el proyecto de Sentry. El evento debe incluir una etiqueta `area` cuando proviene de un error atrapado por la aplicación.

Para una prueba manual única, llama temporalmente a `reportError(new Error('Sentry setup check'), { area: 'sentry.setup-check' })` desde un camino de servidor que puedas ejecutar, recarga ese camino, confirma el issue y elimina la llamada temporal. Nunca pongas credenciales ni datos personales en el error de prueba.

## Privacidad y desactivación

RapidAuth desactiva la recolección automática de datos de usuario, cookies, cabeceras, parámetros de consulta, cuerpos HTTP, variables locales, valores de base de datos, colas, variables GraphQL y entradas/salidas de IA. Un filtro compartido también borra claves que parezcan secretas a cualquier profundidad, parámetros de URL con tokens y direcciones de email. El usuario en Sentry se limita a un ID; se eliminan nombre y email. Session Replay no está habilitado.

Para desactivar Sentry, ejecuta `bun run setup:sentry` y elige **Disable**, o elimina todas sus variables y vuelve a compilar. Un DSN vacío o inválido mantiene apagados los reportes del servidor y del navegador.

---

← [Almacenamiento de archivos](05-file-storage.md) · [Índice en español](README.md) · [Actualización de dependencias →](04-dependency-updates.md)
