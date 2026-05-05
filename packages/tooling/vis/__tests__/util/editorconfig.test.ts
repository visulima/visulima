import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resolveEditorConfigDefaults, resolveIndentForExistingFile, resolveIndentForFile } from "../../src/util/editorconfig";

describe(resolveIndentForFile, () => {
    let workDirectory: string;

    beforeEach(() => {
        workDirectory = mkdtempSync(join(tmpdir(), "vis-editorconfig-util-"));
    });

    afterEach(() => {
        rmSync(workDirectory, { force: true, recursive: true });
    });

    it("should return 4-space indent from .editorconfig", () => {
        expect.assertions(1);

        writeFileSync(join(workDirectory, ".editorconfig"), "root = true\n\n[*.json]\nindent_style = space\nindent_size = 4\n", "utf8");
        const filePath = join(workDirectory, "package.json");

        expect(resolveIndentForFile(filePath, '{\n  "name": "x"\n}')).toBe("    ");
    });

    it("should return tab indent when .editorconfig declares it", () => {
        expect.assertions(1);

        writeFileSync(join(workDirectory, ".editorconfig"), "root = true\n\n[*.json]\nindent_style = tab\n", "utf8");
        const filePath = join(workDirectory, "package.json");

        expect(resolveIndentForFile(filePath, '{\n  "name": "x"\n}')).toBe("\t");
    });

    it("should fall back to file-content sniffing when editorconfig is disabled", () => {
        expect.assertions(1);

        writeFileSync(join(workDirectory, ".editorconfig"), "root = true\n\n[*.json]\nindent_style = space\nindent_size = 4\n", "utf8");
        const filePath = join(workDirectory, "package.json");

        expect(resolveIndentForFile(filePath, '{\n  "name": "x"\n}', { useEditorconfig: false })).toBe("  ");
    });

    it("should fall back to file-content sniffing when no editorconfig is present", () => {
        expect.assertions(1);

        const filePath = join(workDirectory, "package.json");

        expect(resolveIndentForFile(filePath, '{\n   "name": "x"\n}')).toBe("   ");
    });

    it("should fall back to defaultIndent when nothing else matches", () => {
        expect.assertions(1);

        const filePath = join(workDirectory, "package.json");

        expect(resolveIndentForFile(filePath, "{}", { defaultIndent: "    " })).toBe("    ");
    });

    it("should fall back to two spaces when no defaultIndent is provided", () => {
        expect.assertions(1);

        const filePath = join(workDirectory, "package.json");

        expect(resolveIndentForFile(filePath)).toBe("  ");
    });
});

describe(resolveEditorConfigDefaults, () => {
    let workDirectory: string;

    beforeEach(() => {
        workDirectory = mkdtempSync(join(tmpdir(), "vis-editorconfig-util-"));
    });

    afterEach(() => {
        rmSync(workDirectory, { force: true, recursive: true });
    });

    it("should return crlf line endings when end_of_line is set", () => {
        expect.assertions(1);

        writeFileSync(join(workDirectory, ".editorconfig"), "root = true\n\n[*.json]\nend_of_line = crlf\n", "utf8");

        expect(resolveEditorConfigDefaults(join(workDirectory, "package.json")).lineEnding).toBe("crlf");
    });

    it("should return an empty defaults object when no editorconfig matches", () => {
        expect.assertions(1);

        expect(resolveEditorConfigDefaults(join(workDirectory, "package.json"))).toStrictEqual({});
    });
});

describe(resolveIndentForExistingFile, () => {
    let workDirectory: string;

    beforeEach(() => {
        workDirectory = mkdtempSync(join(tmpdir(), "vis-editorconfig-util-"));
    });

    afterEach(() => {
        rmSync(workDirectory, { force: true, recursive: true });
    });

    it("should sniff indent from an existing file when no editorconfig is set", () => {
        expect.assertions(1);

        const filePath = join(workDirectory, "package.json");

        writeFileSync(filePath, '{\n   "name": "x"\n}', "utf8");

        expect(resolveIndentForExistingFile(filePath)).toBe("   ");
    });

    it("should fall back to defaultIndent when the file does not exist", () => {
        expect.assertions(1);

        expect(resolveIndentForExistingFile(join(workDirectory, "missing.json"))).toBe("  ");
    });

    it("should prefer editorconfig over file-content sniffing", () => {
        expect.assertions(1);

        writeFileSync(join(workDirectory, ".editorconfig"), "root = true\n\n[*.json]\nindent_style = space\nindent_size = 4\n", "utf8");
        const filePath = join(workDirectory, "package.json");

        writeFileSync(filePath, '{\n  "name": "x"\n}', "utf8");

        expect(resolveIndentForExistingFile(filePath)).toBe("    ");
    });
});
