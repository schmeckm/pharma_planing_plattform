/** Shared display formatters for planner-facing UI. */

export function hasValue(v) {
  return v != null && v !== '' && v !== '—';
}

export function fmtHours(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return `${Math.round(n * 10) / 10} h`;
}

export function fmtDays(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n * 10) / 10;
  return rounded === 1 ? '1 day' : `${rounded} days`;
}

export function fmtDuration(days, hours) {
  const hFmt = fmtHours(hours);
  const dFmt = fmtDays(days);
  if (dFmt && hFmt) return `${dFmt} (${hFmt})`;
  if (dFmt) return dFmt;
  if (hFmt) return hFmt;
  return null;
}

export function fmtPct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return `${Math.round(n)}%`;
}

export function fmtMonths(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return `${Math.round(n * 10) / 10} mo`;
}

export function planningMethodLabel(method) {
  const map = {
    COMBINED_FORWARD_BACKWARD: 'Combined forward/backward',
    FORWARD_ONLY: 'Forward only',
  };
  if (map[method]) return map[method];
  if (!method) return null;
  return method
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function daysBetween(start, end) {
  if (!start || !end) return null;
  const a = new Date(start);
  const b = new Date(end);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}
