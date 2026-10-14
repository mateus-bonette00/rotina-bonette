export type RoutineSlot = { startTime: string; durationMinutes: number };

export type RoutineSeries = {
  daysOfWeek: number[];
  startTime: string | null;
  durationMinutes: number;
  intervalWeeks: number;
  anchorDate: string | null;
  // Horário próprio por dia da semana (chave "0".."6"); sem entrada vale startTime/durationMinutes.
  dayTimes: Record<string, RoutineSlot>;
};

export type RoutinePause = { startDate: string; endDate: string };

export type RoutineOccurrence = RoutineSlot & { date: string; paused: boolean };

const DAY_MS = 86_400_000;
const utc = (date: string) => Date.parse(`${date}T00:00:00Z`);
// Semanas começam na segunda; só importa para contar o intervalo a partir da âncora.
const weekStart = (ms: number) => ms - ((new Date(ms).getUTCDay() + 6) % 7) * DAY_MS;

/** Expande a série em ocorrências datadas entre `from` e `to` (YYYY-MM-DD, inclusivo). Pausadas voltam com paused=true. */
export function expandRoutine(
  series: RoutineSeries,
  pauses: RoutinePause[],
  from: string,
  to: string,
): RoutineOccurrence[] {
  const interval = Math.max(1, series.intervalWeeks);
  const anchorWeek = series.anchorDate ? weekStart(utc(series.anchorDate)) : null;
  const out: RoutineOccurrence[] = [];
  for (let ms = utc(from); ms <= utc(to); ms += DAY_MS) {
    const dow = new Date(ms).getUTCDay();
    if (!series.daysOfWeek.includes(dow)) continue;
    if (interval > 1 && anchorWeek !== null) {
      const weeks = Math.round((weekStart(ms) - anchorWeek) / (7 * DAY_MS));
      if (((weeks % interval) + interval) % interval !== 0) continue;
    }
    const slot = series.dayTimes[String(dow)] ?? (series.startTime ? { startTime: series.startTime, durationMinutes: series.durationMinutes } : null);
    if (!slot) continue;
    const date = new Date(ms).toISOString().slice(0, 10);
    out.push({ ...slot, date, paused: pauses.some((pause) => pause.startDate <= date && date <= pause.endDate) });
  }
  return out;
}
