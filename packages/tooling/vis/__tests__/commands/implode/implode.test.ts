import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("implode shell profile cleanup", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), "vis-implode-test-"));
    });

    afterEach(() => {
        rmSync(tmpDir, { force: true, recursive: true });
    });

    it("should remove lines containing .vis/bin from profiles", () => {
        expect.assertions(1);

        const profilePath = join(tmpDir, ".zshrc");

        writeFileSync(profilePath, ["# normal line", 'export PATH="$HOME/.vis/bin:$PATH"', "# vis setup", "alias ls='ls -la'"].join("\n"));

        const content = readFileSync(profilePath, "utf8");
        const lines = content.split("\n");
        const filtered = lines.filter((line) => !line.includes(".vis/bin") && !line.includes("VIS_HOME") && !line.includes("# vis "));

        expect(filtered).toStrictEqual(["# normal line", "alias ls='ls -la'"]);
    });

    it("should not modify profiles without vis lines", () => {
        expect.assertions(1);

        const profilePath = join(tmpDir, ".bashrc");
        const original = "export PATH=/usr/bin:$PATH\nalias ll='ls -la'\n";

        writeFileSync(profilePath, original);

        const content = readFileSync(profilePath, "utf8");
        const lines = content.split("\n");
        const filtered = lines.filter((line) => !line.includes(".vis/bin") && !line.includes("VIS_HOME") && !line.includes("# vis "));

        expect(filtered.join("\n")).toBe(original);
    });
});

describe("implode directory removal", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), "vis-implode-dir-test-"));
    });

    afterEach(() => {
        if (existsSync(tmpDir)) {
            rmSync(tmpDir, { force: true, recursive: true });
        }
    });

    it("should remove a directory and its contents", () => {
        expect.assertions(2);

        const visHome = join(tmpDir, ".vis");

        mkdirSync(join(visHome, "bin"), { recursive: true });
        mkdirSync(join(visHome, "js_runtime", "node"), { recursive: true });
        writeFileSync(join(visHome, "config.json"), "{}");

        expect(existsSync(visHome)).toBe(true);

        rmSync(visHome, { force: true, recursive: true });

        expect(existsSync(visHome)).toBe(false);
    });
});
