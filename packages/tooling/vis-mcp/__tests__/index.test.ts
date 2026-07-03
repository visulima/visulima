import { describe, expect, it } from "vitest";

import {
    createMcpServer,
    errorResponse,
    execVis,
    execVisJson,
    isValidRunId,
    isValidTaskId,
    okResponse,
    registerAllTools,
    registerCacheHash,
    registerCacheWhy,
    registerDescribeProject,
    registerGetRunLogs,
    registerListProjects,
    registerListTargets,
    startMcpServer,
} from "../src/index";

// `src/index.ts` is the embeddable public API for `@visulima/vis-mcp`. It is
// re-exports only — but if the file is excluded from coverage runs by not
// being imported anywhere, regressions in the surface go unnoticed. This
// spec doubles as a contract test and a coverage anchor.
describe("public surface (src/index.ts)", () => {
    it("should re-export the response builders", () => {
        expect.assertions(2);

        expect(okResponse).toBeTypeOf("function");
        expect(errorResponse).toBeTypeOf("function");
    });

    it("should re-export the exec helpers", () => {
        expect.assertions(2);

        expect(execVis).toBeTypeOf("function");
        expect(execVisJson).toBeTypeOf("function");
    });

    it("should re-export the server factory and registration helpers", () => {
        expect.assertions(3);

        expect(createMcpServer).toBeTypeOf("function");
        expect(registerAllTools).toBeTypeOf("function");
        expect(startMcpServer).toBeTypeOf("function");
    });

    it("should re-export every tool registrar", () => {
        expect.assertions(6);

        expect(registerCacheHash).toBeTypeOf("function");
        expect(registerCacheWhy).toBeTypeOf("function");
        expect(registerDescribeProject).toBeTypeOf("function");
        expect(registerGetRunLogs).toBeTypeOf("function");
        expect(registerListProjects).toBeTypeOf("function");
        expect(registerListTargets).toBeTypeOf("function");
    });

    it("should re-export the validation guards", () => {
        expect.assertions(2);

        expect(isValidRunId).toBeTypeOf("function");
        expect(isValidTaskId).toBeTypeOf("function");
    });
});
