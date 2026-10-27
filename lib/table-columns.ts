export function getColumnsCookieName(tableId: string): string {
  return `rapidauth-columns-${tableId}`;
}

function serializeHiddenColumns(hidden: readonly string[]): string {
  return hidden.join('.');
}

export function writeHiddenColumnsCookie(tableId: string, hidden: readonly string[]): void {
  document.cookie = `${getColumnsCookieName(tableId)}=${serializeHiddenColumns(hidden)}; path=/dashboard; max-age=31536000; samesite=lax`;
}

const COLUMN_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export function readHiddenColumns(cookieValue: string | undefined): string[] {
  if (!cookieValue || cookieValue.length > 200) {
    return [];
  }

  const ids = cookieValue.split('.').filter((id) => COLUMN_ID_PATTERN.test(id));
  return [...new Set(ids)];
}
