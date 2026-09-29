import { SyncMode } from './sync';

// Sync timetable (Europe/Paris) — 2 Cloud Scheduler jobs, within the free tier:
// - day:   every 30 min from 08:00 to 20:30  (26 runs)
// - night: 21:00, 00:00, 03:00, 06:00         (4 runs; the 03:00 one is the sweep)
export const TIME_ZONE = 'Europe/Paris';
export const DAY_SCHEDULE = '*/30 8-20 * * *';
export const NIGHT_SCHEDULE = '0 0,3,6,21 * * *';
export const SWEEP_HOUR = 3;

const parisHour = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, hour: 'numeric', hourCycle: 'h23' });

/** Mode of a night run, from its scheduled time. */
export function nightRunMode(scheduledAt: Date): SyncMode {
  return Number(parisHour.format(scheduledAt)) === SWEEP_HOUR ? 'sweep' : 'incremental';
}
