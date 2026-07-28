import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "..", "..");

const TRAILING_NEWLINE_RE = /\n$/;

const runBin = (binPath: string, args: string[], cwd: string): { code: number; stderr: string; stdout: string } => {
    const result = spawnSync(process.execPath, [binPath, ...args], {
        cwd,
        encoding: "utf8",
        input: "",
        timeout: 15_000,
    });

    return {
        code: result.status ?? -1,
        stderr: result.stderr.replace(TRAILING_NEWLINE_RE, ""),
        stdout: result.stdout.replace(TRAILING_NEWLINE_RE, ""),
    };
};

const tempDirs: string[] = [];

afterEach(() => {
    while (tempDirs.length > 0) {
        rmSync(tempDirs.pop()!, { force: true, recursive: true });
    }
});

describe("usage `@visulima/vis-mcp` bin entry", () => {
    it(`should boot the MCP server and exit on EOF`, () => {
        expect.assertions(2);

        const result = runBin(join(packageRoot, "dist/bin.js"), [], packageRoot);

        expect(result.code).toBe(0);
        expect(result.stderr).toContain("[vis-mcp] ready");
    });

    it(`should boot the MCP server when launched through a symlink (the .bin shim / npx path)`, () => {
        expect.assertions(2);

        // The published binary is installed as a symlink in `node_modules/.bin`,
        // so the standard launch paths reach dist/bin.js via a link. Node keeps
        // argv[1] un-resolved while realpathing import.meta.url — the direct-
        // invocation guard must still fire, or the server never boots.
        const linkDir = mkdtempSync(join(tmpdir(), "vis-mcp-bin-link-"));

        tempDirs.push(linkDir);

        const link = join(linkDir, "vis-mcp");

        symlinkSync(join(packageRoot, "dist/bin.js"), link);

        const result = runBin(link, [], packageRoot);

        expect(result.code).toBe(0);
        expect(result.stderr).toContain("[vis-mcp] ready");
    });
});
