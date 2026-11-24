import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generate } from "astring";
import * as v2 from "../../src/v2/index.js";

const clientRoot = path.dirname(fileURLToPath(import.meta.url));
const outputRoot = path.join(clientRoot, "output");

test("V2 exports the stage API", () => {
    assert.equal(typeof v2.hookRoutes, "function", "hookRoutes must be exported from v2");
});

test("V2 hookRoutes hooks child routes into parent routes.js using pure AST snippets via astring", () => {
    fs.rmSync(outputRoot, { recursive: true, force: true });

    // Step 1: Pre-populate parent routes.js (as if insert-content ran)
    const apiDir = path.join(outputRoot, "api");
    const v1Dir = path.join(apiDir, "v1");
    fs.mkdirSync(v1Dir, { recursive: true });

    const templateAst = JSON.parse(fs.readFileSync(
        path.join(clientRoot, "input", "source-of-truth", "templates", "routes.estree.json"),
        "utf8"
    ));
    const baseCode = generate(templateAst);

    fs.writeFileSync(path.join(apiDir, "routes.js"), baseCode, "utf8");
    fs.writeFileSync(path.join(v1Dir, "routes.js"), baseCode, "utf8");

    // Step 2: Run V2 hookRoutes
    const result = v2.hookRoutes({ clientRoot, outputRoot });
    assert.equal(result.outputRoot, outputRoot);
    assert.ok(result.hookedFiles >= 1, "Expected at least 1 hooked parent route file");

    // Step 3: Verify parent api/routes.js was hooked with child v1 routes
    const apiRoutesPath = path.join(apiDir, "routes.js");
    const hookedCode = fs.readFileSync(apiRoutesPath, "utf8");

    assert.match(hookedCode, /import\s+v1Routes\s+from\s+"\.\/v1\/routes\.js";/);
    assert.match(hookedCode, /app\.route\("\/v1",\s*v1Routes\);/);
    assert.match(hookedCode, /export default app;/);

    console.log("--> Output established at:", apiRoutesPath);
});
