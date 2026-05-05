import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { appendToShellHistory } from "../../src/util/shell-history";

describe(appendToShellHistory, () => {
    let workDirectory: string;
    let originalShell: string | undefined;
    let originalHistFile: string | undefined;
    let originalVisNoHistory: string | undefined;

    beforeEach(async () => {
        // eslint-disable-next-line sonarjs/pseudo-random -- temp-dir suffix in tests, not security-sensitive
        workDirectory = join(tmpdir(), `vis-history-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

        await mkdir(workDirectory, { recursive: true });

        originalShell = process.env["SHELL"];
        originalHistFile = process.env["HISTFILE"];
        originalVisNoHistory = process.env["VIS_NO_SHELL_HISTORY"];
        delete process.env["VIS_NO_SHELL_HISTORY"];
    });

    afterEach(async () => {
        await rm(workDirectory, { force: true, recursive: true });

        if (originalShell === undefined) {
            delete process.env["SHELL"];
        } else {
            process.env["SHELL"] = originalShell;
        }

        if (originalHistFile === undefined) {
            delete process.env["HISTFILE"];
        } else {
            process.env["HISTFILE"] = originalHistFile;
        }

        if (originalVisNoHistory === undefined) {
            delete process.env["VIS_NO_SHELL_HISTORY"];
        } else {
            process.env["VIS_NO_SHELL_HISTORY"] = originalVisNoHistory;
        }
    });

    it.skipIf(process.platform === "win32")("appends a bash entry when SHELL=bash", async () => {
        expect.assertions(1);

        const histFile = join(workDirectory, ".bash_history");

        await writeFile(histFile, "");
        process.env["SHELL"] = "/bin/bash";
        process.env["HISTFILE"] = histFile;

        await appendToShellHistory("vis run build");

        const content = await readFile(histFile, "utf8");

        expect(content).toContain("vis run build");
    });

    it.skipIf(process.platform === "win32")("appends a zsh-extended entry when SHELL=zsh", async () => {
        expect.assertions(1);

        const histFile = join(workDirectory, ".zsh_history");

        await writeFile(histFile, "");
        process.env["SHELL"] = "/bin/zsh";
        process.env["HISTFILE"] = histFile;

        await appendToShellHistory("vis run test");

        const content = await readFile(histFile, "utf8");

        // Extended format: `: <ts>:0;<cmd>`
        expect(/^: \d+:0;vis run test$/m.test(content)).toBe(true);
    });

    it("respects VIS_NO_SHELL_HISTORY escape hatch", async () => {
        expect.assertions(1);

        const histFile = join(workDirectory, ".bash_history");

        await writeFile(histFile, "");
        process.env["SHELL"] = "/bin/bash";
        process.env["HISTFILE"] = histFile;
        process.env["VIS_NO_SHELL_HISTORY"] = "1";

        await appendToShellHistory("vis run build");

        const content = await readFile(histFile, "utf8");

        expect(content).toBe("");
    });

    it("is a no-op when SHELL is undefined", async () => {
        expect.assertions(1);

        delete process.env["SHELL"];

        // Must not throw and must not touch anything.
        await expect(appendToShellHistory("vis run build")).resolves.toBeUndefined();
    });
});
