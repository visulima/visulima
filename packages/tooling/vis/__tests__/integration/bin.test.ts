import { spawnSync } from "node:child_process";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "..", "..");
const packageJson = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as { version: string };

const TRAILING_NEWLINE_RE = /\n$/;

const runBin = (binPath: string, args: string[], cwd: string): { code: number; stderr: string; stdout: string } => {
    const result = spawnSync(process.execPath, [binPath, ...args], {
        cwd,
        encoding: "utf8",
        input: "",
        timeout: 30_000,
    });

    return {
        code: result.status ?? -1,
        stderr: (result.stderr ?? "").replace(TRAILING_NEWLINE_RE, ""),
        stdout: (result.stdout ?? "").replace(TRAILING_NEWLINE_RE, ""),
    };
};

describe("usage `@visulima/vis` bin entries", () => {
    let cleanCwd: string;

    beforeAll(() => {
        cleanCwd = mkdtempSync(join(tmpdir(), "vis-bin-test-"));
    });

    afterAll(() => {
        rmSync(cleanCwd, { force: true, recursive: true });
    });

    it(`should expose working \`vis\` bin via --version`, () => {
        expect.assertions(2);

        const result = runBin(join(packageRoot, "dist/bin.js"), ["--version"], cleanCwd);

        expect(result.code).toBe(0);
        expect(result.stdout).toBe(packageJson.version);
    });

    it(`should expose working \`visx\` bin via --version`, () => {
        expect.assertions(2);

        const result = runBin(join(packageRoot, "dist/binx.js"), ["--version"], cleanCwd);

        expect(result.code).toBe(0);
        expect(result.stdout).toBe(packageJson.version);
    });
});
