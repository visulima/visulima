import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import type { MockInstance } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The resolveVisBin failure path can't be hit in this repo without mocking,
// because @visulima/vis IS installed in vis-mcp's own node_modules — so the
// second resolution candidate (createRequire(import.meta.url)) always
// succeeds. We mock node:module so every require.resolve throws, forcing the
// "tried both candidates, neither resolved" branch that builds the aggregate
// error message and rethrows.
vi.mock(import("node:module"), async (importOriginal) => {
    const actual = await importOriginal();

    return {
        ...actual,
        createRequire: vi.fn<typeof createRequire>(),
    };
});

vi.mock(import("@modelcontextprotocol/sdk/server/stdio.js"), () => {
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

const mockedCreateRequire = vi.mocked(createRequire);

let originalEnv: typeof process.env;
let stderrSpy: MockInstance<(typeof process.stderr)["write"]>;

beforeEach(() => {
    originalEnv = { ...process.env };
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    mockedCreateRequire.mockReset();
});

afterEach(() => {
    process.env = originalEnv;
    stderrSpy.mockRestore();
});

describe("server.ts resolveVisBin resolution failures", () => {
    it("should throw an aggregate error listing every tried label when no candidate resolves @visulima/vis", async () => {
        expect.assertions(2);

        delete process.env.VIS_MCP_VIS_BIN;
        process.env.VIS_MCP_WORKSPACE_ROOT = "/synthetic/workspace/root";

        // Both candidates call require.resolve / require(...) — make every
        // require throw so resolveVisBin exhausts its candidate list.
        const throwingRequire = (() => {
            throw new Error("MODULE_NOT_FOUND: simulated");
        }) as unknown as ReturnType<typeof createRequire>;

        throwingRequire.resolve = (() => {
            throw new Error("MODULE_NOT_FOUND: simulated");
        }) as ReturnType<typeof createRequire>["resolve"];

        mockedCreateRequire.mockReturnValue(throwingRequire);

        // Dynamic import so the node:module mock is in place before server.ts
        // captures createRequire.
        const { startMcpServer } = await import("../src/server");

        const promise = startMcpServer();

        await expect(promise).rejects.toThrow(/Cannot resolve `@visulima\/vis`/);
        // The error lists both candidate labels (workspace root + the
        // vis-mcp install-location fallback).
        await expect(promise).rejects.toThrow(/vis-mcp install location/);
    });

    it("should short-circuit resolution when VIS_MCP_VIS_BIN is set, never touching createRequire", async () => {
        expect.assertions(2);

        process.env.VIS_MCP_VIS_BIN = FAKE_VIS;
        process.env.VIS_MCP_WORKSPACE_ROOT = "/synthetic/workspace/root";

        const { startMcpServer } = await import("../src/server");

        await expect(startMcpServer()).resolves.toBeUndefined();
        expect(mockedCreateRequire).not.toHaveBeenCalled();
    });
});
