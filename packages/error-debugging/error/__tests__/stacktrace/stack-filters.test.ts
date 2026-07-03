import { describe, expect, it } from "vitest";

import parseStacktrace, { composeFilters, stackFilters } from "../../src/stacktrace/parse-stacktrace";

const makeError = (stack: string): Error => {
    const error = new Error("boom");

    error.stack = stack;

    return error;
};

describe("stack filters presets", () => {
    it("should tag Node internal frames with type 'internal'", () => {
        expect.assertions(2);

        const error = makeError(
            ["Error: boom", "    at Object.<anonymous> (/app/index.js:10:5)", "    at Module._compile (node:internal/modules/cjs/loader:1234:14)"].join("\n"),
        );

        const frames = parseStacktrace(error);
        const internalFrame = frames.find((frame) => frame.raw.includes("node:internal"));

        expect(internalFrame).toBeDefined();
        expect(internalFrame?.type).toBe("internal");
    });

    it("internals preset should drop node internal frames", () => {
        expect.assertions(2);

        const error = makeError(
            [
                "Error: boom",
                "    at Object.<anonymous> (/app/index.js:10:5)",
                "    at Module._compile (node:internal/modules/cjs/loader:1234:14)",
                "    at run (internal/main/run_main_module.js:17:11)",
            ].join("\n"),
        );

        const frames = parseStacktrace(error, { filter: stackFilters.internals });

        expect(frames).toHaveLength(1);
        expect(frames[0]?.file).toContain("/app/index.js");
    });

    it("nodeModules preset should drop node_modules frames", () => {
        expect.assertions(2);

        const error = makeError(
            ["Error: boom", "    at Object.<anonymous> (/app/index.js:10:5)", "    at handler (/app/node_modules/some-dep/dist/index.js:42:3)"].join("\n"),
        );

        const frames = parseStacktrace(error, { filter: stackFilters.nodeModules });

        expect(frames).toHaveLength(1);
        expect(frames[0]?.file).toContain("/app/index.js");
    });

    it("composeFilters should combine multiple filters", () => {
        expect.assertions(2);

        const error = makeError(
            [
                "Error: boom",
                "    at Object.<anonymous> (/app/index.js:10:5)",
                "    at handler (/app/node_modules/some-dep/dist/index.js:42:3)",
                "    at Module._compile (node:internal/modules/cjs/loader:1234:14)",
            ].join("\n"),
        );

        const frames = parseStacktrace(error, {
            filter: composeFilters(stackFilters.internals, stackFilters.nodeModules),
        });

        expect(frames).toHaveLength(1);
        expect(frames[0]?.file).toContain("/app/index.js");
    });
});
