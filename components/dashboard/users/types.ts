import type { StatusType } from '@/components/dashboard';

export const USER_STATUS_MAP: Record<string, { status: StatusType; label: string }> = {
  active: { status: 'success', label: 'Active' },
  pending: { status: 'warning', label: 'Pending' },
  inactive: { status: 'error', label: 'Inactive' },
};
