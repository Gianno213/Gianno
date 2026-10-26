import { describe, expect, it } from "vitest";
import {
  calculateWeightedScore,
  DEFAULT_CRITERIA,
  validateCriteria,
} from "../../src/domain/evaluations";
const scores = {
  service: 5,
  procedures: 4,
  teamwork: 3,
  punctuality: 2,
  initiative: 1,
};
describe("Valutazioni mensili", () => {
  it("calcola la media ponderata sui pesi della versione scelta", () => {
    expect(calculateWeightedScore(DEFAULT_CRITERIA, scores)).toBe(3.3);
    expect(
      calculateWeightedScore([{ key: "a", label: "A", weight: 100 }], { a: 4 }),
    ).toBe(4);
  });
  it("rifiuta pesi incoerenti, chiavi duplicate e punteggi fuori scala", () => {
    expect(() =>
      validateCriteria([{ key: "a", label: "A", weight: 99 }]),
    ).toThrow();
    expect(() =>
      validateCriteria([
        { key: "a", label: "A", weight: 50 },
        { key: "a", label: "A", weight: 50 },
      ]),
    ).toThrow();
    expect(() =>
      calculateWeightedScore(DEFAULT_CRITERIA, { ...scores, service: 0 }),
    ).toThrow();
    expect(() =>
      calculateWeightedScore(DEFAULT_CRITERIA, { ...scores, service: 2.5 }),
    ).toThrow();
    expect(() =>
      calculateWeightedScore(DEFAULT_CRITERIA, { ...scores, other: 3 }),
    ).toThrow();
  });
  it("non attribuisce zero alla non valutabilità e richiede motivazione", () => {
    expect(
      calculateWeightedScore(
        DEFAULT_CRITERIA,
        {},
        true,
        "Attività insufficiente nel periodo.",
      ),
    ).toBeNull();
    expect(() =>
      calculateWeightedScore(DEFAULT_CRITERIA, {}, true, ""),
    ).toThrow();
    expect(() =>
      calculateWeightedScore(
        DEFAULT_CRITERIA,
        scores,
        true,
        "Attività insufficiente.",
      ),
    ).toThrow();
  });
  it("non usa assenze tutelate o note per alterare il voto", () => {
    const employee = {
      scores,
      absences: [{ kind: "maternita", hours: 160 }],
      diary: ["Criticità"],
    };
    expect(calculateWeightedScore(DEFAULT_CRITERIA, employee.scores)).toBe(
      calculateWeightedScore(DEFAULT_CRITERIA, scores),
    );
  });
});

describe("Integrità dei criteri versionati", () => {
  it("rifiuta pesi negativi, infiniti, chiavi e descrizioni vuote", () => {
    expect(() =>
      validateCriteria([
        { key: "a", label: "A", weight: -1 },
        { key: "b", label: "B", weight: 101 },
      ]),
    ).toThrow();
    expect(() =>
      validateCriteria([{ key: "a", label: "A", weight: Infinity }]),
    ).toThrow();
    expect(() =>
      validateCriteria([{ key: "", label: "A", weight: 100 }]),
    ).toThrow();
    expect(() =>
      validateCriteria([{ key: "a", label: "", weight: 100 }]),
    ).toThrow();
    expect(() => validateCriteria([])).toThrow();
  });
  it("non muta il modello e i voti originali nel calcolo", () => {
    const before = JSON.stringify(DEFAULT_CRITERIA);
    const original = { ...scores };
    calculateWeightedScore(DEFAULT_CRITERIA, scores);
    expect(JSON.stringify(DEFAULT_CRITERIA)).toBe(before);
    expect(scores).toEqual(original);
  });
});

describe("revisioni efficaci", () => {
  it("mantiene la versione valida durante la rettifica e sostituisce solo alla nuova convalida", async () => {
    const { latestApprovedEvaluations } =
      await import("../../src/domain/evaluations");
    const original = {
      employee_id: "a",
      period: "2026-01-01",
      revision: 1,
      status: "convalidata",
    };
    const draft = { ...original, revision: 2, status: "bozza" };
    expect(latestApprovedEvaluations([original, draft])).toEqual([original]);
    expect(
      latestApprovedEvaluations([
        original,
        { ...draft, status: "convalidata" },
      ]),
    ).toEqual([{ ...draft, status: "convalidata" }]);
    expect(
      latestApprovedEvaluations([{ ...original, status: "inviata" }]),
    ).toEqual([]);
  });
});
