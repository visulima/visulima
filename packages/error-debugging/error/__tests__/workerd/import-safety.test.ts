import { describe, expect, it } from "vitest";

/**
 * The single most important property on the edge: importing the package must not throw.
 *
 * Every public entry point is pulled in dynamically inside the assertion so a module-evaluation
 * failure surfaces as a failing expectation rather than a collection-time crash that hides which
 * entry point broke.
 */
describe("`@visulima/error` import safety on workerd", () => {
    it("should run inside workerd", () => {
        expect.assertions(1);

        // eslint-disable-next-line n/no-unsupported-features/node-builtins -- workerd always provides `navigator`
        expect(navigator.userAgent).toBe("Cloudflare-Workers");
    });

    it("should import the root entry point without throwing", async () => {
        expect.assertions(1);

        await expect(import("../../src/index")).resolves.toBeDefined();
    });

    it("should import every sub-path entry point without throwing", async () => {
        expect.assertions(4);

        await expect(import("../../src/code-frame/index")).resolves.toBeDefined();
        await expect(import("../../src/error/index")).resolves.toBeDefined();
        await expect(import("../../src/stacktrace/index")).resolves.toBeDefined();
        await expect(import("../../src/solution/index")).resolves.toBeDefined();
    });

    it("should expose the full public API from the root entry point", async () => {
        expect.assertions(1);

        const module = await import("../../src/index");

        expect(Object.keys(module).toSorted((a, b) => a.localeCompare(b))).toStrictEqual([
            "addKnownErrorConstructor",
            "aiPrompt",
            "aiSolutionResponse",
            "captureRawStackTrace",
            "CODE_FRAME_POINTER",
            "codeFrame",
            "composeFilters",
            "deserializeError",
            "errorHintFinder",
            "formatStackFrameLine",
            "formatStacktrace",
            "getErrorCauses",
            "indexToLineColumn",
            "isErrorLike",
            "isVisulimaError",
            "NonError",
            "parseStacktrace",
            "renderError",
            "ruleBasedFinder",
            "serializeError",
            "stackFilters",
            "VisulimaError",
        ]);
    });

    it("should not pull `node:fs`-backed AI caching onto the root import path", async () => {
        expect.assertions(1);

        // `./solution/ai` is an opt-in sub-path: it caches AI answers to disk (`node:fs`, `node:os`)
        // and requires the `ai` peer. The root entry must expose only the prompt/response helpers so
        // an edge bundle never drags the filesystem-backed finder in.
        const module = await import("../../src/index");

        expect("aiFinder" in module).toBe(false);
    });
});
