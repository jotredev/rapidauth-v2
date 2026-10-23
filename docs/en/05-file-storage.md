# Avatar file storage for beginners

RapidAuth stores an avatar image file and saves its URL in the user's profile. The URL is public: anyone who has it can view the image. Choose where those files live before deploying.

## Choose a storage engine

- **Local** saves files under `storage/uploads/` on the app server. Choose it for development or a server you manage when that server has persistent writable disk. Container restarts or hosts with temporary disks can remove the files. In production Docker, mount a volume at `/app/storage`.
- **S3-compatible** stores files in an object-storage bucket. Choose it for cloud hosting or multiple app instances. RapidAuth works with Cloudflare R2, Amazon S3, Backblaze, DigitalOcean Spaces, SeaweedFS, and other S3-compatible services. The bucket or custom domain must allow public reads because profiles use the URL directly.

The default is `STORAGE_DRIVER=local`. The production build prints a reminder about persistent disk. When S3 is selected, the server stops with a clear message if required settings are missing.

## Self-hosted Silo with Docker

[PGSTY Silo](https://github.com/pgsty/silo) is an AGPL-3.0-or-later fork of MinIO that provides an S3-compatible server. The optional `s3` Compose profile runs a fixed Silo release, stores its data in the `storage_data` volume, and creates the configured bucket with public object reads when it starts. The bucket is public so profile avatars can be opened directly by browsers. [PGSTY mcli](https://github.com/pgsty/mc), also AGPL-3.0-or-later, is the command-line client that creates the bucket and applies its public-read policy.

Set the existing S3 values in `.env`:

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

Start the app and Silo with `docker compose --profile s3 up --build`. The `storage` hostname is only reachable from containers on the Compose network. To run the app on the host, start only Silo with `docker compose --profile s3 up -d storage-public-read`, then use `S3_ENDPOINT="http://localhost:9000" bun dev`. For a deployed app, point `S3_PUBLIC_URL` to a public HTTPS hostname or reverse proxy that serves the bucket; browsers cannot reach the private Compose hostname. The Silo profile is opt-in, so the normal `docker compose up` continues to use Local storage.

## Cloudflare R2 (recommended example)

### 1. Create a bucket

In the Cloudflare dashboard, open **R2 Object Storage**, choose **Create bucket**, enter a unique bucket name such as `rapidauth-avatars`, and create it. Keep the bucket name; RapidAuth needs the exact spelling.

### 2. Turn on public reads

Open the bucket's **Settings** and either enable its `r2.dev` public development URL or connect a custom domain such as `avatars.example.com`. A custom domain is better for a live service. The domain must be active and serve objects without a login. Put its base address in `S3_PUBLIC_URL`, with no object key at the end, for example `https://avatars.example.com`.

### 3. Create access keys

In **R2 → Manage R2 API Tokens**, create a token with **Object Read & Write** permission and limit it to the avatar bucket when possible. Copy the Access Key ID and Secret Access Key when Cloudflare shows them; the secret is not shown again. Keep both in server-side environment variables.

### 4. Set the environment variables

Add these values to the deployment's environment settings (or `.env` for local development):

```dotenv
STORAGE_DRIVER="s3"
S3_ENDPOINT="https://ACCOUNT_ID.r2.cloudflarestorage.com"
S3_REGION="auto"
S3_BUCKET="rapidauth-avatars"
S3_ACCESS_KEY_ID="your-access-key-id"
S3_SECRET_ACCESS_KEY="your-secret-access-key"
S3_PUBLIC_URL="https://avatars.example.com"
S3_FORCE_PATH_STYLE="true"
```

Replace `ACCOUNT_ID`, bucket, keys, and public domain with your values. `S3_ENDPOINT` is the API address from the R2 dashboard. `S3_PUBLIC_URL` is where a browser can open an uploaded image. These are different addresses. `S3_FORCE_PATH_STYLE=true` means the bucket name is placed in the URL path; it helps R2 and many compatible services understand the request.

Run `bun run init:setup --only storage` to enter these settings interactively. The wizard uploads a small temporary object, checks that the public URL can read it, and deletes it. If that check fails, verify the bucket, keys, public access, and URL.

## Amazon S3 values

Create a bucket and an IAM access key that can read, write, and delete objects in that bucket. Configure public reads using an appropriate bucket policy or a CloudFront/custom public domain. Be deliberate: public reads mean anyone with an object URL can view an avatar.

```dotenv
STORAGE_DRIVER="s3"
S3_ENDPOINT=""
S3_REGION="us-east-1"
S3_BUCKET="rapidauth-avatars"
S3_ACCESS_KEY_ID="your-access-key-id"
S3_SECRET_ACCESS_KEY="your-secret-access-key"
S3_PUBLIC_URL="https://rapidauth-avatars.s3.us-east-1.amazonaws.com"
S3_FORCE_PATH_STYLE="false"
```

Replace the region and bucket. Leave `S3_ENDPOINT` empty for Amazon's service. `false` places the bucket in the hostname, which is the normal Amazon S3 format.

## A server you manage with SeaweedFS

SeaweedFS can expose an S3 gateway. Create the bucket and an access key with object read/write/delete permissions using your SeaweedFS setup. Use the gateway address for `S3_ENDPOINT` and the public address (including the bucket path, if your public proxy requires it) for `S3_PUBLIC_URL`.

```dotenv
STORAGE_DRIVER="s3"
S3_ENDPOINT="https://s3.example.com"
S3_REGION="us-east-1"
S3_BUCKET="rapidauth-avatars"
S3_ACCESS_KEY_ID="your-access-key-id"
S3_SECRET_ACCESS_KEY="your-secret-access-key"
S3_PUBLIC_URL="https://files.example.com/rapidauth-avatars"
S3_FORCE_PATH_STYLE="true"
```

For path-style access, `true` places the bucket name after the endpoint hostname. Configure the proxy or gateway so the `S3_PUBLIC_URL` can read the same objects.

## Move existing avatars to another engine

1. Make sure both the old location and destination are available. For local-to-S3, configure the destination S3 values while leaving the local files in place. For S3-to-local, keep the old S3 endpoint, bucket, and keys available while choosing `STORAGE_DRIVER=local`.
2. Run a dry run. It lists the profile URLs it can move and makes no changes:

   ```sh
   bun run storage:migrate
   ```

3. If the list looks right, apply it:

   ```sh
   bun run storage:migrate --apply
   ```

The script copies and reads back each file, updates that user's image URL, and only then removes the source. It records an in-progress move in the ignored `storage/.migration-state.json` file so a rerun can finish database updates or source cleanup after an interruption. It also supports older files from `public/uploads/avatars`. If an item fails, its source stays in place; fix the provider or file and run the command again. Running the command again skips avatars already present in the destination.

Changing engines in the setup wizard also reminds you to run this migration. The wizard only updates environment configuration; it does not move files by itself.

## Common problems

- **S3 settings are missing:** Set `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, and `S3_PUBLIC_URL` when the driver is `s3`.
- **Upload works but the avatar is broken:** Open the exact `S3_PUBLIC_URL` plus object key in a private browser window. Check public-read configuration, custom-domain DNS, and that the URL has the right base path.
- **Signature or addressing errors:** Confirm the region and `S3_FORCE_PATH_STYLE`. Use `true` for many compatible APIs and `false` for normal Amazon S3 hostnames.
- **Access denied on upload/delete:** Give the key permission to write and delete objects in this bucket. Public-read settings do not grant write access.
- **Files disappear with Local:** The host has temporary storage or the volume is mounted somewhere else. Mount persistent storage at `/app/storage` in the production container.
- **A migration item is skipped:** Its URL is not from the configured local or S3 source, or its file cannot be found. Keep a copy of the original until the destination URL is checked.

See [Environment variables](01-environment-variables.md) for each setting and [Docker](03-docker.md) for the production volume mount.
