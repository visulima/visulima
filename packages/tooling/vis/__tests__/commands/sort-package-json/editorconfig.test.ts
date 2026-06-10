import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { access, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { processFile } from "../../../src/commands/sort-package-json/handler";

interface NormalizedConfig {
    editorconfig: boolean;
    finalNewline: boolean;
    formatBugs: boolean;
    formatRepository: boolean;
    ignore: string[];
    indent: string | undefined;
    lineEnding: "auto" | "crlf" | "lf";
    sortExports: boolean;
    sortOrder: string[];
    sortScripts: boolean;
    unsorted: string[];
}

const baseNormalized = (overrides: Partial<NormalizedConfig> = {}): NormalizedConfig => {
    return {
        editorconfig: true,
        finalNewline: true,
        formatBugs: false,
        formatRepository: false,
        ignore: [],
        indent: undefined,
        lineEnding: "auto",
        sortExports: false,
        sortOrder: [],
        sortScripts: false,
        unsorted: [],
        ...overrides,
    };
};

// 2-space input forces detection vs. .editorconfig to actually differ.
const UNSORTED_PACKAGE_JSON = JSON.stringify(
    {
        version: "1.0.0",
        // eslint-disable-next-line perfectionist/sort-objects
        name: "fixture",
    },
    null,
    2,
);

const testFs = { access, mkdir, readdir, readFile, rm, stat, writeFile } as never;

describe("sort-package-json .editorconfig integration", () => {
    let workDirectory: string;

    beforeEach(() => {
        workDirectory = mkdtempSync(join(tmpdir(), "vis-sort-editorconfig-"));
    });

    afterEach(() => {
        rmSync(workDirectory, { force: true, recursive: true });
    });

    it("should derive 4-space indent from .editorconfig when no override is set", async () => {
        expect.assertions(2);

        writeFileSync(join(workDirectory, ".editorconfig"), "root = true\n\n[package.json]\nindent_style = space\nindent_size = 4\n", "utf8");
        const filePath = join(workDirectory, "package.json");

        writeFileSync(filePath, UNSORTED_PACKAGE_JSON, "utf8");

        const result = await processFile(filePath, { checkMode: false, cwd: workDirectory, fs: testFs, normalized: baseNormalized() });

        expect(result.status).toBe("rewritten");

        const written = readFileSync(filePath, "utf8");

        expect(written).toContain("\n    \"version\"");
    });

    it("should skip .editorconfig discovery when editorconfig is disabled", async () => {
        expect.assertions(2);

        writeFileSync(join(workDirectory, ".editorconfig"), "root = true\n\n[package.json]\nindent_style = space\nindent_size = 4\n", "utf8");
        const filePath = join(workDirectory, "package.json");

        writeFileSync(filePath, UNSORTED_PACKAGE_JSON, "utf8");

        const result = await processFile(filePath, {
            checkMode: false,
            cwd: workDirectory,
            fs: testFs,
            normalized: baseNormalized({ editorconfig: false }),
        });

        expect(result.status).toBe("rewritten");

        const written = readFileSync(filePath, "utf8");

        // Falls back to file detection — input is 2-space.
        expect(written).toContain("\n  \"version\"");
    });

    it("should let an explicit indent override beat .editorconfig", async () => {
        expect.assertions(2);

        writeFileSync(join(workDirectory, ".editorconfig"), "root = true\n\n[package.json]\nindent_style = space\nindent_size = 4\n", "utf8");
        const filePath = join(workDirectory, "package.json");

        writeFileSync(filePath, UNSORTED_PACKAGE_JSON, "utf8");

        const result = await processFile(filePath, {
            checkMode: false,
            cwd: workDirectory,
            fs: testFs,
            normalized: baseNormalized({ indent: "\t" }),
        });

        expect(result.status).toBe("rewritten");

        const written = readFileSync(filePath, "utf8");

        expect(written).toContain("\n\t\"version\"");
    });

    it("should derive tab indent from .editorconfig indent_style", async () => {
        expect.assertions(2);

        writeFileSync(join(workDirectory, ".editorconfig"), "root = true\n\n[package.json]\nindent_style = tab\n", "utf8");
        const filePath = join(workDirectory, "package.json");

        writeFileSync(filePath, UNSORTED_PACKAGE_JSON, "utf8");

        const result = await processFile(filePath, { checkMode: false, cwd: workDirectory, fs: testFs, normalized: baseNormalized() });

        expect(result.status).toBe("rewritten");

        const written = readFileSync(filePath, "utf8");

        expect(written).toContain("\n\t\"version\"");
    });

    it("should derive crlf line endings from .editorconfig end_of_line", async () => {
        expect.assertions(2);

        writeFileSync(join(workDirectory, ".editorconfig"), "root = true\n\n[package.json]\nend_of_line = crlf\n", "utf8");
        const filePath = join(workDirectory, "package.json");

        writeFileSync(filePath, UNSORTED_PACKAGE_JSON, "utf8");

        const result = await processFile(filePath, { checkMode: false, cwd: workDirectory, fs: testFs, normalized: baseNormalized() });

        expect(result.status).toBe("rewritten");

        const written = readFileSync(filePath, "utf8");

        expect(written).toContain("\r\n");
    });
});
