import { describe, expect, it } from "vitest";
import {
  parsePayrollText,
  salaryStatistics,
  type SalaryRecord,
} from "../../src/domain/payroll";
const row = (
  month: number,
  net: number,
  more: Partial<SalaryRecord> = {},
): SalaryRecord => ({
  year: 2026,
  month,
  kind: "ordinaria",
  net_amount: net,
  status: "verificata",
  extraordinary_amount: 0,
  ...more,
});
describe("Retribuzioni verificate", () => {
  it("usa i mesi disponibili, esclude bozze e mensilità aggiuntive, mostra il denominatore", () => {
    const result = salaryStatistics(
      [
        row(1, 1000),
        row(4, 2000),
        row(7, 3000),
        row(12, 4000),
        row(12, 2000, { kind: "tredicesima" }),
        row(9, 8000, { status: "bozza" }),
      ],
      2026,
    );
    expect(result.last3).toEqual({
      average: 3000,
      count: 3,
      unseparatedCount: 0,
    });
    expect(result.last6.count).toBe(4);
    expect(result.last6.average).toBe(2500);
    expect(result.annualTotal).toBe(12000);
    expect(result.annualAdditional).toBe(2000);
  });
  it("distingue gli straordinari noti e segnala quelli non separabili", () => {
    const result = salaryStatistics([
      row(1, 1400, { extraordinary_amount: 200 }),
      row(3, 1600, { extraordinary_amount: null }),
    ]);
    expect(result.last3.average).toBe(1400);
    expect(result.last3.unseparatedCount).toBe(1);
    expect(() =>
      salaryStatistics([row(1, 100, { extraordinary_amount: 200 })]),
    ).toThrow();
  });
  it("non trasforma una storia vuota in una media pari a zero", () => {
    expect(salaryStatistics([]).last12).toEqual({
      average: null,
      count: 0,
      unseparatedCount: 0,
    });
  });
  it("esclude dalle medie periodi ordinari duplicati anziché contare due mesi", () => {
    const result = salaryStatistics([row(1, 1000), row(1, 1200), row(2, 1500)]);
    expect(result.last3.count).toBe(1);
    expect(result.ambiguousMonths).toEqual(["2026-1"]);
  });
});
describe("Estrazione locale prudente", () => {
  it("estrae soltanto il netto a pagare e la competenza esplicita", () => {
    const result = parsePayrollText(
      "Dipendente: MARIO DEMO\nMATRICOLA: G001\nCOMPETENZA: ottobre 2026\nLORDO 2.300,00\nIMPONIBILE 2.100,00\nNETTO A PAGARE 1.654,32",
    );
    expect(result.netAmount).toBe(1654.32);
    expect(result.month).toBe(10);
    expect(result.year).toBe(2026);
    expect(result.employeeCode).toBe("G001");
    expect(result.requiresConfirmation).toBe(true);
  });
  it("non scambia lordo o imponibile per netto né data stampa per competenza", () => {
    const result = parsePayrollText(
      "Stampato il 12/2026 LORDO 2.300,00 IMPONIBILE 2.100,00",
    );
    expect(result.netAmount).toBeNull();
    expect(result.year).toBeNull();
  });
  it("segnala due netti differenti e non sceglie arbitrariamente", () => {
    expect(
      parsePayrollText("NETTO A PAGARE 1.000,00\nNETTO A PAGARE 2.000,00")
        .netAmount,
    ).toBeNull();
  });
  it("riconosce la mensilità aggiuntiva chiedendo conferma per possibili ratei", () => {
    const result = parsePayrollText(
      "COMPETENZA 12/2026\nTREDICESIMA\nNETTO A PAGARE 1.250,00",
    );
    expect(result.kind).toBe("tredicesima");
    expect(result.warnings.some((s) => s.includes("rateo"))).toBe(true);
  });
});

describe("Confini e ambiguità", () => {
  it("mantiene separati anni, disponibilità e totale annuale", () => {
    const result = salaryStatistics(
      [
        row(12, 1000, { year: 2025 }),
        row(2, 2000),
        row(8, 500, { kind: "quattordicesima" }),
      ],
      2026,
    );
    expect(result.last3.average).toBe(1500);
    expect(result.last3.count).toBe(2);
    expect(result.annualTotal).toBe(2500);
    expect(result.monthly).toEqual([{ month: 2, net: 2000 }]);
    expect(result.latest).toBe(2000);
  });
  it("esclude periodi e importi non validi e importi nulli", () => {
    const result = salaryStatistics([
      row(0, 1000),
      row(13, 1000),
      row(1, -100),
      row(2, 1000, { net_amount: null }),
      row(3, 1000, { net_amount: "non valido" }),
      row(4, 1200),
    ]);
    expect(result.last12.count).toBe(1);
    expect(result.last12.average).toBe(1200);
  });
  it("segnala competenze contraddittorie e non sceglie la prima", () => {
    const result = parsePayrollText(
      "COMPETENZA 01/2026\nPERIODO 02/2026\nNETTO A PAGARE 1.000,00",
    );
    expect(result.month).toBeNull();
    expect(result.year).toBeNull();
    expect(result.warnings.some((s) => s.includes("Più periodi"))).toBe(true);
  });
  it("ammette lo stesso netto ripetuto sullo stesso cedolino", () => {
    expect(
      parsePayrollText("NETTO A PAGARE 1.234,50\nNETTO A PAGARE 1.234,50")
        .netAmount,
    ).toBe(1234.5);
  });
  it("richiede una selezione esplicita quando il dipendente non è riconosciuto", () => {
    const result = parsePayrollText("NETTO A PAGARE 1.234,50");
    expect(result.employeeCode).toBeNull();
    expect(result.employeeName).toBeNull();
    expect(
      result.warnings.some((s) => s.includes("Dipendente non riconosciuto")),
    ).toBe(true);
  });
  it("non associa un cedolino con più matricole al primo dipendente", () => {
    const result = parsePayrollText(
      "MATRICOLA A100\nMATRICOLA B200\nNETTO A PAGARE 1.000,00",
    );
    expect(result.employeeCode).toBeNull();
    expect(result.warnings.some((s) => s.includes("Più dipendenti"))).toBe(
      true,
    );
  });
  it("non interpreta una competenza con mese 13 come un periodo ordinario", () => {
    const result = parsePayrollText(
      "COMPETENZA 13/2026\nNETTO A PAGARE 1.000,00",
    );
    expect(result.month).toBeNull();
  });
});
