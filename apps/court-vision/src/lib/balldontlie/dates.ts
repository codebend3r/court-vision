// Game dates are `YYYY-MM-DD` strings, as Balldontlie writes them, and they
// are US Eastern calendar dates.
const DAY_MS = 24 * 60 * 60 * 1000;

// A wider window belongs to the full season sync (`sync:bdl`), which replaces
// whole seasons; it also keeps the `dates[]` query string a sane length.
export const MAX_NIGHTLY_DATES = 31;

export const isIsoDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  // Reject calendar-invalid dates such as 2026-02-30, which Date rolls over.
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
};

const shiftDays = ({ date, days }: { date: string; days: number }): string =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

// The calendar date it is right now in New York. `en-CA` formats as YYYY-MM-DD.
export const todayInNewYork = ({ now }: { now: Date }): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

// "Last night" for a job that runs in the early hours Eastern: the game date
// before today's in New York, regardless of the machine's own time zone.
export const yesterdayInNewYork = ({ now }: { now: Date }): string =>
  shiftDays({ date: todayInNewYork({ now }), days: -1 });

// Every date from `from` through `to`, inclusive.
export const datesBetween = ({ from, to }: { from: string; to: string }): string[] => {
  const span = Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS,
  );
  if (span < 0) {
    throw new Error(`--from ${from} is after --to ${to}.`);
  }
  return Array.from({ length: span + 1 }, (_, days) => shiftDays({ date: from, days }));
};
