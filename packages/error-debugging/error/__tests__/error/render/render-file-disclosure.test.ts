import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { renderError } from "../../../src/error/render/error";

const SECRET_LINE = "TOP_SECRET_PASSWORD=hunter2";

describe("renderError local file disclosure", () => {
    let outsideDirectory: string;
    let secretFile: string;

    beforeEach(() => {
        // A file the attacker references via the stack, living OUTSIDE the rendering cwd.
        outsideDirectory = mkdtempSync(join(tmpdir(), "visulima-error-disclosure-"));
        secretFile = join(outsideDirectory, "secret.txt");

        writeFileSync(secretFile, `${SECRET_LINE}\nline2\nline3\n`, "utf8");
    });

    afterEach(() => {
        rmSync(outsideDirectory, { force: true, recursive: true });
    });

    it("does not read or print files outside cwd referenced by an untrusted stack", () => {
        expect.assertions(1);

        const error = new Error("boom");

        // Simulate a deserialized/attacker-influenced stack pointing at an arbitrary local file.
        error.stack = ["Error: boom", `    at fn (${secretFile}:1:1)`].join("\n");

        const output = renderError(error, { cwd: process.cwd() });

        expect(output).not.toContain(SECRET_LINE);
    });

    it("reads files outside cwd when allowAllFilePaths is explicitly enabled", () => {
        expect.assertions(1);

        const error = new Error("boom");

        error.stack = ["Error: boom", `    at fn (${secretFile}:1:1)`].join("\n");

        const output = renderError(error, { allowAllFilePaths: true, cwd: process.cwd() });

        expect(output).toContain(SECRET_LINE);
    });

    it("still reads source files located inside cwd (normal local-dev rendering)", () => {
        expect.assertions(1);

        const insideDirectory = mkdtempSync(join(process.cwd(), "visulima-error-inside-"));
        const insideFile = join(insideDirectory, "source.txt");

        writeFileSync(insideFile, "const a = 1;\nconst b = 2;\nconst c = 3;\n", "utf8");

        try {
            const error = new Error("boom");

            error.stack = ["Error: boom", `    at fn (${insideFile}:2:1)`].join("\n");

            const output = renderError(error, { cwd: process.cwd() });

            expect(output).toContain("const b = 2;");
        } finally {
            rmSync(insideDirectory, { force: true, recursive: true });
        }
    });
});
