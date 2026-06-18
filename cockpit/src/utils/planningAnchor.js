/** Demo planning horizon — packaging orders start here, not on calendar today. */
export const PLANNING_ANCHOR = '2026-09-01';

export function formatPlanningDate(iso = PLANNING_ANCHOR) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
