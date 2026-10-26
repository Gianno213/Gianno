/** Fetch a stable ordered query until exhaustion, including when the server caps pages below 1,000.
 * Pass a factory (not a reused mutable PostgREST builder) and order by a unique key.
 * Optional maxRows deliberately bounds the result; callers can request limit + 1 to detect oversize exports.
 * Errors abort the export rather than returning an apparently complete partial result.
 */
export async function fetchAll<T>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  maxRows = Infinity,
): Promise<T[]> {
  if (maxRows !== Infinity && (!Number.isSafeInteger(maxRows) || maxRows < 0))
    throw new Error("Limite righe non valido.");
  const rows: T[] = [];
  const pageSize = 1000;
  let offset = 0;
  while (offset < maxRows) {
    const result = await page(
      offset,
      Math.min(offset + pageSize - 1, maxRows - 1),
    );
    if (result.error) throw new Error(result.error.message);
    if (!result.data) throw new Error("Risposta dati incompleta.");
    if (!result.data.length) return rows;
    rows.push(...result.data.slice(0, maxRows - offset));
    // Advance by the actual length; project-level row caps may be smaller than the requested page.
    offset += result.data.length;
  }
  return rows;
}
