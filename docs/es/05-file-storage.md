# Almacenamiento de avatares para principiantes

RapidAuth guarda el archivo de imagen del avatar y registra su URL en el perfil del usuario. La URL es pública: cualquiera que la tenga puede ver la imagen. Elige dónde guardar los archivos antes de desplegar.

## Elige un motor

- **Local** guarda los archivos en `storage/uploads/` dentro del servidor de la app. Úsalo en desarrollo o en un servidor propio con disco persistente y escribible. Los reinicios de contenedor o los servidores con disco temporal pueden borrar los archivos. En Docker de producción, monta un volumen en `/app/storage`.
- **Compatible con S3** guarda los archivos en un bucket de almacenamiento de objetos. Úsalo en hosting cloud o con varias instancias de la app. RapidAuth funciona con Cloudflare R2, Amazon S3, Backblaze, DigitalOcean Spaces, SeaweedFS y otros servicios compatibles con S3. El bucket o dominio propio debe permitir lectura pública porque los perfiles abren la URL directamente.

El valor predeterminado es `STORAGE_DRIVER=local`. El build de producción muestra un recordatorio sobre el disco persistente. Al elegir S3, el servidor se detiene con un mensaje claro si faltan variables obligatorias.

## Silo propio con Docker

[PGSTY Silo](https://github.com/pgsty/silo) es un fork de MinIO con licencia AGPL-3.0-or-later que ofrece un servidor compatible con S3. El perfil opcional `s3` de Compose ejecuta una versión fija de Silo, guarda sus datos en el volumen `storage_data` y, al arrancar, crea el bucket configurado con lectura pública de objetos. El bucket es público para que el navegador pueda abrir directamente los avatares del perfil. [PGSTY mcli](https://github.com/pgsty/mc), también con licencia AGPL-3.0-or-later, es el cliente de línea de comandos que crea el bucket y aplica su política de lectura pública.

Configura los valores S3 existentes en `.env`:

```dotenv
STORAGE_DRIVER="s3"
S3_ENDPOINT="http://storage:9000"
S3_REGION="us-east-1"
S3_BUCKET="rapidauth-avatars"
S3_ACCESS_KEY_ID="rapidauth"
S3_SECRET_ACCESS_KEY="replace-with-a-long-random-password"
S3_PUBLIC_URL="http://localhost:9000/rapidauth-avatars"
S3_FORCE_PATH_STYLE="true"
```

Inicia la app y Silo con `docker compose --profile s3 up --build`. El hostname `storage` solo está disponible para contenedores de la red Compose. Para ejecutar la app en el host, inicia solo Silo con `docker compose --profile s3 up -d storage-public-read` y luego usa `S3_ENDPOINT="http://localhost:9000" bun dev`. Para una app desplegada, configura `S3_PUBLIC_URL` con un hostname HTTPS público o un proxy inverso que sirva el bucket; el navegador no puede acceder al hostname privado de Compose. El perfil de Silo es opcional, así que `docker compose up` normal sigue usando Local.

Para desarrollo con Docker, ejecuta `docker compose -f compose.dev.yaml --profile s3 up --build`.

## Cloudflare R2 (ejemplo recomendado)

### 1. Crea un bucket

En el panel de Cloudflare, abre **R2 Object Storage**, elige **Create bucket**, escribe un nombre único como `rapidauth-avatars` y créalo. Guarda el nombre exacto; RapidAuth lo necesita.

### 2. Habilita la lectura pública

Abre **Settings** del bucket y habilita su URL pública de desarrollo `r2.dev` o conecta un dominio propio como `avatars.example.com`. Para un servicio publicado conviene usar un dominio propio. El dominio debe estar activo y mostrar objetos sin iniciar sesión. Escribe su dirección base en `S3_PUBLIC_URL`, sin agregar la clave del objeto, por ejemplo `https://avatars.example.com`.

### 3. Crea llaves de acceso

En **R2 → Manage R2 API Tokens**, crea un token con permiso **Object Read & Write** y, si es posible, limítalo al bucket de avatares. Copia el Access Key ID y el Secret Access Key cuando Cloudflare los muestre; el secreto no se vuelve a mostrar. Guarda ambos solo en las variables del servidor.

### 4. Configura las variables

Agrega estos valores a las variables del hosting (o a `.env` para desarrollo local):

```dotenv
STORAGE_DRIVER="s3"
S3_ENDPOINT="https://ACCOUNT_ID.r2.cloudflarestorage.com"
S3_REGION="auto"
S3_BUCKET="rapidauth-avatars"
S3_ACCESS_KEY_ID="tu-access-key-id"
S3_SECRET_ACCESS_KEY="tu-secret-access-key"
S3_PUBLIC_URL="https://avatars.example.com"
S3_FORCE_PATH_STYLE="true"
```

Reemplaza `ACCOUNT_ID`, el bucket, las llaves y el dominio por tus valores. `S3_ENDPOINT` es la dirección de API del panel R2. `S3_PUBLIC_URL` es donde el navegador puede abrir una imagen. Son direcciones distintas. `S3_FORCE_PATH_STYLE=true` significa que el nombre del bucket va en la ruta; esto ayuda a R2 y a muchos servicios compatibles a entender la petición.

Ejecuta `bun run init:setup --only storage` para ingresar los valores con el asistente. El asistente sube un objeto temporal pequeño, comprueba que se pueda leer por la URL pública y lo borra. Si falla, revisa el bucket, las llaves, el acceso público y la URL.

## Valores para Amazon S3

Crea un bucket y una llave IAM con permisos para leer, escribir y borrar objetos de ese bucket. Configura lectura pública con una política adecuada o un dominio público de CloudFront o propio. Ten en cuenta que cualquiera con la URL del objeto podrá ver un avatar.

```dotenv
STORAGE_DRIVER="s3"
S3_ENDPOINT=""
S3_REGION="us-east-1"
S3_BUCKET="rapidauth-avatars"
S3_ACCESS_KEY_ID="tu-access-key-id"
S3_SECRET_ACCESS_KEY="tu-secret-access-key"
S3_PUBLIC_URL="https://rapidauth-avatars.s3.us-east-1.amazonaws.com"
S3_FORCE_PATH_STYLE="false"
```

Reemplaza la región y el nombre del bucket. Deja `S3_ENDPOINT` vacío para usar Amazon. `false` pone el bucket en el hostname, que es el formato normal de Amazon S3.

## Servidor propio con SeaweedFS

SeaweedFS puede exponer una puerta de enlace S3. Crea el bucket y una llave con permisos de lectura, escritura y borrado de objetos según tu instalación. Usa la dirección de la puerta de enlace como `S3_ENDPOINT` y la dirección pública (incluida la ruta del bucket si el proxy público la requiere) como `S3_PUBLIC_URL`.

```dotenv
STORAGE_DRIVER="s3"
S3_ENDPOINT="https://s3.example.com"
S3_REGION="us-east-1"
S3_BUCKET="rapidauth-avatars"
S3_ACCESS_KEY_ID="tu-access-key-id"
S3_SECRET_ACCESS_KEY="tu-secret-access-key"
S3_PUBLIC_URL="https://files.example.com/rapidauth-avatars"
S3_FORCE_PATH_STYLE="true"
```

Con acceso tipo path-style, `true` pone el nombre del bucket después del hostname de la puerta de enlace. Configura el proxy o servicio para que `S3_PUBLIC_URL` pueda leer esos mismos objetos.

## Cambiar de motor y mover los avatares

1. Asegúrate de que el origen y el destino estén disponibles. Para pasar de Local a S3, configura los valores S3 de destino y conserva los archivos locales. Para pasar de S3 a Local, conserva disponibles el endpoint, bucket y llaves S3 de origen mientras eliges `STORAGE_DRIVER=local`.
2. Ejecuta una simulación. Muestra qué URLs de perfil puede mover y no cambia nada:

   ```sh
   bun run storage:migrate
   ```

3. Si la lista es correcta, aplica la migración:

   ```sh
   bun run storage:migrate --apply
   ```

El script copia y vuelve a leer cada archivo, actualiza la URL del perfil y solo entonces borra el origen. Guarda el progreso en `storage/.migration-state.json`, una carpeta ignorada por Git, para que al repetir el comando pueda terminar la actualización de la base o la limpieza del origen tras una interrupción. También admite archivos antiguos de `public/uploads/avatars`. Si un elemento falla, conserva el origen; corrige el proveedor o archivo y vuelve a ejecutar el comando. Al repetirlo, omite los avatares que ya están en el destino.

Al cambiar de motor, el asistente también recuerda ejecutar esta migración. El asistente solo cambia la configuración; no mueve archivos automáticamente.

## Errores comunes

- **Faltan valores S3:** Configura `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` y `S3_PUBLIC_URL` al usar el motor `s3`.
- **La carga funciona pero no aparece el avatar:** Abre la URL exacta formada por `S3_PUBLIC_URL` y la clave del objeto en una ventana privada. Revisa lectura pública, DNS del dominio propio y la ruta base de la URL.
- **Error de firma o direccionamiento:** Confirma la región y `S3_FORCE_PATH_STYLE`. Usa `true` con muchas APIs compatibles y `false` con los hostnames normales de Amazon S3.
- **Acceso denegado al cargar o borrar:** La llave necesita permiso de escritura y borrado en ese bucket. La lectura pública no da permisos de escritura.
- **Desaparecen los archivos en Local:** El servidor tiene disco temporal o el volumen está montado en otra ruta. En el contenedor de producción, monta almacenamiento persistente en `/app/storage`.
- **La migración omite un elemento:** Su URL no pertenece al origen Local o S3 configurado, o no encuentra el archivo. Conserva una copia del original hasta comprobar la URL de destino.

Consulta [Variables de entorno](01-environment-variables.md) para conocer cada opción y [Docker](03-docker.md) para montar el volumen de producción.
