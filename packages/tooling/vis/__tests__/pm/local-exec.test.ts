import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { pmRunnerInternals, runLocalExec } from "../../src/pm/pm-runner";

const { resolveLocalBin } = pmRunnerInternals;

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

describe("resolveLocalBin", () => {
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

describe("runLocalExec", () => {
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
});
