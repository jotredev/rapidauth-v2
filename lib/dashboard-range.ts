export const DASHBOARD_RANGES = ['7d', '30d', '90d', '12m'] as const;
export type DashboardRange = (typeof DASHBOARD_RANGES)[number];
export const DEFAULT_DASHBOARD_RANGE: DashboardRange = '30d';
export const DASHBOARD_RANGE_LABELS: Record<DashboardRange, string> = {
  '7d': 'Past 7 days',
  '30d': 'Past 30 days',
  '90d': 'Past 90 days',
  '12m': 'Past 12 months',
};

export type BucketUnit = 'day' | 'week' | 'month';

export interface RangeBucket {
  key: string;   // 'YYYY-MM-DD' para día y semana (fecha UTC del inicio), 'YYYY-MM' para mes
  label: string; // día y semana: 'Oct 14'; mes: 'Oct 2026'
  start: Date;   // inicio UTC del cubo
}

export interface RangeWindow {
  range: DashboardRange;
  unit: BucketUnit;
  start: Date;          // inicio UTC del primer cubo
  previousStart: Date;  // inicio del periodo anterior de la misma duración
  buckets: RangeBucket[];
}

export function parseDashboardRange(value: string | string[] | undefined): DashboardRange {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (candidate && (DASHBOARD_RANGES as readonly string[]).includes(candidate)) {
    return candidate as DashboardRange;
  }
  return DEFAULT_DASHBOARD_RANGE;
}

export function getBucketKey(date: Date, unit: BucketUnit): string {
  if (unit === 'month') {
    return date.toISOString().slice(0, 7);
  }
  if (unit === 'week') {
    const day = date.getUTCDay();
    const diff = (day + 6) % 7;
    const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - diff));
    return monday.toISOString().slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
}

function formatBucketLabel(date: Date, unit: BucketUnit): string {
  if (unit === 'month') {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function getRangeWindow(range: DashboardRange, now: Date): RangeWindow {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  if (range === '7d') {
    const unit: BucketUnit = 'day';
    const buckets: RangeBucket[] = [];
    for (let i = 6; i >= 0; i--) {
      const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i));
      buckets.push({
        key: getBucketKey(start, unit),
        label: formatBucketLabel(start, unit),
        start,
      });
    }
    const start = buckets[0].start;
    const previousStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() - 7));
    return { range, unit, start, previousStart, buckets };
  }

  if (range === '30d') {
    const unit: BucketUnit = 'day';
    const buckets: RangeBucket[] = [];
    for (let i = 29; i >= 0; i--) {
      const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i));
      buckets.push({
        key: getBucketKey(start, unit),
        label: formatBucketLabel(start, unit),
        start,
      });
    }
    const start = buckets[0].start;
    const previousStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() - 30));
    return { range, unit, start, previousStart, buckets };
  }

  if (range === '90d') {
    const unit: BucketUnit = 'week';
    const dayMinus89 = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 89));
    const startDiff = (dayMinus89.getUTCDay() + 6) % 7;
    const start = new Date(Date.UTC(dayMinus89.getUTCFullYear(), dayMinus89.getUTCMonth(), dayMinus89.getUTCDate() - startDiff));

    const todayDiff = (today.getUTCDay() + 6) % 7;
    const currentMonday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - todayDiff));

    const buckets: RangeBucket[] = [];
    let cur = new Date(start.getTime());
    while (cur.getTime() <= currentMonday.getTime()) {
      buckets.push({
        key: getBucketKey(cur, unit),
        label: formatBucketLabel(cur, unit),
        start: cur,
      });
      cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth(), cur.getUTCDate() + 7));
    }

    const previousStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() - buckets.length * 7));
    return { range, unit, start, previousStart, buckets };
  }

  // 12m
  const unit: BucketUnit = 'month';
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
  const buckets: RangeBucket[] = [];
  for (let i = 0; i < 12; i++) {
    const bucketStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
    buckets.push({
      key: getBucketKey(bucketStart, unit),
      label: formatBucketLabel(bucketStart, unit),
      start: bucketStart,
    });
  }
  const previousStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 12, 1));
  return { range, unit, start, previousStart, buckets };
}
