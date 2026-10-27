import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { validateHeaderValue } from "node:http";
import ts from "typescript";
import { it, expect } from "vitest";
function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? files(join(directory, e.name))
      : /\.(ts|tsx)$/.test(e.name)
        ? [join(directory, e.name)]
        : [],
  );
}
function literal(node: ts.Expression): string | undefined {
  if (ts.isStringLiteralLike(node)) return node.text;
  if (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind === ts.SyntaxKind.PlusToken
  ) {
    const left = literal(node.left),
      right = literal(node.right);
    return left !== undefined && right !== undefined ? left + right : undefined;
  }
  if (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === "encodeURIComponent" &&
    node.arguments.length === 1
  ) {
    const value = literal(node.arguments[0]);
    return value === undefined ? undefined : encodeURIComponent(value);
  }
  return undefined;
}
it("tutti i redirect statici del sorgente sono codificati per gli header HTTP", () => {
  let checked = 0;
  for (const file of files("src")) {
    const source = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        ((ts.isIdentifier(node.expression) &&
          node.expression.text === "redirect") ||
          (ts.isPropertyAccessExpression(node.expression) &&
            node.expression.name.text === "redirect")) &&
        node.arguments[0]
      ) {
        const url = literal(node.arguments[0]);
        if (url !== undefined) {
          checked++;
          const where = `${file}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`;
          expect(url, where).toMatch(/^[\x21-\x7e]+$/);
          expect(
            () => validateHeaderValue("x-action-redirect", url + ";push"),
            where,
          ).not.toThrow();
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  expect(checked).toBeGreaterThan(15);
});
