import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import {
  buildAnnualReportSections,
  renderAnnualReport,
  type AnnualReportInput,
} from "../../src/domain/annual-report";
const input: AnnualReportInput = {
  year: 2026,
  employee: {
    first_name: "Elena",
    last_name: "Esempio",
    employee_code: "DEMO1",
    job_title: "Responsabile sala",
    hired_on: "2020-01-01",
  },
  location: "Roma demo",
  evaluations: [
    {
      period: "2026-01-01",
      weighted_score: 2,
      not_evaluable: false,
      comment: "Prima versione",
      revision: 1,
    },
    {
      period: "2026-01-01",
      weighted_score: 4,
      not_evaluable: false,
      comment: "Rettifica motivata",
      revision: 2,
    },
    {
      period: "2026-02-01",
      weighted_score: null,
      not_evaluable: true,
      reason: "Attività insufficiente per una valutazione attendibile.",
      comment: "",
      revision: 1,
    },
  ],
  diary: [],
  goals: [],
  training: [],
  plan: "Formazione prodotti e affiancamento.",
};
describe("Fascicolo annuale", () => {
  it("esclude completamente dati riservati dai fascicoli ordinari", () => {
    const sections = buildAnnualReportSections(input);
    expect(sections.some((s) => s.title.includes("amministrativo"))).toBe(
      false,
    );
    expect(sections.some((s) => s.title.includes("Retribuzione"))).toBe(false);
    expect(JSON.stringify(sections)).not.toContain("malattia");
  });
  it("include dati riservati solo quando esplicitamente forniti dal server autorizzato", () => {
    const sections = buildAnnualReportSections({
      ...input,
      salary: [
        {
          year: 2026,
          month: 1,
          kind: "ordinaria",
          net_amount: 1500,
          status: "verificata",
          ordinary_confirmed: true,
        },
      ],
      administrative: {
        contracts: [],
        absences: [
          {
            kind: "malattia",
            starts_on: "2026-02-01",
            ends_on: "2026-02-02",
            hours: 16,
          },
        ],
      },
    });
    expect(sections.some((s) => s.title === "Retribuzione riservata")).toBe(
      true,
    );
    expect(JSON.stringify(sections)).toContain("malattia");
  });
  it("conta un mese una sola volta dopo una rettifica e separa la non valutabilità", () => {
    const sections = buildAnnualReportSections(input);
    const evaluation = sections.find(
      (s) => s.title === "Valutazioni mensili convalidate",
    )!;
    expect(evaluation.lines[0]).toContain(
      "Mesi effettivamente valutati: 1. Media: 4.00 / 5",
    );
    expect(evaluation.lines.join(" ")).not.toContain("Prima versione");
    expect(evaluation.lines.join(" ")).toContain("Non valutabile");
    expect(sections.at(-1)?.lines).toEqual([
      "Formazione prodotti e affiancamento.",
    ]);
  });
  it("genera un PDF valido multipagina con testi lunghi e caratteri non rappresentabili", async () => {
    const bytes = await renderAnnualReport({
      ...input,
      plan: "Piano 📚 " + "Conoscenza prodotti e formazione. ".repeat(800),
    });
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThan(2);
    expect(pdf.getTitle()).toContain("2026");
    expect(pdf.getAuthor()).toBe("GIANNO PEOPLE");
  });
});
