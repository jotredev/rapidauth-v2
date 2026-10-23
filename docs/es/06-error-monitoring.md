# Monitoreo de errores con Sentry

Sentry reúne errores inesperados de la aplicación para que quienes la mantienen puedan ver fallos que los usuarios no pueden diagnosticar. Es opcional en RapidAuth. Sin un `NEXT_PUBLIC_SENTRY_DSN` válido, el SDK no se inicializa ni envía eventos.

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

El DSN activa los reportes del servidor y del navegador. El servidor lee `NEXT_PUBLIC_SENTRY_DSN` al atender cada solicitud o al arrancar el proceso (a través de un objeto de entorno para que Next.js no lo congele durante el build). RapidAuth entrega el DSN público validado mediante la ruta dinámica y sin caché `/api/sentry-config`. `instrumentation-client.ts` consulta esa ruta al iniciar el navegador y configura Sentry. `0` mantiene apagado el monitoreo de rendimiento para enviar solo errores. Define o cambia el DSN y reinicia el servidor o contenedor; no hace falta reconstruir la imagen.

El navegador recibe el DSN al cargar la página; un error en los primeros milisegundos, antes de recibirlo, quizá no llegue a Sentry.

## 3. Source maps opcionales

Los source maps convierten las pilas minificadas de producción en ubicaciones legibles del código original. En Sentry, copia los slugs de organización y proyecto desde sus páginas de Settings. Después abre **Organization Settings → Developer Settings → Auth Tokens** y crea un token solo con `org:read` y `project:releases`.

```dotenv
SENTRY_ORG="tu-organizacion"
SENTRY_PROJECT="tu-proyecto"
SENTRY_AUTH_TOKEN="sntrys_reemplaza_con_tu_token"
```

Los tres valores deben estar presentes durante `next build`; de lo contrario RapidAuth omite la subida sin avisos. `SENTRY_AUTH_TOKEN` es secreto y solo se usa en el build. Nunca le pongas el prefijo `NEXT_PUBLIC_`, lo imprimas ni lo subas al repositorio.

## 4. Vercel

En **Project Settings → Environment Variables**, agrega `NEXT_PUBLIC_SENTRY_DSN` a cada entorno de ejecución donde deban funcionar los reportes. Agrega `SENTRY_ORG`, `SENTRY_PROJECT` y el secreto `SENTRY_AUTH_TOKEN` a los entornos de build solo si quieres source maps. Usa `SENTRY_TRACES_SAMPLE_RATE=0` salvo que actives el rendimiento deliberadamente. Reinicia o vuelve a desplegar después de cambiar el DSN.

## 5. Docker

Define `NEXT_PUBLIC_SENTRY_DSN` en el `.env` de ejecución que usa Compose. RapidAuth lo lee al arrancar el contenedor y entrega el valor público al navegador mediante `/api/sentry-config`; agregarlo o cambiarlo requiere reiniciar el contenedor de la app, no reconstruir la imagen. Para source maps, pasa `SENTRY_ORG` y `SENTRY_PROJECT` como argumentos de build y monta `SENTRY_AUTH_TOKEN` como el secreto BuildKit `sentry_auth_token`. Esos tres valores solo se usan durante `next build`.

## 6. Comprueba la integración

Ejecuta la aplicación, provoca un error inesperado en un flujo de desarrollo o staging y abre **Issues** en el proyecto de Sentry. El evento debe incluir una etiqueta `area` cuando proviene de un error atrapado por la aplicación.

Para una prueba manual única, llama temporalmente a `reportError(new Error('Sentry setup check'), { area: 'sentry.setup-check' })` desde un camino de servidor que puedas ejecutar, recarga ese camino, confirma el issue y elimina la llamada temporal. Nunca pongas credenciales ni datos personales en el error de prueba.

## Privacidad y desactivación

RapidAuth desactiva la recolección automática de datos de usuario, cookies, cabeceras, parámetros de consulta, cuerpos HTTP, variables locales, valores de base de datos, colas, variables GraphQL y entradas/salidas de IA. Un filtro compartido también borra claves que parezcan secretas a cualquier profundidad, parámetros de URL con tokens y direcciones de email. El usuario en Sentry se limita a un ID; se eliminan nombre y email. Session Replay no está habilitado.

Para desactivar Sentry, ejecuta `bun run setup:sentry` y elige **Disable**, o vacía `NEXT_PUBLIC_SENTRY_DSN` y reinicia el servidor o contenedor. Un DSN vacío o inválido mantiene apagados los reportes del servidor y del navegador.

---

← [Almacenamiento de archivos](05-file-storage.md) · [Índice en español](README.md) · [Actualización de dependencias →](04-dependency-updates.md)
