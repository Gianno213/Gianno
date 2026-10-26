import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { salaryStatistics, type SalaryRecord } from "./payroll";

type Evaluation = {
  period: string;
  weighted_score: number | string | null;
  not_evaluable: boolean;
  reason?: string | null;
  comment: string;
  scores?: Record<string, number>;
  criteria?: { key: string; label: string; weight: number }[];
  revision?: number;
};
type Diary = {
  event_on: string;
  category: string;
  description: string;
  action_taken?: string | null;
  verification_status: string;
  diary_comments?: {
    body: string;
    kind: string;
    created_at: string;
    author_id: string;
  }[];
};
type Goal = {
  description: string;
  status: string;
  due_on?: string | null;
  outcome?: string | null;
};
type Training = {
  title: string;
  completed_on: string | null;
  hours: number | string | null;
};
export type AnnualReportInput = {
  year: number;
  employee: {
    first_name: string;
    last_name: string;
    employee_code: string;
    job_title: string;
    hired_on: string;
  };
  location: string;
  evaluations: Evaluation[];
  diary: Diary[];
  goals: Goal[];
  training: Training[];
  plan: string | null;
  administrative?: {
    contracts: {
      contract_type: string;
      ccnl_level: string | null;
      weekly_hours: number | string;
      starts_on: string;
      ends_on: string | null;
    }[];
    absences: {
      kind: string;
      starts_on: string;
      ends_on: string;
      hours: number | string;
    }[];
  };
  salary?: SalaryRecord[];
};
export type ReportSection = { title: string; lines: string[] };
const date = (value: string) =>
  new Date(`${value.slice(0, 10)}T12:00:00Z`).toLocaleDateString("it-IT", {
    timeZone: "Europe/Rome",
  });
const euro = (value: number | null) =>
  value === null
    ? "Non disponibile"
    : new Intl.NumberFormat("it-IT", {
        style: "currency",
        currency: "EUR",
      }).format(value);
const label = (value: string) => value.replaceAll("_", " ");

/** Confidential fields are absent by construction unless the server explicitly includes their sections. */
export function buildAnnualReportSections(
  input: AnnualReportInput,
): ReportSection[] {
  const latest = new Map<string, Evaluation>();
  for (const evaluation of input.evaluations) {
    const previous = latest.get(evaluation.period);
    if (!previous || (evaluation.revision ?? 1) > (previous.revision ?? 1))
      latest.set(evaluation.period, evaluation);
  }
  const evaluations = [...latest.values()].sort((a, b) =>
    a.period.localeCompare(b.period),
  );
  const evaluated = evaluations.filter(
    (e) => !e.not_evaluable && e.weighted_score !== null,
  );
  const average = evaluated.length
    ? evaluated.reduce((sum, e) => sum + Number(e.weighted_score), 0) /
      evaluated.length
    : null;
  const sections: ReportSection[] = [
    {
      title: "Anagrafica professionale",
      lines: [
        `${input.employee.first_name} ${input.employee.last_name} · ${input.employee.employee_code}`,
        `Mansione: ${input.employee.job_title}`,
        `Punto vendita: ${input.location}`,
        `Assunzione: ${date(input.employee.hired_on)}`,
      ],
    },
    {
      title: "Valutazioni mensili convalidate",
      lines: [
        `Mesi effettivamente valutati: ${evaluated.length}. Media: ${average === null ? "Non disponibile" : average.toFixed(2) + " / 5"}.`,
        ...evaluations.map(
          (e) =>
            `${date(e.period).slice(3)} · ${e.not_evaluable ? "Non valutabile: " + (e.reason ?? "") : Number(e.weighted_score).toFixed(2) + " / 5"} · Revisione ${e.revision ?? 1}\n${e.comment}`,
        ),
      ],
    },
  ];
  const parameterMap = new Map<string, { label: string; values: number[] }>();
  for (const evaluation of evaluated)
    for (const criterion of evaluation.criteria ?? []) {
      const score = evaluation.scores?.[criterion.key];
      if (typeof score !== "number") continue;
      // Template labels can evolve; distinct labels stay separate instead of comparing unlike criteria.
      const key = `${criterion.key}:${criterion.label}`;
      const group = parameterMap.get(key) ?? {
        label: criterion.label,
        values: [],
      };
      group.values.push(score);
      parameterMap.set(key, group);
    }
  sections.push({
    title: "Analisi dei parametri",
    lines: [...parameterMap.values()].map(
      (g) =>
        `${g.label}: ${(g.values.reduce((a, b) => a + b, 0) / g.values.length).toFixed(2)} / 5 su ${g.values.length} mesi.`,
    ),
  });
  sections.push({
    title: "Diario lavorativo",
    lines: input.diary.map(
      (d) =>
        `${date(d.event_on)} · ${label(d.category)} · ${label(d.verification_status)}\n${d.description}${d.action_taken ? "\nAzione intrapresa: " + d.action_taken : ""}${(d.diary_comments ?? []).map((c) => "\n" + label(c.kind) + " (" + date(c.created_at) + ", autore " + c.author_id + "): " + c.body).join("")}`,
    ),
  });
  sections.push({
    title: "Obiettivi e sviluppo professionale",
    lines: input.goals.map(
      (g) =>
        `${g.description} · ${label(g.status)}${g.due_on ? " · Verifica " + date(g.due_on) : ""}${g.outcome ? "\nEsito: " + g.outcome : ""}`,
    ),
  });
  sections.push({
    title: "Formazione",
    lines: input.training.map(
      (t) =>
        `${t.title} · ${t.completed_on ? date(t.completed_on) : "Da completare"}${t.hours !== null ? " · " + t.hours + " ore" : ""}`,
    ),
  });
  if (input.administrative)
    sections.push({
      title: "Riepilogo amministrativo riservato",
      lines: [
        ...input.administrative.contracts.map(
          (c) =>
            `${c.contract_type} · Livello ${c.ccnl_level ?? "non indicato"} · ${c.weekly_hours} ore settimanali · ${date(c.starts_on)} / ${c.ends_on ? date(c.ends_on) : "tempo indeterminato"}`,
        ),
        ...input.administrative.absences.map(
          (a) =>
            `${label(a.kind)} · ${date(a.starts_on)} / ${date(a.ends_on)} · ${a.hours} ore (intera registrazione)`,
        ),
      ],
    });
  if (input.salary) {
    const stats = salaryStatistics(input.salary, input.year);
    sections.push({
      title: "Retribuzione riservata",
      lines: [
        `Ultimo netto ordinario disponibile alla fine dell'anno: ${euro(stats.latest)}.`,
        ...([3, 6, 12] as const).map((n) => {
          const w = stats[`last${n}`];
          return `Media ultimi ${n} mesi ordinari disponibili: ${euro(w.average)} · ${w.count} mesi effettivi${w.unseparatedCount ? " · ATTENZIONE: straordinari non separati in " + w.unseparatedCount + " mesi" : ""}.`;
        }),
        `Totale netto verificato nell'anno, mensilità aggiuntive incluse: ${euro(stats.annualTotal)}.`,
        `Mensilità aggiuntive: ${euro(stats.annualAdditional)}.`,
        ...stats.monthly.map(
          (m) => `Mese ${String(m.month).padStart(2, "0")}: ${euro(m.net)}`,
        ),
      ],
    });
  }
  sections.push({
    title: "Osservazioni e piano di miglioramento per l'anno successivo",
    lines: [input.plan || "Non ancora compilato dalla Direzione."],
  });
  return sections;
}

export async function renderAnnualReport(
  input: AnnualReportInput,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`GIANNO PEOPLE - Fascicolo ${input.year}`);
  pdf.setAuthor("GIANNO PEOPLE");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.16, 0.17, 0.15),
    muted = rgb(0.42, 0.43, 0.39),
    terra = rgb(0.63, 0.32, 0.23);
  let page = pdf.addPage([595.28, 841.89]);
  let y = 778;
  let pageIndex = 1;
  function safe(s: string) {
    return [...s]
      .map((char) => {
        try {
          regular.encodeText(char);
          return char;
        } catch {
          return "?";
        }
      })
      .join("");
  }
  function footer() {
    page.drawText(
      `Riservato · GIANNO PEOPLE · ${input.year} · Pagina ${pageIndex}`,
      { x: 48, y: 30, size: 8, font: regular, color: muted },
    );
  }
  function newPage() {
    footer();
    page = pdf.addPage([595.28, 841.89]);
    y = 778;
    pageIndex++;
  }
  function text(value: string, size = 10, strong = false) {
    const font = strong ? bold : regular;
    const max = 499;
    for (const paragraph of value.split("\n")) {
      const words = safe(paragraph).split(/\s+/);
      let line = "";
      for (const word of words) {
        if (
          font.widthOfTextAtSize(line + (line ? " " : "") + word, size) > max &&
          line
        ) {
          if (y < 65) newPage();
          page.drawText(line, { x: 48, y, size, font, color: ink });
          y -= size + 5;
          line = "";
        }
        if (font.widthOfTextAtSize(word, size) > max) {
          for (const character of word) {
            if (font.widthOfTextAtSize(line + character, size) > max) {
              if (y < 65) newPage();
              page.drawText(line, { x: 48, y, size, font, color: ink });
              y -= size + 5;
              line = "";
            }
            line += character;
          }
        } else line += (line ? " " : "") + word;
      }
      if (y < 65) newPage();
      page.drawText(line, { x: 48, y, size, font, color: ink });
      y -= size + 5;
    }
  }
  page.drawText("GIANNO PEOPLE", {
    x: 48,
    y,
    size: 23,
    font: bold,
    color: terra,
  });
  y -= 30;
  text(`Fascicolo annuale ${input.year}`, 14, true);
  y -= 10;
  text(
    "Supporto al colloquio e allo sviluppo professionale. Nessuna decisione automatica sul rapporto di lavoro.",
    9,
  );
  y -= 16;
  if (
    input.evaluations.some((e) => e.weighted_score !== null && !e.not_evaluable)
  ) {
    text("Andamento delle valutazioni convalidate", 11, true);
    y -= 12;
    const chartBottom = y - 86,
      chartLeft = 60,
      width = 466;
    page.drawLine({
      start: { x: chartLeft, y: chartBottom },
      end: { x: chartLeft + width, y: chartBottom },
      thickness: 0.5,
      color: muted,
    });
    for (let tick = 1; tick <= 5; tick++) {
      const yy = chartBottom + (tick - 1) * 19;
      page.drawText(String(tick), {
        x: 45,
        y: yy - 3,
        size: 7,
        font: regular,
        color: muted,
      });
      page.drawLine({
        start: { x: chartLeft, y: yy },
        end: { x: chartLeft + width, y: yy },
        thickness: 0.25,
        color: rgb(0.87, 0.87, 0.83),
      });
    }
    const byMonth = new Map<number, Evaluation>();
    for (const e of input.evaluations) {
      const month = Number(e.period.slice(5, 7));
      const old = byMonth.get(month);
      if (!old || (e.revision ?? 1) > (old.revision ?? 1))
        byMonth.set(month, e);
    }
    for (let month = 1; month <= 12; month++) {
      const x = chartLeft + ((month - 1) * width) / 11;
      page.drawText(String(month), {
        x: x - 2,
        y: chartBottom - 13,
        size: 7,
        font: regular,
        color: muted,
      });
      const e = byMonth.get(month);
      if (e && !e.not_evaluable && e.weighted_score !== null)
        page.drawCircle({
          x,
          y: chartBottom + (Number(e.weighted_score) - 1) * 19,
          size: 3,
          color: terra,
        });
    }
    y = chartBottom - 36;
  }
  for (const section of buildAnnualReportSections(input)) {
    if (y < 120) newPage();
    text(section.title, 12, true);
    y -= 5;
    for (const line of section.lines.length
      ? section.lines
      : ["Nessun dato disponibile nel periodo."]) {
      text(line);
      y -= 6;
    }
    y -= 12;
  }
  footer();
  return pdf.save();
}
