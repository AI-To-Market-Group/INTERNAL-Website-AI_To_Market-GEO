/**
 * Week label for radar header: "Week of 26 Jan"
 * Timezone: Europe/Paris. Only start of week (Monday).
 */
export function getCurrentWeekLabel(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris",
    day: "numeric",
    month: "short",
  });
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  const start = formatter.format(monday);
  return `Week of ${start}`;
}
