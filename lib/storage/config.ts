import { getEnv, resolveEnv, type EnvSource, type S3StorageConfig, type StorageDriver } from '@/lib/env';

export type { S3StorageConfig, StorageDriver };

// An explicit env is resolved on the spot; without one, the cached resolution is used.
function storageFor(env?: EnvSource) {
  return (env ? resolveEnv(env) : getEnv()).config.storage;
}

export function getStorageDriver(env?: EnvSource): StorageDriver {
  const { driver, driverError } = storageFor(env);
  if (driverError) throw new Error(driverError);
  return driver;
}

export function getStorageConfigError(env?: EnvSource): string | null {
  const storage = storageFor(env);
  if (storage.driverError) return storage.driverError;
  return storage.driver === 's3' ? storage.s3Problem : null;
}

export function getS3StorageConfigError(env?: EnvSource): string | null {
  const storage = storageFor(env);
  return storage.driver === 's3' ? storage.s3Problem : null;
}

export function getS3StorageConfig(env?: EnvSource): S3StorageConfig {
  const storage = storageFor(env);
  const error = storage.driver === 's3' ? storage.s3Problem : null;
  if (error) throw new Error(error);
  if (!storage.s3) throw new Error(storage.s3Problem ?? 'S3 storage is not configured.');
  return storage.s3;
}
