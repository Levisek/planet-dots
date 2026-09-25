// Reálné kalendářní datum (V4.4 F2). Astronomický rok 0 = 1 př. n. l.,
// rok -N = (N+1) př. n. l.
export function formatCalendar(date) {
  const y = date.getUTCFullYear();
  const d = date.getUTCDate();
  const m = date.getUTCMonth() + 1;
  if (y < 1) return `${d}. ${m}. ${1 - y} př. n. l.`;
  return `${d}. ${m}. ${y}`;
}
