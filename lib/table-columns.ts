export type TableId = 'users' | 'activity' | 'system-logs';

export interface TableColumnOption {
  id: string;
  label: string;
  required?: boolean;
}

export const TABLE_COLUMNS: Record<TableId, readonly TableColumnOption[]> = {
  users: [
    { id: 'name', label: 'User', required: true },
    { id: 'role', label: 'Role' },
    { id: 'status', label: 'Status' },
    { id: 'createdAt', label: 'Joined' },
    { id: 'lastActive', label: 'Last Active' },
  ],
  activity: [
    { id: 'user', label: 'User', required: true },
    { id: 'action', label: 'Action' },
    { id: 'ipAddress', label: 'IP Address' },
    { id: 'device', label: 'Device' },
    { id: 'time', label: 'Time' },
  ],
  'system-logs': [
    { id: 'time', label: 'Time', required: true },
    { id: 'level', label: 'Level' },
    { id: 'source', label: 'Source' },
    { id: 'code', label: 'Code' },
    { id: 'user', label: 'User' },
    { id: 'details', label: 'Details' },
  ],
};

export function getColumnsCookieName(tableId: TableId): string {
  return `rapidauth-columns-${tableId}`;
}

export function serializeHiddenColumns(hidden: readonly string[]): string {
  return hidden.join('.');
}

export function writeHiddenColumnsCookie(tableId: TableId, hidden: readonly string[]): void {
  document.cookie = `${getColumnsCookieName(tableId)}=${serializeHiddenColumns(hidden)}; path=/dashboard; max-age=31536000; samesite=lax`;
}

export function readHiddenColumns(tableId: TableId, cookieValue: string | undefined): string[] {
  if (!cookieValue || cookieValue.length > 200) {
    return [];
  }

  const requested = new Set(cookieValue.split('.'));
  const columns = TABLE_COLUMNS[tableId];

  return columns
    .filter((col) => !col.required && requested.has(col.id))
    .map((col) => col.id);
}
