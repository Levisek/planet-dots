const J2000_EPOCH_MS = new Date('2000-01-01T12:00:00Z').getTime();
const EARTH_SIM_PERIOD_SEC = 10;
const DAYS_PER_SIM_SECOND = 365.25 / EARTH_SIM_PERIOD_SEC;

export function getSimulationDate(simElapsed) {
  const days = simElapsed * DAYS_PER_SIM_SECOND;
  return new Date(J2000_EPOCH_MS + days * 86400 * 1000);
}

export function formatRelative(simElapsed) {
  const totalDays = simElapsed * DAYS_PER_SIM_SECOND;
  const sign = totalDays < 0 ? '−' : '+';
  const absDays = Math.abs(totalDays);
  const days = Math.floor(absDays);
  const hours = Math.floor((absDays - days) * 24);
  return `${sign} ${days}d ${hours.toString().padStart(2, '0')}h`;
}
