const TEST_SITE_KEYS = new Set([
  '1x00000000000000000000AA',
  '2x00000000000000000000AB',
  '1x00000000000000000000BB',
  '2x00000000000000000000BB',
  '3x00000000000000000000FF',
]);

const TEST_SECRET_KEYS = new Set([
  '1x0000000000000000000000000000000AA',
  '2x0000000000000000000000000000000AA',
  '3x0000000000000000000000000000000AA',
]);

export function isTurnstileTestSiteKey(value: string | undefined): boolean {
  return Boolean(value && TEST_SITE_KEYS.has(value));
}

export function isTurnstileTestSecretKey(value: string | undefined): boolean {
  return Boolean(value && TEST_SECRET_KEYS.has(value));
}
