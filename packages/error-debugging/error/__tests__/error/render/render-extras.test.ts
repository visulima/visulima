import { describe, expect, it, vi } from "vitest";

import { renderError } from "../../../src/error/render/error";

const hoisted = vi.hoisted(() => {
    return {
        // eslint-disable-next-line vitest/require-mock-type-parameters
        existsSync: vi.fn().mockReturnValue(false),
        // eslint-disable-next-line vitest/require-mock-type-parameters
        readFileSync: vi.fn(),
    };
});

vi.mock(import("node:fs"), async () => {
    const original = await vi.importActual("node:fs");

    return {
        ...original,
        existsSync: hoisted.existsSync,
        readFileSync: hoisted.readFileSync,
    };
});

describe("renderError backslash handling", () => {
    it("should not mangle backslashes inside the error message", () => {
        expect.assertions(2);

        const error = new Error(String.raw`Invalid pattern \d in C:\Users\me\file.txt`);
        const output = renderError(error);

        expect(output).toContain(String.raw`\d`);
        expect(output).toContain(String.raw`C:\Users\me\file.txt`);
    });
});

describe("renderError sourceMap resolver hook", () => {
    it("should remap the main frame file/line via the resolver", () => {
        expect.assertions(2);

        const error = new Error("boom");

        error.stack = ["Error: boom", "    at fn (/app/dist/bundle.js:100:5)"].join("\n");

        let seenFile: string | undefined;

        const output = renderError(error, {
            sourceMap: (location) => {
                seenFile = location.file;

                return { file: "/app/src/original.ts", line: 7 };
            },
        });

        expect(seenFile).toContain("bundle.js");
        expect(output).toContain("/app/src/original.ts:7");
    });

    it("should use resolver-provided source for the code frame", () => {
        expect.assertions(1);

        const error = new Error("boom");

        error.stack = ["Error: boom", "    at fn (/app/dist/bundle.js:2:1)"].join("\n");

        const output = renderError(error, {
            sourceMap: () => {
                return {
                    file: "/app/src/original.ts",
                    line: 2,
                    source: "const a = 1;\nconst b = 2;\nconst c = 3;\n",
                };
            },
        });

        expect(output).toContain("const b = 2;");
    });

    it("should leave the frame untouched when the resolver throws", () => {
        expect.assertions(1);

        const error = new Error("boom");

        error.stack = ["Error: boom", "    at fn (/app/dist/bundle.js:100:5)"].join("\n");

        const output = renderError(error, {
            sourceMap: () => {
                throw new Error("resolver failed");
            },
        });

        expect(output).toContain("/app/dist/bundle.js:100");
    });
});
