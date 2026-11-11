# json-api-builder-alter-content

[![npm version](https://img.shields.io/npm/v/json-api-builder-alter-content?color=cb3837&style=flat-square)](https://www.npmjs.com/package/json-api-builder-alter-content)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg?style=flat-square)](package.json)
[![GitHub Repository](https://img.shields.io/badge/GitHub-keshavsoft%2Fjson-api-builder-alter-content-181717.svg?style=flat-square&logo=github)](https://github.com/keshavsoft/json-api-builder-alter-content)
[![Documentation](https://img.shields.io/badge/docs-live_portal-amber.svg?style=flat-square)](https://keshavsoft.github.io/json-api-builder-alter-content/)

> **Stage 4 of 8**: Stage 4: Hierarchical Route Hooking & AST Route Tree Composition

Part of the modular **[JSON API Builder](https://github.com/keshavsoft/json-api-builder-orchestrator)** ecosystem by [KeshavSoft](https://github.com/keshavsoft).

---

## The Story

Traverses tree.json, identifies nested parent-child route boundaries, and automatically injects child route imports and Hono mount registrations into parent router files.

### The Problem It Solves
Manually connecting nested API endpoints in large micro-service architectures is tedious and error-prone. Changing a route name often breaks import graphs.

### The Solution
Inspects the tree structure automatically. For every parent that has sub-routes, it synthesizes the child import (e.g., import v1Routes from './v1/routes.js') and mount call (app.route('/v1', v1Routes)), inserting them into the parent AST.

---

## Architecture & Pipeline Position

```
[1. Folders] ──▶ [2. Files] ──▶ [3. Content] ──▶ [4. Hook Routes]
                                                         │
[8. Orchestrator] ◀── [7. Validate] ◀── [6. Endpoints] ◀── [5. App]
```

**This repository implements Stage 4 in isolation.** It can be used independently in custom build workflows or composed automatically via `json-api-builder`.

---

## Installation

```bash
npm install json-api-builder-alter-content
```

---

## Quick Start

```js
import { hookRoutes } from "json-api-builder-alter-content";

const result = hookRoutes({
    clientRoot: "./my-project",
    outputRoot: "./my-project/output"
});

console.log("Hooked route files count:", result.hookedFiles);
```

---

## Input Specification

Parent directories containing their own routes.js alongside child directories with routes.js.

```json
// Tree relationship:
// api/routes.js -> contains child v1/routes.js
// v1/routes.js  -> contains child clinics/routes.js
```

---

## Output Transformation

Parent router with dynamically wired child imports and Hono route registrations.

```text
import { Hono } from "hono";
import v1Routes from "./v1/routes.js";

const app = new Hono();

app.route("/v1", v1Routes);

export default app;
```

---

## API Reference

### `hookRoutes`

Accepts an options object with the following configuration:

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `clientRoot` | `string` | `process.cwd()` | Root path of the client project. |
| `outputRoot` | `string` | `path.join(clientRoot, 'output')` | Target output directory containing generated routes. |

---

## Sibling Pipeline Packages

| Stage | Package | Description |
| :---: | :--- | :--- |
| **01** | [json-api-builder-create-folders](https://github.com/keshavsoft/json-api-builder-create-folders) | Directory hierarchy scaffolding |
| **02** | [json-api-builder-create-files](https://github.com/keshavsoft/json-api-builder-create-files) | Non-destructive placeholder file creation |
| **03** | [json-api-builder-insert-content](https://github.com/keshavsoft/json-api-builder-insert-content) | ESTree template to JavaScript insertion |
| **04** | [json-api-builder-alter-content](https://github.com/keshavsoft/json-api-builder-alter-content) | Hierarchical route hooking & AST imports |
| **05** | [json-api-builder-create-app](https://github.com/keshavsoft/json-api-builder-create-app) | Root app.js assembly & server runtime |
| **06** | [json-api-builder-create-endpoints](https://github.com/keshavsoft/json-api-builder-create-endpoints) | CRUD endpoints & local JSON file sync |
| **07** | [json-api-builder-validation](https://github.com/keshavsoft/json-api-builder-validation) | Specification linting & artifact checks |
| **08** | [json-api-builder](https://github.com/keshavsoft/json-api-builder-orchestrator) | Master orchestrator coordinating all stages |

---

## Development & Testing

```bash
# Install dependencies
npm install

# Run automated tests
npm test

# Run syntax check
npm run check

# Prepublish verification
npm run prepublishOnly
```

---

## License

[MIT](LICENSE) © 2026 [KeshavSoft](https://github.com/keshavsoft)
