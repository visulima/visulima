import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { findUp } from "@visulima/fs";
import type { MockInstance } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { startMcpServer } from "../src/server";

// This spec covers two narrow paths in server.ts that the in-process
// integration tests can't easily exercise:
//   - the `loadVersion` catch branch (readFile fails after findUp succeeded)
//   - the `loadVersion` fallback when findUp returns undefined
// Both need module-level mocks because the helpers are otherwise unobservable
// from outside the module.
vi.mock(import("node:fs/promises"), async (importOriginal) => {
    const actual = await importOriginal();

    return {
        ...actual,
        readFile: vi.fn<typeof readFile>(),
    };
});

vi.mock(import("@visulima/fs"), async (importOriginal) => {
    const actual = await importOriginal();

    return {
        ...actual,
        findUp: vi.fn<typeof findUp>(),
    };
});

vi.mock(import("@modelcontextprotocol/sdk/server/stdio.js"), () => {
    // McpServer calls `new StdioServerTransport()` — the mock must be a
    // constructable class with the transport contract surface.
    class FakeStdioTransport {
        public onclose?: () => void;

        public onerror?: (error: Error) => void;

        public onmessage?: (message: unknown) => void;

        // eslint-disable-next-line class-methods-use-this, @typescript-eslint/require-await
        public async start(): Promise<void> {
            return undefined;
        }

        // eslint-disable-next-line class-methods-use-this, @typescript-eslint/require-await
        public async close(): Promise<void> {
            return undefined;
        }

        // eslint-disable-next-line class-methods-use-this, @typescript-eslint/require-await
        public async send(): Promise<void> {
            return undefined;
        }
    }

    return { StdioServerTransport: FakeStdioTransport };
});

const FAKE_VIS = fileURLToPath(new URL("__fixtures__/fake-vis.mjs", import.meta.url));

const mockedReadFile = vi.mocked(readFile);
const mockedFindUp = vi.mocked(findUp);

let originalEnv: typeof process.env;
let stderrSpy: MockInstance<(typeof process.stderr)["write"]>;

beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.VIS_MCP_VIS_BIN = FAKE_VIS;
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    mockedReadFile.mockReset();
    mockedFindUp.mockReset();
});

afterEach(() => {
    process.env = originalEnv;
    stderrSpy.mockRestore();
});

describe("server.ts loadVersion fallbacks", () => {
    it("should fall back to '0.0.0' and log to stderr when readFile rejects", async () => {
        expect.assertions(2);

        mockedFindUp.mockResolvedValueOnce("/fake/package.json");
        mockedReadFile.mockRejectedValueOnce(new Error("EACCES: simulated"));

        await expect(startMcpServer()).resolves.toBeUndefined();

        const errorLines = stderrSpy.mock.calls.map((call) => String(call[0])).filter((message) => message.includes("[vis-mcp] failed to read package.json"));

        expect(errorLines.length).toBeGreaterThanOrEqual(1);
    });

    it("should fall back silently when findUp returns undefined (no package.json upstream)", async () => {
        expect.assertions(2);

        mockedFindUp.mockResolvedValueOnce(undefined);
        // readFile must not be called on this branch.
        mockedReadFile.mockRejectedValue(new Error("should not be called"));

        await expect(startMcpServer()).resolves.toBeUndefined();
        expect(mockedReadFile).not.toHaveBeenCalled();
    });

    it("should fall back to '0.0.0' when the package.json has no version field", async () => {
        expect.assertions(2);

        mockedFindUp.mockResolvedValueOnce("/fake/package.json");
        // A valid package.json that simply omits `version` — exercises the
        // `parsed.version ?? "0.0.0"` nullish fallback.
        mockedReadFile.mockResolvedValueOnce(JSON.stringify({ name: "@visulima/vis-mcp" }));

        await expect(startMcpServer()).resolves.toBeUndefined();

        const errorLines = stderrSpy.mock.calls.map((call) => String(call[0])).filter((message) => message.includes("failed to read package.json"));

        // The version fallback is silent — no error should be logged.
        expect(errorLines).toHaveLength(0);
    });
});
