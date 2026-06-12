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
    let originalPsHistory: string | undefined;
    let originalAppData: string | undefined;
    let originalHome: string | undefined;

    beforeEach(async () => {
        // eslint-disable-next-line sonarjs/pseudo-random -- temp-dir suffix in tests, not security-sensitive
        workDirectory = join(tmpdir(), `vis-history-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

        await mkdir(workDirectory, { recursive: true });

        originalShell = process.env["SHELL"];
        originalHistFile = process.env["HISTFILE"];
        originalVisNoHistory = process.env["VIS_NO_SHELL_HISTORY"];
        originalPsHistory = process.env["VIS_PSREADLINE_HISTORY"];
        originalAppData = process.env["APPDATA"];
        originalHome = process.env["HOME"];
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

        if (originalPsHistory === undefined) {
            delete process.env["VIS_PSREADLINE_HISTORY"];
        } else {
            process.env["VIS_PSREADLINE_HISTORY"] = originalPsHistory;
        }

        if (originalAppData === undefined) {
            delete process.env["APPDATA"];
        } else {
            process.env["APPDATA"] = originalAppData;
        }

        if (originalHome === undefined) {
            delete process.env["HOME"];
        } else {
            process.env["HOME"] = originalHome;
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

    it.skipIf(process.platform === "win32")("collapses control characters so a newline cannot inject an extra history entry", async () => {
        expect.assertions(2);

        const histFile = join(workDirectory, ".bash_history");

        await writeFile(histFile, "");
        process.env["SHELL"] = "/bin/bash";
        process.env["HISTFILE"] = histFile;

        await appendToShellHistory("vis run build\nrm -rf /");

        const content = await readFile(histFile, "utf8");

        // The injected `rm -rf /` must not become its own line.
        expect(content).toBe("vis run build rm -rf /\n");
        expect(content.split("\n").filter((line) => line !== "")).toHaveLength(1);
    });

    it.skipIf(process.platform === "win32")("escapes newlines and carriage returns in the fish entry so a task name cannot inject extra entries", async () => {
        expect.assertions(3);

        const fishDirectory = join(workDirectory, ".local", "share", "fish");

        await mkdir(fishDirectory, { recursive: true });

        const histFile = join(fishDirectory, "fish_history");

        await writeFile(histFile, "");
        process.env["SHELL"] = "/usr/bin/fish";
        // The fish writer resolves its path via `homedir()`; on POSIX that
        // honours `$HOME`, which lets us redirect it into the temp dir.
        process.env["HOME"] = workDirectory;

        await appendToShellHistory("vis run build\r\nmalicious");

        const content = await readFile(histFile, "utf8");

        // The injected command must stay inside the single `- cmd:` entry: no
        // raw newline/carriage-return escapes the value, so only one `- cmd:`
        // line exists and the `when:` continuation line is the only other one.
        expect(content).toContain(String.raw`- cmd: vis run build\r\nmalicious`);
        expect(content.split("\n").filter((line) => line.startsWith("- cmd:"))).toHaveLength(1);
        expect(content).not.toContain("\r");
    });

    it.runIf(process.platform === "win32")("appends to the PowerShell PSReadLine history file on Windows", async () => {
        expect.assertions(1);

        const histFile = join(workDirectory, "ConsoleHost_history.txt");

        process.env["VIS_PSREADLINE_HISTORY"] = histFile;

        await appendToShellHistory("vis run build");

        const content = await readFile(histFile, "utf8");

        expect(content).toBe("vis run build\r\n");
    });

    it.runIf(process.platform === "win32")("collapses control characters in the PSReadLine entry", async () => {
        expect.assertions(1);

        const histFile = join(workDirectory, "nested", "ConsoleHost_history.txt");

        process.env["VIS_PSREADLINE_HISTORY"] = histFile;

        await appendToShellHistory("vis run test\nmalicious");

        const content = await readFile(histFile, "utf8");

        expect(content).toBe("vis run test malicious\r\n");
    });
});
