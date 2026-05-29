import { describe, expect, it } from "vitest";

import aiPrompt from "../../../src/solution/ai/ai-prompt";

describe("solution/ai/ai-prompt", () => {
    it("includes the language, application type, line, file, snippet and error details", () => {
        expect.assertions(7);

        const prompt = aiPrompt({
            applicationType: "Next.js",
            error: Object.assign(new Error("Something broke"), { name: "TypeError" }),
            file: {
                file: "src/index.ts",
                language: "typescript",
                line: 42,
                snippet: "42 | const x = 1;",
            },
        });

        expect(prompt).toContain("very skilled typescript programmer");
        expect(prompt).toContain("working on a Next.js application");
        expect(prompt).toContain("Line: 42");
        expect(prompt).toContain("src/index.ts");
        expect(prompt).toContain("42 | const x = 1;");
        expect(prompt).toContain("TypeError");
        expect(prompt).toContain("Something broke");
    });

    it("falls back to unknown language and omits application type and snippet when not provided", () => {
        expect.assertions(3);

        const prompt = aiPrompt({
            applicationType: undefined,
            error: new Error("boom"),
            file: {
                file: "src/index.ts",
                line: 1,
            },
        });

        expect(prompt).toContain("very skilled unknown programmer");
        expect(prompt).not.toContain("You are working on a");
        expect(prompt).toContain("Snippet including line numbers:\n\n");
    });
});
