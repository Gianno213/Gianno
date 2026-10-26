import { describe, it, expect } from "vitest";
import {
  italianToday,
  italianMonth,
  italianYear,
} from "../../src/domain/dates";
describe("calendario italiano", () => {
  it("passa al nuovo anno alla mezzanotte italiana", () => {
    const instant = new Date("2026-12-31T23:30:00Z");
    expect(italianToday(instant)).toBe("2027-01-01");
    expect(italianMonth(instant)).toBe("2027-01");
    expect(italianYear(instant)).toBe(2027);
  });
  it("rispetta l’ora legale nelle note giornaliere", () => {
    expect(italianToday(new Date("2026-07-31T22:30:00Z"))).toBe("2026-08-01");
    expect(italianToday(new Date("2026-01-31T22:30:00Z"))).toBe("2026-01-31");
  });
});
