/** Calendario operativo italiano, indipendente dal fuso orario dell'hosting. */
export function italianToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export const italianMonth = (now = new Date()) => italianToday(now).slice(0, 7);
export const italianYear = (now = new Date()) =>
  Number(italianToday(now).slice(0, 4));
