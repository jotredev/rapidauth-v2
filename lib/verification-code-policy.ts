export const VERIFICATION_CODE_POLICY = {
  length: 6,
  expiresInSeconds: 600,
  resendCooldownSeconds: 60,
  maxAttempts: 5,
} as const;
