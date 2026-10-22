import type { AuthProvider } from '@/actions/users';
import type { StatusType } from '@/components/dashboard';

export interface Filters {
  roles: string[];
  statuses: string[];
  providers: AuthProvider[];
}

export const USER_STATUS_MAP: Record<string, { status: StatusType; label: string }> = {
  active: { status: 'success', label: 'Active' },
  pending: { status: 'warning', label: 'Pending' },
  inactive: { status: 'error', label: 'Inactive' },
};

export const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-muted text-foreground border-foreground/20',
  moderator: 'bg-muted text-foreground border-foreground/20',
  user: 'bg-muted text-foreground border-foreground/20',
};
