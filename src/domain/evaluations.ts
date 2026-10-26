/** Weights belong to the saved template version; absence and diary data are deliberately not inputs. */
export type EvaluationCriterion = {
  key: string;
  label: string;
  weight: number;
};
export const DEFAULT_CRITERIA: EvaluationCriterion[] = [
  {
    key: "service",
    label: "Qualità del servizio e attenzione al cliente",
    weight: 25,
  },
  {
    key: "procedures",
    label: "Rispetto delle procedure e standard aziendali",
    weight: 25,
  },
  { key: "teamwork", label: "Collaborazione e lavoro di squadra", weight: 20 },
  {
    key: "punctuality",
    label: "Puntualità negli impegni lavorativi documentati",
    weight: 15,
  },
  { key: "initiative", label: "Autonomia e iniziativa", weight: 15 },
];

export function validateCriteria(criteria: EvaluationCriterion[]): void {
  if (
    !criteria.length ||
    new Set(criteria.map((c) => c.key)).size !== criteria.length
  )
    throw new Error("I criteri devono avere chiavi uniche e non essere vuoti.");
  if (
    criteria.some(
      (c) =>
        !c.key.trim() ||
        !c.label.trim() ||
        !Number.isFinite(c.weight) ||
        c.weight <= 0 ||
        c.weight > 100,
    )
  )
    throw new Error("Ogni criterio richiede nome, chiave e peso positivo.");
  if (Math.abs(criteria.reduce((sum, c) => sum + c.weight, 0) - 100) > 0.000001)
    throw new Error("La somma dei pesi deve essere 100%.");
}

export function calculateWeightedScore(
  criteria: EvaluationCriterion[],
  scores: Record<string, number>,
  notEvaluable = false,
  reason = "",
): number | null {
  validateCriteria(criteria);
  if (notEvaluable) {
    if (reason.trim().length < 10)
      throw new Error(
        "Indicare una motivazione professionale per la non valutabilità.",
      );
    if (Object.keys(scores).length)
      throw new Error("Una scheda non valutabile non può contenere punteggi.");
    return null;
  }
  const keys = new Set(criteria.map((c) => c.key));
  if (
    Object.keys(scores).length !== criteria.length ||
    Object.keys(scores).some((k) => !keys.has(k))
  )
    throw new Error(
      "Compilare tutti e soltanto i criteri del modello selezionato.",
    );
  if (
    criteria.some(
      (c) =>
        !Number.isInteger(scores[c.key]) ||
        scores[c.key] < 1 ||
        scores[c.key] > 5,
    )
  )
    throw new Error("Ogni punteggio deve essere un numero intero da 1 a 5.");
  return (
    Math.round(
      criteria.reduce((sum, c) => sum + (scores[c.key] * c.weight) / 100, 0) *
        100,
    ) / 100
  );
}

/** Una rettifica in bozza non sostituisce la versione già convalidata. */
export function latestApprovedEvaluations<T extends Record<string, unknown>>(
  rows: T[],
): T[] {
  const latest = new Map<string, T>();
  for (const row of rows) {
    if (
      row.status !== "convalidata" ||
      typeof row.employee_id !== "string" ||
      typeof row.period !== "string" ||
      !Number.isInteger(Number(row.revision))
    )
      continue;
    const key = `${row.employee_id}:${row.period}`;
    if (
      !latest.has(key) ||
      Number(row.revision) > Number(latest.get(key)!.revision)
    )
      latest.set(key, row);
  }
  return [...latest.values()];
}
