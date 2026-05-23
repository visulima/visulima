import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

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
        stderr: (result.stderr ?? "").replace(TRAILING_NEWLINE_RE, ""),
        stdout: (result.stdout ?? "").replace(TRAILING_NEWLINE_RE, ""),
    };
};

describe("usage `@visulima/vis-mcp` bin entry", () => {
    it(`should boot the MCP server and exit on EOF`, () => {
        expect.assertions(2);

        const result = runBin(join(packageRoot, "dist/bin.js"), [], packageRoot);

        expect(result.code).toBe(0);
        expect(result.stderr).toContain("[vis-mcp] ready");
    });
});
