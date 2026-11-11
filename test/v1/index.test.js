import test from "node:test";
import assert from "node:assert/strict";
import * as stage from "../../src/v1/index.js";

test("exports the stage API", () => {
    for (const name of ["hookRoutes"]) assert.equal(typeof stage[name], "function", `${name} must be exported`);
});
