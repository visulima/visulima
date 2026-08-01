import { existsSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { CODE_FRAME_POINTER, codeFrame } from "../../src/code-frame";
import { renderError } from "../../src/error/render/error";

const SOURCE = ["const a = 1;", "const b = 2;", "throw new Error(\"boom\");", "const c = 3;"].join("\n");

const withStack = (...frames: string[]): Error => {
    const error = new Error("boom");

    error.stack = ["Error: boom", ...frames].join("\n");

    return error;
};

describe("code frames on workerd", () => {
    it("should render a code frame from in-memory source", () => {
        expect.assertions(2);

        const frame = codeFrame(SOURCE, { start: { column: 7, line: 3 } });

        expect(frame).toContain("throw new Error(\"boom\");");
        expect(frame).toContain(CODE_FRAME_POINTER);
    });

    it("should pick a code-frame pointer without a POSIX/Windows `process` mismatch", () => {
        expect.assertions(1);

        // The pointer is chosen from `process.platform`; workerd reports "linux" under nodejs_compat
        // and the shim yields `undefined` without it. Either way the non-Windows pointer is used.
        expect(CODE_FRAME_POINTER).toBe("❯");
    });

    it("should use the source supplied by a source-map resolver instead of touching the filesystem", () => {
        expect.assertions(2);

        // The only way to get a code frame on the edge: hand the renderer the original source
        // (e.g. from an inlined `sourcesContent`) so it never needs to read from disk.
        const output = renderError(withStack("    at handler (index.js:3:7)"), {
            sourceMap: () => {
                return { column: 7, file: "src/index.ts", line: 3, source: SOURCE };
            },
        });

        expect(output).toContain("throw new Error(\"boom\");");
        expect(output).toContain("src/index.ts");
    });

    it("should keep rendering when the source-map resolver throws", () => {
        expect.assertions(2);

        const output = renderError(withStack("    at handler (index.js:3:7)"), {
            sourceMap: () => {
                throw new Error("resolver exploded");
            },
        });

        expect(output).toContain("Error: boom");
        expect(output).not.toContain("resolver exploded");
    });
});

describe("filesystem-backed enrichment on workerd", () => {
    it("should have no readable project files, so this suite exercises the degraded path", () => {
        expect.assertions(1);

        // Documents the premise of the tests below: workerd's filesystem is virtual and holds none
        // of the project's sources, so reading a stack frame's file can never succeed here.
        expect(existsSync(`${process.cwd()}/src/index.ts`)).toBe(false);
    });

    it("should render the frame but omit the code frame when the file cannot be read", () => {
        expect.assertions(3);

        const output = renderError(withStack("    at handler (/app/src/index.ts:3:7)"), { cwd: "/app" });

        expect(output).toContain("Error: boom");
        expect(output).toContain("/app/src/index.ts");
        // No source available => no gutter/pointer, but no crash either.
        expect(output).not.toContain(CODE_FRAME_POINTER);
    });

    it("should not throw when a stack frame points at a directory that does exist", () => {
        expect.assertions(2);

        // `/bundle` is a real directory in workerd's virtual filesystem: `existsSync` says yes and
        // the read then fails with "illegal operation on a directory". Existence alone is not a
        // sufficient guard, and the failure must not escape `renderError`.
        expect(existsSync("/bundle")).toBe(true);

        const output = renderError(withStack("    at handler (/bundle:1:1)"), { allowAllFilePaths: true, cwd: "/" });

        expect(output).toContain("Error: boom");
    });

    it("should not throw on a `file:` URL naming a remote host", () => {
        expect.assertions(1);

        // A stack is just a string and may arrive from a deserialized/untrusted error. `file:` URLs
        // with a host are rejected by `fileURLToPath`; that must degrade, not abort rendering.
        const output = renderError(withStack("    at handler (file://evil.example.com/a.js:1:1)"), { displayShortPath: true });

        expect(output).toContain("Error: boom");
    });

    it("should render a full cause chain with no filesystem access", () => {
        expect.assertions(3);

        const root = withStack("    at root (index.js:1:1)");
        const middle = new Error("middle", { cause: root });

        middle.stack = "Error: middle\n    at middle (index.js:2:1)";

        const top = new Error("top", { cause: middle });

        top.stack = "Error: top\n    at top (index.js:3:1)";

        const output = renderError(top);

        expect(output).toContain("Error: top");
        expect(output).toContain("Error: middle");
        expect(output).toContain("Error: boom");
    });

    it("should render an AggregateError with no filesystem access", () => {
        expect.assertions(2);

        const aggregate = new AggregateError([withStack("    at a (index.js:1:1)"), withStack("    at b (index.js:2:1)")], "many failures");

        aggregate.stack = "AggregateError: many failures\n    at handler (index.js:3:1)";

        const output = renderError(aggregate);

        expect(output).toContain("many failures");
        expect(output).toContain("Errors:");
    });

    it("should render a non-Error cause", () => {
        expect.assertions(1);

        const error = withStack("    at handler (index.js:1:1)");

        (error as Error & { cause?: unknown }).cause = { code: "E_EDGE" };

        expect(renderError(error)).toContain("E_EDGE");
    });
});
