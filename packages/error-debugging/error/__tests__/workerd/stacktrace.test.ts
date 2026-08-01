import { describe, expect, it } from "vitest";

import { composeFilters, formatStacktrace, parseStacktrace, stackFilters } from "../../src/stacktrace";

const withStack = (...frames: string[]): Error => {
    const error = new Error("boom");

    error.stack = ["Error: boom", ...frames].join("\n");

    return error;
};

describe("stack-trace parsing on workerd", () => {
    it("should parse a stack thrown by workerd itself", () => {
        expect.assertions(4);

        let caught: Error | undefined;

        const inner = (): never => {
            throw new Error("thrown on the edge");
        };

        const outer = (): void => inner();

        try {
            outer();
        } catch (error) {
            caught = error as Error;
        }

        const frames = parseStacktrace(caught as Error);

        expect(frames.length).toBeGreaterThan(1);
        expect(frames[0]?.methodName).toBe("inner");
        expect(frames[1]?.methodName).toBe("outer");
        expect(frames[0]?.line).toBeTypeOf("number");
    });

    it("should parse workerd module specifiers that are not file URLs", () => {
        expect.assertions(2);

        // Deployed Workers report bundle-relative specifiers, not absolute paths or `file:` URLs.
        const frames = parseStacktrace(withStack("    at handler (index.js:5:11)", "    at fetch (worker.js:1:1)"));

        expect(frames[0]).toStrictEqual({
            column: 11,
            evalOrigin: undefined,
            file: "index.js",
            line: 5,
            methodName: "handler",
            raw: "at handler (index.js:5:11)",
            type: undefined,
        });
        expect(frames[1]?.file).toBe("worker.js");
    });

    it("should keep the `async` marker out of the resolved file name", () => {
        expect.assertions(2);

        const frames = parseStacktrace(withStack("    at async fetchHandler (index.js:9:3)"));

        expect(frames[0]?.file).toBe("index.js");
        expect(frames[0]?.line).toBe(9);
    });

    it("should not tag any workerd frame as a Node internal", () => {
        expect.assertions(1);

        // workerd emits no `node:internal/*` frames, so the `internal` classification must stay off
        // for an all-workerd stack — otherwise consumers filtering internals would drop real frames.
        const frames = parseStacktrace(withStack("    at handler (index.js:5:11)", "    at fetch (worker.js:1:1)", "    at <anonymous> (index.js:1:1)"));

        expect(frames.filter((frame) => frame.type === "internal")).toStrictEqual([]);
    });

    it("should keep workerd frames when the internals filter is applied", () => {
        expect.assertions(2);

        // A Node-originated error rendered inside a Worker still carries `node:internal/*` frames;
        // the preset must drop those and keep the workerd ones.
        const frames = parseStacktrace(withStack("    at handler (index.js:5:11)", "    at Module._compile (node:internal/modules/cjs/loader:1105:14)"), {
            filter: stackFilters.internals,
        });

        expect(frames).toHaveLength(1);
        expect(frames[0]?.file).toBe("index.js");
    });

    it("should compose filters without touching workerd frames", () => {
        expect.assertions(1);

        const frames = parseStacktrace(
            withStack("    at handler (index.js:5:11)", "    at run (/bundle/node_modules/dep/index.js:2:2)", "    at boot (node:internal/main:1:1)"),
            { filter: composeFilters(stackFilters.internals, stackFilters.nodeModules) },
        );

        expect(frames.map((frame) => frame.file)).toStrictEqual(["index.js"]);
    });

    it("should stringify parsed workerd frames back to stack lines", () => {
        expect.assertions(1);

        const frames = parseStacktrace(withStack("    at handler (index.js:5:11)"));

        expect(formatStacktrace(frames)).toContain("index.js:5:11");
    });

    it("should honour the frame limit on deep workerd stacks", () => {
        expect.assertions(1);

        const frames = parseStacktrace(
            withStack(...Array.from({ length: 40 }, (_, index) => `    at frame${String(index)} (index.js:${String(index + 1)}:1)`)),
            { frameLimit: 3 },
        );

        expect(frames).toHaveLength(3);
    });

    it("should return no frames for an error with no stack", () => {
        expect.assertions(1);

        const error = new Error("stackless");

        error.stack = undefined;

        expect(parseStacktrace(error)).toStrictEqual([]);
    });
});
