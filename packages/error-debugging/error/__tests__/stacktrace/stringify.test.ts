import { describe, expect, it } from "vitest";

import type { Trace } from "../../src/stacktrace";
import { formatStackFrameLine, formatStacktrace } from "../../src/stacktrace";

describe("stacktrace stringify helpers", () => {
    it("formatStackFrameLine prints method, file, line, column", () => {
        expect.assertions(1);

        const frame: Trace = {
            column: 5,
            file: "/path/to/file.ts",
            line: 10,
            methodName: "myFn",
            raw: "",
            type: undefined,
        };

        expect(formatStackFrameLine(frame)).toBe("    at myFn (/path/to/file.ts:10:5)");
    });

    it("formatStackFrameLine omits method parentheses when missing", () => {
        expect.assertions(1);

        const frame: Trace = {
            column: 2,
            file: "/x.js",
            line: 1,
            methodName: undefined,
            raw: "",
            type: undefined,
        };

        expect(formatStackFrameLine(frame)).toBe("    at /x.js:1:2");
    });

    it("formatStacktrace joins frames with optional header", () => {
        expect.assertions(1);

        const frames: Trace[] = [
            { column: 3, file: "/a.js", line: 1, methodName: "fnA", raw: "", type: undefined },
            { column: 7, file: "/b.js", line: 2, methodName: undefined, raw: "", type: undefined },
        ];

        const out = formatStacktrace(frames, { header: { message: "boom", name: "Error" } });

        expect(out).toBe(["Error: boom", "    at fnA (/a.js:1:3)", "    at /b.js:2:7"].join("\n"));
    });

    it("formatStackFrameLine falls back to <unknown> file and zero line/column", () => {
        expect.assertions(1);

        const frame: Trace = {
            column: undefined,
            file: undefined,
            line: undefined,
            methodName: undefined,
            raw: "",
            type: undefined,
        };

        expect(formatStackFrameLine(frame)).toBe("    at <unknown>:0:0");
    });

    it("formatStacktrace defaults the header name to Error when only a message is given", () => {
        expect.assertions(1);

        const out = formatStacktrace([], { header: { message: "boom" } });

        expect(out).toBe("Error: boom");
    });

    it("formatStacktrace omits the colon when the header has only a name", () => {
        expect.assertions(1);

        const out = formatStacktrace([], { header: { name: "CustomError" } });

        expect(out).toBe("CustomError");
    });

    it("formatStacktrace omits the header entirely when name and message are empty", () => {
        expect.assertions(1);

        const out = formatStacktrace([], { header: { message: "", name: "" } });

        expect(out).toBe("");
    });
});
