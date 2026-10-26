import { z } from "zod";
/** A required numeric field must be explicitly supplied. Blank is never zero. */
export function requiredNumber(value: unknown, maximum: number) {
  return z
    .string()
    .trim()
    .min(1, "Valore numerico obbligatorio")
    .pipe(z.coerce.number<string>().min(0).max(maximum))
    .parse(value);
}
