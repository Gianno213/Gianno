import { cpSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const directory = resolve(".next/standalone");
if (!existsSync(resolve(directory, "server.js")))
  throw new Error("Build mancante: esegui npm run build prima dell’avvio.");
// Next standalone ships server code; static/public assets are copied alongside it.
cpSync(".next/static", resolve(directory, ".next/static"), { recursive: true });
if (existsSync("public"))
  cpSync("public", resolve(directory, "public"), { recursive: true });
process.env.HOSTNAME = process.env.GIANNO_BIND_HOST || "0.0.0.0";
await import(pathToFileURL(resolve(directory, "server.js")).href);
