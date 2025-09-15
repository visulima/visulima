import { describe, expect, it } from "vitest";

import { cleanErrorStack, isValidStackFrame } from "../src/utils/stack-trace-utils";

describe(cleanErrorStack, () => {
    it("should clean Vue compilation errors", () => {
        const stack = `Error: [vue/compiler-sfc] Unexpected token, expected "," (4:2)

/home/prisis/WebstormProjects/visulima/visulima/packages/vite-overlay/examples/vite-vue/src/components/HelloWorld.vue
2  |  defineProps<{
3  |    msg: string
4  |    status: {
   |    ^
5  |      type: String,
6  |      validator(value) {
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
        expect(cleanErrorStack("")).toBe("");
        expect(cleanErrorStack(null as any)).toBeNull();
        expect(cleanErrorStack(undefined as any)).toBeUndefined();
    });

    it("should clean @fs/ paths", () => {
        const stack = `at myFunction (/@fs/home/user/project/src/file.js:10:5)
at anotherFunction (/@fs/home/user/project/src/other.js:20:15)`;

        const result = cleanErrorStack(stack);

        expect(result).toBe(`at myFunction (/home/user/project/src/file.js:10:5)
at anotherFunction (/home/user/project/src/other.js:20:15)`);
    });

    it("should clean file:// URLs", () => {
        const stack = `at myFunction (file:///home/user/project/src/file.js:10:5)
at anotherFunction (file:///home/user/project/src/other.js:20:15)`;

        const result = cleanErrorStack(stack);

        expect(result).toBe(`at myFunction (/home/user/project/src/file.js:10:5)
at anotherFunction (/home/user/project/src/other.js:20:15)`);
    });

    it("should preserve unknown locations from browser", () => {
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
        const stack = `at myFunction (/path/to/file.ts:10:5)
at Class.method (/path/to/file.ts:20:15)
at /path/to/file.ts:30:25`;

        const result = cleanErrorStack(stack);

        expect(result).toBe(stack); // Should remain unchanged
    });

    it("should handle ES modules", () => {
        const stack = `at myFunction (/path/to/file.mjs:10:5)
at anotherFunction (/path/to/file.cjs:20:15)`;

        const result = cleanErrorStack(stack);

        expect(result).toBe(stack); // Should remain unchanged
    });

    it("should handle native functions", () => {
        const stack = `at myFunction (/path/to/file.js:10:5)
at nativeFunction (native)
at anotherFunction (/path/to/other.js:20:15)`;

        const result = cleanErrorStack(stack);

        expect(result).toBe(stack); // Should remain unchanged
    });

    it("should handle anonymous functions", () => {
        const stack = `at myFunction (/path/to/file.js:10:5)
at <anonymous> (/path/to/file.js:20:15)
at anotherFunction (/path/to/other.js:30:25)`;

        const result = cleanErrorStack(stack);

        expect(result).toBe(stack); // Should remain unchanged
    });

    it("should remove empty lines after filtering", () => {
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
        expect(isValidStackFrame("")).toBe(false);
        expect(isValidStackFrame("   ")).toBe(false);
        expect(isValidStackFrame("at")).toBe(false);
        expect(isValidStackFrame("at ")).toBe(false);
    });

    it("should handle native functions without location", () => {
        expect(isValidStackFrame("at nativeFunction (native)")).toBe(true);
        expect(isValidStackFrame("at anotherNative (native)")).toBe(true);
    });

    it("should handle unknown locations from browser", () => {
        expect(isValidStackFrame("at App <unknown>:0:0")).toBe(true);
        expect(isValidStackFrame("at renderWithHooks <unknown>:0:0")).toBe(true);
        expect(isValidStackFrame("at Component <unknown>:10:5")).toBe(true);
    });

    it("should handle anonymous functions", () => {
        expect(isValidStackFrame("at <anonymous> (/path/to/file.js:10:5)")).toBe(true);
        expect(isValidStackFrame("at <anonymous> (file.js:10:5)")).toBe(true);
    });
});
