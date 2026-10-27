const ACTIVITY_ACTION_LABELS: Record<string, string> = {
  login: 'Login',
  logout: 'Logout',
  register: 'Register',
  profile_update: 'Profile Update',
  password_change: 'Password Change',
  email_change: 'Email Change',
  avatar_change: 'Avatar Change',
  '2fa_enabled': '2FA Enabled',
  '2fa_disabled': '2FA Disabled',
  '2fa_verified': '2FA Verified',
  email_verified: 'Email Verified',
  oauth_login: 'OAuth Login',
  oauth_link: 'OAuth Link',
  terms_accepted: 'Terms Accepted',
  invitation_accepted: 'Invitation Accepted',
  session_revoked: 'Session Revoked',
  user_deleted: 'User Deleted',
};

/** Readable name of an activity action; an action without a label is shown as it is. */
export function getActivityActionLabel(action: string): string {
  return ACTIVITY_ACTION_LABELS[action] ?? action;
}
