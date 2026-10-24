# Desplegar en un VPS

Esta guía ejecuta el stack de Compose de producción en un VPS Linux. Supone que nunca has usado Docker; sigue los pasos en orden. Compose inicia la app, PostgreSQL, Caddy y los respaldos diarios de la base de datos.

## Qué necesitas

- Un VPS con una versión LTS actual de Ubuntu y una dirección IPv4 pública.
- Un nombre de dominio que controles.
- Una terminal en tu computadora y una cuenta SSH en el VPS.

## 1. Apunta el dominio al VPS

En tu proveedor de DNS, crea un registro `A` para el dominio (por ejemplo, `auth.example.com`) que apunte a la dirección IPv4 del VPS. Agrega un registro `AAAA` solo si el VPS tiene IPv6 público funcionando. El cambio de DNS puede tardar.

## 2. Permite solo los puertos del firewall necesarios

En el firewall del proveedor del VPS, permite SSH por el puerto 22 y tráfico web por los puertos 80 y 443. Caddy usa TCP para HTTP/HTTPS y UDP 443 para HTTP/3. No abras PostgreSQL (5432) ni el puerto de la app (3000) a internet.

Si usas el firewall UFW de Ubuntu, conéctate por SSH primero y ejecuta:

```sh
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp
sudo ufw enable
sudo ufw status
```

Mantén abierta tu sesión SSH actual al activar el firewall y confirma que el puerto 22 esté permitido.

## 3. Instala Docker y Bun

Instala Docker Engine y el plugin de Compose siguiendo las [instrucciones oficiales de Docker para Ubuntu](https://docs.docker.com/engine/install/ubuntu/). Comprueba que funcionen ambos comandos:

```sh
docker version
docker compose version
```

Instala Bun siguiendo las [instrucciones oficiales de Bun](https://bun.sh/docs/installation). Bun solo se usa para ejecutar el asistente de producción; la app corre en Docker.

## 4. Configura RapidAuth

Clona el repositorio e instala sus dependencias fijadas:

```sh
git clone https://github.com/jotredev/rapidauth-v2.git
cd rapidauth-v2
bun install
```

Ejecuta la configuración de producción:

```sh
bun run setup:prod
```

Responde **yes** a «Are you deploying with Docker Compose? (y/n)» e ingresa tu dirección HTTPS pública, por ejemplo, `https://auth.example.com`. El asistente crea un secreto de Better Auth y guarda los ajustes en `.env`. Compose proporciona por su cuenta la conexión a la base de datos, así que no necesitas ingresar `DATABASE_URL`. Mantén `.env` privado. Cuando el asistente pregunte por el proxy de confianza, elige **Own proxy** (opción 4, `TRUSTED_PROXY=proxy`) para que la app use la IP del cliente que establece Caddy. Las validaciones actuales siguen exigiendo una clave de Resend y un remitente verificado para el correo.

## 5. Inicia el stack del VPS

Valida los archivos de Compose e inicia la app, el proxy HTTPS y el servicio de respaldos:

```sh
docker compose --profile vps config --quiet
docker compose --profile vps up -d
```

El primer inicio descarga las imágenes de la app y Caddy, crea PostgreSQL, aplica las migraciones pendientes e inicia la app. Caddy escucha en los puertos 80 y 443 y redirige las solicitudes a la app. Si el DNS público apunta al VPS y ambos puertos son accesibles, Caddy obtiene y renueva automáticamente un certificado HTTPS de confianza pública.

Comprueba los servicios y sus registros:

```sh
docker compose --profile vps ps
docker compose --profile vps logs -f app caddy
```

Abre el dominio HTTPS y crea la primera cuenta administradora. Usa `Ctrl+C` para dejar de seguir los registros; eso no detiene los servicios.

Para comprobar un certificado local, configura `BETTER_AUTH_URL=https://localhost` en `.env` e inicia el perfil. Caddy crea un certificado firmado por su autoridad local. El navegador lo mostrará como no confiable hasta instalar esa autoridad en la computadora; usa un dominio público para un certificado de confianza.

## 6. Actualiza RapidAuth

Elige la versión del release en la línea `image` de `docker/app.yaml`, luego descarga y recrea los contenedores:

```sh
docker compose --profile vps pull
docker compose --profile vps up -d
```

Compose ejecuta las migraciones Prisma pendientes antes de iniciar la app actualizada. Conserva los volúmenes `postgres_data`, `app_storage`, `caddy_data`, `caddy_config` y `db_backups`; guardan la base, los archivos subidos, el estado HTTPS y los respaldos.

## 7. Restaura un respaldo de la base

El contenedor de respaldos guarda un dump SQL comprimido al iniciar y luego cada día a las 02:00 UTC. Conserva los últimos siete días en el volumen `db_backups`.

Copia el respaldo elegido a un archivo temporal y luego detén la app y el programador de respaldos. Reemplaza la base actual con una vacía y restaura el dump (cambia el nombre del archivo por uno que aparezca en el primer comando):

```sh
docker compose --profile vps exec backup ls -lh /backups
docker compose --profile vps exec -T backup sh -c 'cat "/backups/$1"' sh rapidauth-YYYYMMDDTHHMMSSZ.sql.gz > /tmp/rapidauth-restore.sql.gz
docker compose --profile vps stop app backup
docker compose --profile vps exec db dropdb -U rapidauth --if-exists rapidauth
docker compose --profile vps exec db createdb -U rapidauth -O rapidauth rapidauth
gunzip -c /tmp/rapidauth-restore.sql.gz | docker compose --profile vps exec -T db psql -U rapidauth -d rapidauth
docker compose --profile vps up -d app backup
rm /tmp/rapidauth-restore.sql.gz
```

Reemplaza el nombre de ejemplo por uno de los que aparecen en `/backups`. Ejecuta los comandos desde la carpeta del repositorio. Al borrar la base se eliminan sus datos actuales de forma permanente; verifica el nombre del respaldo antes de ejecutar los comandos.

## 8. Copia los respaldos fuera del VPS

Guarda otra copia fuera del VPS. Para copiar un respaldo a tu computadora, ejecuta esto desde la carpeta del repositorio en el VPS:

```sh
docker compose --profile vps exec -T backup sh -c 'cat /backups/rapidauth-YYYYMMDDTHHMMSSZ.sql.gz' > rapidauth-backup.sql.gz
```

Después, desde una terminal en tu computadora, descárgalo con:

```sh
scp user@ip-de-tu-vps:/ruta/a/rapidauth-v2/rapidauth-backup.sql.gz .
```

Reemplaza `user`, la dirección del VPS y la ruta del repositorio con tus datos SSH. Guarda el archivo descargado en otro lugar seguro y privado.

## Despliega con Coolify

[Coolify](https://github.com/coollabsio/coolify) es una plataforma autoalojada para desplegar apps y bases de datos, con licencia Apache-2.0. Instálala en un VPS y conecta tu repositorio Git.

Crea una aplicación Docker Compose desde este repositorio, usa la raíz del repositorio como directorio base y selecciona `compose.yaml`. Coolify incluye su propio proxy HTTPS, así que no inicies el servicio `caddy` en esos mismos puertos. Configura este comando de inicio personalizado:

```sh
docker compose --profile vps up -d app backup
```

Esto inicia la app y el servicio de respaldos con sus dependencias de base de datos, y deja Caddy detenido. En Coolify, agrega tu dominio al servicio `app` por el puerto `3000`; luego configura `BETTER_AUTH_URL` con esa dirección HTTPS pública y las demás variables que exige `setup:prod`. Despliega y revisa los registros de despliegue y ejecución de Coolify. Usa las instrucciones de respaldo y restauración anteriores; los respaldos permanecen en el volumen `db_backups` del servidor.

---

← [Docker](03-docker.md) · [Índice de documentación](README.md) · [Almacenamiento de archivos →](05-file-storage.md) · [Documentación del proyecto](../README.md)
