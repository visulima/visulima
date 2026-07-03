import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { pmRunnerInternals, runLocalExec } from "../../src/pm/pm-runner";

const { resolveLocalBin } = pmRunnerInternals;

describe("exec fast path", () => {
    let workspace: string;
    let binDir: string;

    const writeBin = (name: string, body: string): string => {
        const file = join(binDir, name);

        writeFileSync(file, body);
        chmodSync(file, 0o755);

        return file;
    };

    beforeEach(() => {
        workspace = mkdtempSync(join(tmpdir(), "vis-local-exec-"));
        binDir = join(workspace, "node_modules", ".bin");
        mkdirSync(binDir, { recursive: true });
    });

    afterEach(() => {
        rmSync(workspace, { force: true, recursive: true });
    });

    describe(resolveLocalBin, () => {
        it("resolves a binary that exists in the workspace node_modules/.bin", () => {
            expect.assertions(1);

            const file = writeBin("widget", "#!/bin/sh\nexit 0\n");

            expect(resolveLocalBin("widget", workspace)).toBe(file);
        });

        it("returns undefined when the binary is not locally installed", () => {
            expect.assertions(1);

            expect(resolveLocalBin("does-not-exist", workspace)).toBeUndefined();
        });

        it("returns undefined for a command that contains a path separator", () => {
            expect.assertions(1);

            writeBin("widget", "#!/bin/sh\nexit 0\n");

            // A path-bearing command is the caller's explicit path — left for
            // the package manager / shell, never resolved against `.bin`.
            expect(resolveLocalBin("./widget", workspace)).toBeUndefined();
        });
    });

    describe(runLocalExec, () => {
        it("returns null when the binary is not local, so the caller falls back to the PM", () => {
            expect.assertions(1);

            expect(runLocalExec("does-not-exist", [], workspace)).toBeNull();
        });

        it.skipIf(process.platform === "win32")("runs a local binary directly and forwards its exit code", () => {
            expect.assertions(2);

            writeBin("ok", "#!/bin/sh\nexit 0\n");
            writeBin("boom", "#!/bin/sh\nexit 3\n");

            expect(runLocalExec("ok", [], workspace)).toBe(0);
            expect(runLocalExec("boom", [], workspace)).toBe(3);
        });

        it.skipIf(process.platform === "win32")("passes arguments as argv without shell re-tokenization", () => {
            expect.assertions(2);

            const sentinel = join(workspace, "captured.txt");
            const injected = join(workspace, "injected.txt");

            // Writes its raw first argument to a file. If the spawn went through
            // a shell, the `&` would split the argument and run a second command.
            writeBin("capture", `#!/bin/sh\nprintf '%s' "$1" > ${JSON.stringify(sentinel)}\nexit 0\n`);

            const evil = `a & echo pwned > ${injected}`;

            runLocalExec("capture", [evil], workspace);

            // The whole metacharacter-laden string arrives as a single argv entry…
            expect(readFileSync(sentinel, "utf8")).toBe(evil);
            // …and the injected command never executed.
            expect(existsSync(injected)).toBe(false);
        });
    });
});
