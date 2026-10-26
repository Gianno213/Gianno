import { describe, expect, it, vi } from "vitest";
import { fetchAll } from "../../src/lib/data/fetch-all";
describe("Paginazione completa delle esportazioni", () => {
  it("recupera oltre 1000 righe senza perdere record al confine pagina", async () => {
    const source = Array.from({ length: 2507 }, (_, id) => ({ id }));
    const query = vi.fn(async (from: number, to: number) => ({
      data: source.slice(from, to + 1),
      error: null,
    }));
    expect(await fetchAll(query)).toEqual(source);
    expect(query.mock.calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
      [2507, 3506],
    ]);
  });
  it("rispetta cap server inferiori alla dimensione richiesta senza troncare", async () => {
    const source = Array.from({ length: 1234 }, (_, id) => ({ id }));
    const query = vi.fn(async (from: number) => ({
      data: source.slice(from, from + 300),
      error: null,
    }));
    const result = await fetchAll(query);
    expect(result).toEqual(source);
    expect(result.at(-1)?.id).toBe(1233);
  });
  it("interrompe un report se una pagina successiva fallisce", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ data: [{ id: 1 }], error: null })
      .mockResolvedValueOnce({
        data: null,
        error: { message: "access denied" },
      });
    await expect(fetchAll(query)).rejects.toThrow("access denied");
  });
  it("non converte una risposta senza dati in un successo vuoto", async () => {
    await expect(
      fetchAll(async () => ({ data: null, error: null })),
    ).rejects.toThrow("Risposta dati incompleta");
    expect(await fetchAll(async () => ({ data: [], error: null }))).toEqual([]);
  });
});
