export const parseMinutes = (value: number | string): number => {
  if (typeof value === "number") {
    return value;
  }
  if (value.includes(":")) {
    const [minutes, seconds] = value.split(":");
    const parsedMinutes = Number.parseFloat(minutes);
    const parsedSeconds = Number.parseFloat(seconds);
    if (Number.isNaN(parsedMinutes) || Number.isNaN(parsedSeconds)) {
      return 0;
    }
    return parsedMinutes + parsedSeconds / 60;
  }
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const parseGameDate = (value: string): Date => {
  if (!value.includes("T")) {
    return new Date(`${value}T00:00:00Z`);
  }
  // Treat as UTC if no timezone designator is present.
  const hasTimezone = value.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(value);
  return hasTimezone ? new Date(value) : new Date(`${value}Z`);
};
