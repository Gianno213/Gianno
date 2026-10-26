import { italianYear } from "./dates";
export type PayrollKind = "ordinaria" | "tredicesima" | "quattordicesima";
export type SalaryRecord = {
  year: number;
  month: number;
  kind: string;
  net_amount: number | string | null;
  status: string;
  extraordinary_amount?: number | string | null;
  ordinary_confirmed?: boolean;
};
export type SalaryWindow = {
  average: number | null;
  count: number;
  unseparatedCount: number;
};
const cents = (n: number) => Math.round(n * 100);
const money = (n: number) => Math.round(n) / 100;

/** Last N available ordinary months, never zero-fill missing months. Confirmed additional payments remain separate. */
export function salaryStatistics(
  records: SalaryRecord[],
  year = italianYear(),
) {
  const verified = records.filter(
    (r) =>
      r.status === "verificata" &&
      r.net_amount !== null &&
      Number.isFinite(Number(r.net_amount)) &&
      Number(r.net_amount) >= 0 &&
      Number.isInteger(r.year) &&
      Number.isInteger(r.month) &&
      r.month >= 1 &&
      r.month <= 12,
  );
  const ordinary = verified.filter((r) => r.kind === "ordinaria");
  const periodCounts = new Map<string, number>();
  for (const row of ordinary) {
    const key = `${row.year}-${row.month}`;
    periodCounts.set(key, (periodCounts.get(key) ?? 0) + 1);
  }
  const ambiguousMonths = [...periodCounts]
    .filter(([, n]) => n > 1)
    .map(([key]) => key);
  const available = ordinary
    .filter((r) => periodCounts.get(`${r.year}-${r.month}`) === 1)
    .sort((a, b) => b.year - a.year || b.month - a.month);
  function window(n: number): SalaryWindow {
    const rows = available.slice(0, n);
    const total = rows.reduce((sum, r) => {
      const extra =
        r.extraordinary_amount === null || r.extraordinary_amount === undefined
          ? 0
          : Number(r.extraordinary_amount);
      if (!Number.isFinite(extra) || extra < 0 || extra > Number(r.net_amount))
        throw new Error("Importo straordinario non valido.");
      return sum + cents(Number(r.net_amount)) - cents(extra);
    }, 0);
    return {
      average: rows.length ? money(total / rows.length) : null,
      count: rows.length,
      unseparatedCount: rows.filter(
        (r) => r.extraordinary_amount == null && !r.ordinary_confirmed,
      ).length,
    };
  }
  return {
    latest: available[0] ? Number(available[0].net_amount) : null,
    last3: window(3),
    last6: window(6),
    last12: window(12),
    annualTotal: money(
      verified
        .filter((r) => r.year === year)
        .reduce((sum, r) => sum + cents(Number(r.net_amount)), 0),
    ),
    annualAdditional: money(
      verified
        .filter((r) => r.year === year && r.kind !== "ordinaria")
        .reduce((sum, r) => sum + cents(Number(r.net_amount)), 0),
    ),
    ambiguousMonths,
    monthly: available
      .filter((r) => r.year === year)
      .map((r) => ({ month: r.month, net: Number(r.net_amount) }))
      .reverse(),
  };
}

export type PayrollExtraction = {
  netAmount: number | null;
  year: number | null;
  month: number | null;
  kind: PayrollKind;
  employeeCode: string | null;
  employeeName: string | null;
  warnings: string[];
  requiresConfirmation: true;
  extraordinarySeparated: false;
};
const monthNames = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
];
/** Conservative, deterministic extraction from local PDF text. Never infers net pay from gross/taxable totals. */
export function parsePayrollText(text: string): PayrollExtraction {
  const normalized = text.replace(/\u00a0/g, " ").replace(/\r/g, "");
  const warnings: string[] = [];
  const netCandidates = [
    ...normalized.matchAll(
      /\bNETTO\s+A\s+PAGARE\b\s*[:€]?\s*(?:EUR\s*)?((?:\d{1,3}(?:\.\d{3})+|\d+),\d{2})\b/gi,
    ),
  ].map((m) => Number(m[1].replace(/\./g, "").replace(",", ".")));
  const uniqueNets = [...new Set(netCandidates)];
  const netAmount = uniqueNets.length === 1 ? uniqueNets[0] : null;
  if (!uniqueNets.length)
    warnings.push(
      "Netto a pagare non riconosciuto: verificare il PDF originale. Nessun importo lordo o imponibile è stato utilizzato.",
    );
  if (uniqueNets.length > 1)
    warnings.push(
      "Rilevati più netti a pagare: documento ambiguo o multipagina con più dipendenti.",
    );
  const periods: { year: number; month: number }[] = [];
  for (const match of normalized.matchAll(
    /\b(?:COMPETENZA|PERIODO(?:\s+DI\s+PAGA)?|MESE(?:\s+DI\s+PAGA)?)\s*[:\-]?\s*(0?[1-9]|1[0-2])\s*[\/\-]\s*(20\d{2})\b/gi,
  ))
    periods.push({ month: Number(match[1]), year: Number(match[2]) });
  for (const match of normalized.matchAll(
    /\b(?:COMPETENZA|PERIODO(?:\s+DI\s+PAGA)?|MESE(?:\s+DI\s+PAGA)?)\s*[:\-]?\s*(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+(20\d{2})\b/gi,
  ))
    periods.push({
      month: monthNames.indexOf(match[1].toLowerCase()) + 1,
      year: Number(match[2]),
    });
  const uniquePeriods = [
    ...new Map(periods.map((p) => [`${p.year}-${p.month}`, p])).values(),
  ];
  const period = uniquePeriods.length === 1 ? uniquePeriods[0] : null;
  if (!period)
    warnings.push(
      uniquePeriods.length
        ? "Più periodi di competenza: selezionare manualmente quello corretto."
        : "Periodo di competenza non riconosciuto.",
    );
  const thirteenth = /\b(?:tredicesima|13\s*[ªa°]|13esima)\b/i.test(normalized);
  const fourteenth = /\b(?:quattordicesima|14\s*[ªa°]|14esima)\b/i.test(
    normalized,
  );
  if (thirteenth && fourteenth)
    warnings.push(
      "Presenti riferimenti sia alla tredicesima sia alla quattordicesima: verificare la mensilità.",
    );
  if (thirteenth || fourteenth)
    warnings.push(
      "Un riferimento a mensilità aggiuntive può essere un rateo: confermare la tipologia del cedolino.",
    );
  const codes = [
    ...new Set(
      [
        ...normalized.matchAll(
          /\b(?:MATRICOLA|CODICE\s+DIPENDENTE)\s*[:\-]?\s*([A-Z0-9][A-Z0-9_-]{0,29})\b/gi,
        ),
      ].map((m) => m[1]),
    ),
  ];
  const names = [
    ...new Set(
      [
        ...normalized.matchAll(
          /\b(?:DIPENDENTE|COGNOME\s+E\s+NOME)\s*:\s*([^\n\d]{3,80})/gi,
        ),
      ].map((m) => m[1].trim()),
    ),
  ];
  const employeeCode = codes.length === 1 ? codes[0] : null;
  const employeeName = names.length === 1 ? names[0] : null;
  if (!employeeCode && !employeeName)
    warnings.push(
      codes.length > 1 || names.length > 1
        ? "Più dipendenti riconosciuti: non associare automaticamente il documento."
        : "Dipendente non riconosciuto: selezionarlo manualmente.",
    );
  warnings.push(
    "Confermare dipendente, competenza, netto e mensilità prima della registrazione. La separazione degli straordinari non è stata riconosciuta.",
  );
  return {
    netAmount,
    year: period?.year ?? null,
    month: period?.month ?? null,
    kind:
      fourteenth && !thirteenth
        ? "quattordicesima"
        : thirteenth && !fourteenth
          ? "tredicesima"
          : "ordinaria",
    employeeCode,
    employeeName,
    warnings,
    requiresConfirmation: true,
    extraordinarySeparated: false,
  };
}
