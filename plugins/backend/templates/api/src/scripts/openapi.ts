// npm run openapi: write the API contract to openapi.json without starting the server.
// The frontend generates its typed client from this file (see README "Frontend").
import { writeFileSync } from "node:fs";

process.env.DATABASE_URL ??= "file:./data/app.db"; // routes import the db client; nothing is queried
const { app, openApiInfo } = await import("../app.ts");
const doc = app.getOpenAPI31Document(openApiInfo);
writeFileSync("openapi.json", JSON.stringify(doc, null, 2) + "\n");
console.log(`Wrote openapi.json (${Object.keys(doc.paths ?? {}).length} paths)`);
process.exit(0);
