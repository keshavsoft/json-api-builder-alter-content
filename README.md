# json-api-builder-alter-content

[![npm version](https://img.shields.io/npm/v/json-api-builder-alter-content?color=cb3837&style=flat-square)](https://www.npmjs.com/package/json-api-builder-alter-content)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg?style=flat-square)](package.json)
[![GitHub Repository](https://img.shields.io/badge/GitHub-keshavsoft%2Fjson-api-builder-alter-content-181717.svg?style=flat-square&logo=github)](https://github.com/keshavsoft/json-api-builder-alter-content)
[![Documentation](https://img.shields.io/badge/docs-live_portal-amber.svg?style=flat-square)](https://keshavsoft.github.io/json-api-builder-alter-content/)

> **Stage 4 of 8**: Hierarchical Route Hooking & AST Tree Composition via Astring

Part of the modular **[JSON API Builder](https://github.com/keshavsoft/json-api-builder-orchestrator)** ecosystem by [KeshavSoft](https://github.com/keshavsoft).

---

## 1. The Core Story: Why AST Hooking & Why Astring?

### The Complex Problem of Nested Route Mounting
In modern modular frameworks like Hono or Express, sub-routers must be mounted into their parent routers:
- `/api/v1/clinics/routes.js` must be imported and mounted by `/api/v1/routes.js`
- `/api/v1/routes.js` must be imported and mounted by `/api/routes.js`
- `/api/routes.js` must be mounted into the top-level application entrypoint.

When generating APIs dynamically from a specification tree, how do you inject these connections into the parent files?

### Why String Replacement & Regex Fail
Most generators attempt to solve this with regex or string replacement:
```javascript
// A common anti-pattern in generators:
content = content.replace("export default app", "import child from './child/routes.js';\napp.route('/child', child);\nexport default app;");
```
This is inherently fragile:
1. **Whitespace & Formatting Sensitivity**: If indentation or trailing semicolons differ, the regex fails to match.
2. **Order Violation**: Multiple child routes result in scrambled imports placed randomly in the middle of code blocks.
3. **Duplicate Injections**: Re-running the generator easily duplicates imports and routes, crashing Node.js with syntax errors.

### Why We Avoided Babel (`@babel/traverse`)
While Babel provides AST manipulation, it requires `@babel/parser`, `@babel/traverse`, `@babel/types`, and `@babel/generator`—a dependency chain exceeding **50 MB** with dozens of transient packages. For a lightweight, high-speed API generation pipeline, Babel's compilation overhead is unnecessary and bloated.

### The Solution: Lightweight ESTree Node Splicing + Astring
Instead of string manipulation or heavy compilers, **`json-api-builder-alter-content`** creates raw ESTree AST objects in memory and serializes them with **[`astring`](https://github.com/davidbonnet/astring)** (~10 KB, 0 dependencies):

1. **Construct Pure AST Nodes**:
   - `routeImport()` creates a genuine `ImportDeclaration` node:
     ```javascript
     {
       type: "ImportDeclaration",
       specifiers: [{ type: "ImportDefaultSpecifier", local: { type: "Identifier", name: "clinicsRoutes" } }],
       source: { type: "Literal", value: "./clinics/routes.js" }
     }
     ```
   - `routeCall()` creates a genuine `CallExpression` node:
     ```javascript
     app.route("/clinics", clinicsRoutes)
     ```
2. **Deterministic Array Splicing**:
   - New import nodes are safely inserted into the parent's `ast.body` right below existing imports.
   - Mount statements are inserted immediately above `ExportDefaultDeclaration`.
3. **Zero-Defect Code Generation**:
   - `astring.generate(ast)` turns the mutated AST array into clean, perfectly formatted JavaScript code.

---

## 2. Architecture & Pipeline Position

```text
[0. Validate] ──▶ [1. Folders] ──▶ [2. Files] ──▶ [3. Insert Content] ──▶ [4. Hook Routes (Astring)]
                                                                                  │
[8. Finished App] ◀── [7. Verify] ◀── [6. Endpoints] ◀── [5. Create App] ◀────────┘
```

**Stage 4's Single Responsibility**:
Reads `source-of-truth/tree.json`, traverses nested route hierarchies, and mutates parent router ASTs to bind all child routers hierarchically.

---

## 3. The Transformation in Action

### Before Stage 4 (Created by Stage 3):
```javascript
import { Hono } from "hono";

const app = new Hono();

export default app;
```

### After Stage 4 (Hooked by AST Splicing & Emitted by Astring):
```javascript
import { Hono } from "hono";
import v1Routes from "./v1/routes.js";

const app = new Hono();

app.route("/v1", v1Routes);

export default app;
```

---

## 4. Installation & Usage

```bash
npm install json-api-builder-alter-content
```

```javascript
import { hookRoutes } from "json-api-builder-alter-content";

const result = hookRoutes({
    clientRoot: "./my-project",
    outputRoot: "./my-project/output"
});

console.log(`Successfully hooked ${result.hookedFiles} parent routers.`);
```

---

## 5. Verification & Tests

To run the built-in syntax checks and unit tests:
```bash
npm run check
npm test
```
