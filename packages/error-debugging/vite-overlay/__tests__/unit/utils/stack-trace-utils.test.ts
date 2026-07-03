import { describe, expect, it } from "vitest";

import { absolutizeStackUrls, cleanErrorMessage, cleanErrorStack, extractErrors, isAggregateError, isValidStackFrame } from "../../../src/utils/stack-trace";

describe(cleanErrorStack, () => {
    it("should clean Vue compilation errors", () => {
        expect.assertions(1);

        const stack = `Error: [vue/compiler-sfc] Unexpected token, expected "," (4:2)

  Plugin: vite:vue
  File: /home/prisis/WebstormProjects/visulima/visulima/packages/vite-overlay/examples/vite-vue/src/components/HelloWorld.vue:4:2
at constructor (/home/prisis/WebstormProjects/visulima/visulima/node_modules/.pnpm/@babel+parser@7.28.4/node_modules/@babel/parser/lib/index.js:367:19)
at TypeScriptParserMixin.raise (/home/prisis/WebstormProjects/visulima/visulima/node_modules/.pnpm/@babel+parser@7.28.4/node_modules/@babel/parser/lib/index.js:6630:19)`;

        const result = cleanErrorStack(stack);

        expect(result)
            .toBe(`at constructor (/home/prisis/WebstormProjects/visulima/visulima/node_modules/.pnpm/@babel+parser@7.28.4/node_modules/@babel/parser/lib/index.js:367:19)
at TypeScriptParserMixin.raise (/home/prisis/WebstormProjects/visulima/visulima/node_modules/.pnpm/@babel+parser@7.28.4/node_modules/@babel/parser/lib/index.js:6630:19)`);
    });

    it("should keep valid JavaScript stack frames", () => {
        expect.assertions(1);

        const stack = `at myFunction (/path/to/file.js:10:5)
at Class.method (/path/to/file.js:20:15)
at /path/to/file.js:30:25
at <anonymous> (/path/to/file.js:40:35)
at nativeFunction (native)
at asyncFunction (/path/to/file.js:50:45)`;

        const result = cleanErrorStack(stack);

        expect(result).toBe(stack); // Should remain unchanged
    });

    it("should filter out invalid stack frames", () => {
        expect.assertions(1);

        const stack = `at myFunction (/path/to/file.js:10:5)
Some random text
at
Invalid frame
at functionWithoutFile
at fileWithoutLocation.js
at /path/to/file.js:30:25`;

        const result = cleanErrorStack(stack);

        expect(result).toBe(`at myFunction (/path/to/file.js:10:5)
at /path/to/file.js:30:25`);
    });

    it("should handle empty and null inputs", () => {
        expect.assertions(3);

        expect(cleanErrorStack("")).toBe("");
        expect(cleanErrorStack(null as any)).toBeNull();
        expect(cleanErrorStack(undefined as any)).toBeUndefined();
    });

    it("should clean @fs/ paths", () => {
        expect.assertions(1);

        const stack = `at myFunction (/@fs/home/user/project/src/file.js:10:5)
at anotherFunction (/@fs/home/user/project/src/other.js:20:15)`;

        const result = cleanErrorStack(stack);

        expect(result).toBe(`at myFunction (/home/user/project/src/file.js:10:5)
at anotherFunction (/home/user/project/src/other.js:20:15)`);
    });

    it("should clean file:// URLs", () => {
        expect.assertions(1);

        const stack = `at myFunction (file:///home/user/project/src/file.js:10:5)
at anotherFunction (file:///home/user/project/src/other.js:20:15)`;

        const result = cleanErrorStack(stack);

        expect(result).toBe(`at myFunction (/home/user/project/src/file.js:10:5)
at anotherFunction (/home/user/project/src/other.js:20:15)`);
    });

    it("should preserve unknown locations from browser", () => {
        expect.assertions(1);

        const stack = `at App <unknown>:0:0
at Object.react_stack_bottom_frame <unknown>:0:0
at renderWithHooks <unknown>:0:0
at updateFunctionComponent <unknown>:0:0`;

        const result = cleanErrorStack(stack);

        // cleanErrorStack should preserve <unknown> entries as valid stack frames
        expect(result).toBe(`at App <unknown>:0:0
at Object.react_stack_bottom_frame <unknown>:0:0
at renderWithHooks <unknown>:0:0
at updateFunctionComponent <unknown>:0:0`);
    });
});

describe("mixed content handling", () => {
    it("should handle mixed valid and invalid content", () => {
        expect.assertions(1);

        const stack = `Error: Something went wrong
at validFunction (/path/to/file.js:10:5)
Some error description here
at anotherValidFunction (/path/to/other.js:20:15)
Invalid line that should be removed
at invalidFunction
at /path/to/file.js:30:25`;

        const result = cleanErrorStack(stack);

        expect(result).toBe(`at validFunction (/path/to/file.js:10:5)
at anotherValidFunction (/path/to/other.js:20:15)
at /path/to/file.js:30:25`);
    });

    it("should handle TypeScript files", () => {
        expect.assertions(1);

        const stack = `at myFunction (/path/to/file.ts:10:5)
at Class.method (/path/to/file.ts:20:15)
at /path/to/file.ts:30:25`;

        const result = cleanErrorStack(stack);

        expect(result).toBe(stack); // Should remain unchanged
    });

    it("should handle ES modules", () => {
        expect.assertions(1);

        const stack = `at myFunction (/path/to/file.mjs:10:5)
at anotherFunction (/path/to/file.cjs:20:15)`;

        const result = cleanErrorStack(stack);

        expect(result).toBe(stack); // Should remain unchanged
    });

    it("should handle native functions", () => {
        expect.assertions(1);

        const stack = `at myFunction (/path/to/file.js:10:5)
at nativeFunction (native)
at anotherFunction (/path/to/other.js:20:15)`;

        const result = cleanErrorStack(stack);

        expect(result).toBe(stack); // Should remain unchanged
    });

    it("should handle anonymous functions", () => {
        expect.assertions(1);

        const stack = `at myFunction (/path/to/file.js:10:5)
at <anonymous> (/path/to/file.js:20:15)
at anotherFunction (/path/to/other.js:30:25)`;

        const result = cleanErrorStack(stack);

        expect(result).toBe(stack); // Should remain unchanged
    });

    it("should remove empty lines after filtering", () => {
        expect.assertions(1);

        const stack = `at myFunction (/path/to/file.js:10:5)

Invalid line

at anotherFunction (/path/to/other.js:20:15)`;

        const result = cleanErrorStack(stack);

        expect(result).toBe(`at myFunction (/path/to/file.js:10:5)
at anotherFunction (/path/to/other.js:20:15)`);
    });
});

describe(isValidStackFrame, () => {
    it("should validate standard stack frame format", () => {
        expect.assertions(8);

        const validFrames = [
            "at myFunction (/path/to/file.js:10:5)",
            "at Class.method (/path/to/file.js:20:15)",
            "at /path/to/file.js:30:25",
            "at <anonymous> (/path/to/file.js:40:35)",
            "at nativeFunction (native)",
            "at asyncFunction (/path/to/file.ts:50:45)",
            "at moduleFunction (/path/to/file.mjs:60:55)",
            "at commonJSFunction (/path/to/file.cjs:70:65)",
        ];

        validFrames.forEach((frame) => {
            expect(isValidStackFrame(frame)).toBe(true);
        });
    });

    it("should reject lines that do not start with \"at\"", () => {
        expect.assertions(3);

        const invalidFrames = [
            "myFunction (/path/to/file.js:10:5)",
            "functionName at (/path/to/file.js:10:5)",
            "MyClass.at (/path/to/file.js:10:5)", // Not 'at' keyword
        ];

        invalidFrames.forEach((frame) => {
            expect(isValidStackFrame(frame)).toBe(false);
        });
    });

    it("should accept indented stack frames", () => {
        expect.assertions(3);

        const validIndentedFrames = [
            "  at myFunction (/path/to/file.js:10:5)",
            "    at Class.method (/path/to/file.js:20:15)",
            "        at /path/to/file.js:30:25",
        ];

        validIndentedFrames.forEach((frame) => {
            expect(isValidStackFrame(frame)).toBe(true);
        });
    });

    it("should reject frames without valid file references", () => {
        expect.assertions(8);

        const invalidFrames = [
            "at myFunction", // No file
            "at myFunction ()", // Empty parentheses
            "at myFunction (10:5)", // No file extension
            "at myFunction (/path/to/file.txt:10:5)", // Unsupported extension
            "at myFunction (/path/to/file:10:5)", // No extension
            "at myFunction (file.js)", // Missing line/column
            "at myFunction (file.js:)", // Missing column
            "at myFunction (:10:5)", // Missing file
        ];

        invalidFrames.forEach((frame) => {
            expect(isValidStackFrame(frame)).toBe(false);
        });
    });

    it("should handle edge cases", () => {
        expect.assertions(4);

        expect(isValidStackFrame("")).toBe(false);
        expect(isValidStackFrame("   ")).toBe(false);
        expect(isValidStackFrame("at")).toBe(false);
        expect(isValidStackFrame("at ")).toBe(false);
    });

    it("should handle native functions without location", () => {
        expect.assertions(2);

        expect(isValidStackFrame("at nativeFunction (native)")).toBe(true);
        expect(isValidStackFrame("at anotherNative (native)")).toBe(true);
    });

    it("should handle unknown locations from browser", () => {
        expect.assertions(3);

        expect(isValidStackFrame("at App <unknown>:0:0")).toBe(true);
        expect(isValidStackFrame("at renderWithHooks <unknown>:0:0")).toBe(true);
        expect(isValidStackFrame("at Component <unknown>:10:5")).toBe(true);
    });

    it("should handle anonymous functions", () => {
        expect.assertions(2);

        expect(isValidStackFrame("at <anonymous> (/path/to/file.js:10:5)")).toBe(true);
        expect(isValidStackFrame("at <anonymous> (file.js:10:5)")).toBe(true);
    });

    it("rejects pathologically long lines before running the location regexes (ReDoS guard)", () => {
        expect.assertions(2);

        // A long single-line "stack" arriving over the HMR channel must not drive the
        // super-linear-backtracking location regexes; it is rejected on length alone.
        const pathological = `at ${"a:".repeat(5000)}.js`;

        const start = performance.now();
        const result = isValidStackFrame(pathological);
        const elapsed = performance.now() - start;

        expect(result).toBe(false);
        // Length-gated, so this returns effectively instantly regardless of the regex shape.
        expect(elapsed).toBeLessThan(100);
    });

    it("parses the location marker in bounded time for an adversarial in-bounds frame (linear scanner)", () => {
        expect.assertions(2);

        // The location check is a linear scan (it replaced four backtracking-prone regexes).
        // Build an in-bounds (< MAX_STACK_LINE_LENGTH) frame whose body is the classic
        // catastrophic-backtracking shape — many non-colon chars, no terminating colon-digit —
        // plus the supported-extension keyword so the cheaper guards do not short-circuit first.
        // The trailing `.js` (without a `:line`) keeps `hasLocationMarker` false, exercising the
        // worst case where every position is examined.
        const adversarial = `at fn (${"a".repeat(2000)}.js)`;

        const start = performance.now();

        let result = false;

        for (let index = 0; index < 1000; index += 1) {
            result = isValidStackFrame(adversarial);
        }

        const elapsed = performance.now() - start;

        // No location marker => not a valid frame; correctness is preserved.
        expect(result).toBe(false);
        // 1000 iterations of a linear scan take single-digit milliseconds; a
        // backtracking regex on this 2000-char adversarial input would take
        // *seconds*. The ceiling is deliberately generous (not a tight bound) so
        // shared/loaded CI runners don't flake it, while still failing loudly on
        // a real catastrophic-backtracking regression.
        expect(elapsed).toBeLessThan(5000);
    });

    it("accepts a genuine location even when the line contains many parentheses", () => {
        expect.assertions(2);

        // Regression for the parenthesised-location linear scan: nested/extra parens before the
        // real `(file:line:col)` must not confuse the matcher.
        expect(isValidStackFrame("at obj.fn (cb) (/path/to/file.js:12:34)")).toBe(true);
        // A parenthesised group without a colon-digit location is still rejected.
        expect(isValidStackFrame("at obj.fn (cb) (just text)")).toBe(false);
    });
});

describe(absolutizeStackUrls, () => {
    const root = "/home/user/project";

    it("returns the stack unchanged when it is empty", () => {
        expect.assertions(2);

        expect(absolutizeStackUrls("", root)).toBe("");

        expect(absolutizeStackUrls(null as any, root)).toBeNull();
    });

    it("rewrites an http URL with line and column into an absolute filesystem path", () => {
        expect.assertions(1);

        const stack = "at Component (http://localhost:5173/src/App.tsx:10:5)";

        const result = absolutizeStackUrls(stack, root);

        expect(result).toBe("at Component (/home/user/project/src/App.tsx:10:5)");
    });

    it("rewrites an http URL with only a line number", () => {
        expect.assertions(1);

        const stack = "at fn (https://example.com/src/file.js:42)";

        const result = absolutizeStackUrls(stack, root);

        expect(result).toBe("at fn (/home/user/project/src/file.js:42)");
    });

    it("rewrites an http URL without line/column", () => {
        expect.assertions(1);

        const stack = "at fn (http://localhost/src/file.js)";

        const result = absolutizeStackUrls(stack, root);

        expect(result).toBe("at fn (/home/user/project/src/file.js)");
    });

    it("strips /@fs/ prefixes when converting the URL pathname", () => {
        expect.assertions(1);

        const stack = "at fn (http://localhost:5173/@fs/abs/path/file.js:3:2)";

        const result = absolutizeStackUrls(stack, root);

        // The /@fs/ marker is removed and the remaining path is resolved against root.
        expect(result).toContain("file.js:3:2");
    });

    it("leaves non-url content untouched", () => {
        expect.assertions(1);

        const stack = "at fn (/already/absolute/file.js:1:1)";

        expect(absolutizeStackUrls(stack, root)).toBe(stack);
    });
});

describe(cleanErrorMessage, () => {
    it("returns the message of an Error instance", () => {
        expect.assertions(1);

        expect(cleanErrorMessage(new Error("boom"))).toBe("boom");
    });

    it("accepts a raw string message", () => {
        expect.assertions(1);

        expect(cleanErrorMessage("plain message")).toBe("plain message");
    });

    it("strips VT control characters (ANSI colors) from the message", () => {
        expect.assertions(1);

        const colored = "[31mred error[39m";

        expect(cleanErrorMessage(colored)).toBe("red error");
    });

    it("falls back to String(error) when an Error has no message", () => {
        expect.assertions(1);

        const error = new Error("placeholder");

        error.message = "";

        expect(cleanErrorMessage(error)).toBe("Error");
    });
});

describe(isAggregateError, () => {
    it("returns true for a native AggregateError", () => {
        expect.assertions(1);

        expect(isAggregateError(new AggregateError([new Error("a")], "agg"))).toBe(true);
    });

    it("returns true for an object that carries an errors array", () => {
        expect.assertions(1);

        expect(isAggregateError({ errors: [new Error("a")] })).toBe(true);
    });

    it("returns false for a plain Error", () => {
        expect.assertions(1);

        expect(isAggregateError(new Error("nope"))).toBe(false);
    });

    it("returns false for null and non-objects", () => {
        expect.assertions(2);

        expect(isAggregateError(null)).toBe(false);
        expect(isAggregateError("string")).toBe(false);
    });

    it("returns false when errors is not an array", () => {
        expect.assertions(1);

        expect(isAggregateError({ errors: "not-an-array" })).toBe(false);
    });
});

describe(extractErrors, () => {
    it("returns the inner errors array of an AggregateError", () => {
        expect.assertions(2);

        const inner1 = new Error("one");
        const inner2 = new Error("two");
        const result = extractErrors(new AggregateError([inner1, inner2], "agg"));

        expect(result).toHaveLength(2);
        expect(result[0]).toBe(inner1);
    });

    it("wraps a single error in an array", () => {
        expect.assertions(2);

        const error = new Error("single");
        const result = extractErrors(error);

        expect(result).toHaveLength(1);
        expect(result[0]).toBe(error);
    });
});
