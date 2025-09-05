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
});
