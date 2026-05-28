import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import type { MockInstance } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { startMcpServer } from "../src/server";

const FAKE_VIS = fileURLToPath(new URL("__fixtures__/fake-vis.mjs", import.meta.url));

// We stub the SDK's stdio transport so vitest's fd 1 isn't hijacked by
// JSON-RPC frames. The transport contract surface we need to satisfy is
// what `McpServer.connect()` actually calls — start/close/send + the three
// onmessage/onerror/onclose setters. The shape is taken straight from the
// `Transport` interface in `@modelcontextprotocol/sdk/shared/transport.d.ts`.
vi.mock(import("@modelcontextprotocol/sdk/server/stdio.js"), () => {
    // McpServer calls `new StdioServerTransport()`, so the mock must be a
    // constructable class. The contract surface is what the SDK's transport
    // base class declares — start/close/send return promises; onmessage and
    // friends are public mutable properties on the instance.
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

let originalEnv: typeof process.env;
let stderrSpy: MockInstance<(typeof process.stderr)["write"]>;
let tmpRoots: string[];

beforeEach(() => {
    originalEnv = { ...process.env };
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    tmpRoots = [];
});

afterEach(() => {
    process.env = originalEnv;
    stderrSpy.mockRestore();

    for (const root of tmpRoots) {
        rmSync(root, { force: true, recursive: true });
    }
});

const makeTmpRoot = (label: string): string => {
    const root = mkdtempSync(join(tmpdir(), `vis-mcp-${label}-`));

    tmpRoots.push(root);

    return root;
};

const stderrLines = (): string[] => stderrSpy.mock.calls.map((call) => String(call[0]));

describe(startMcpServer, () => {
    it("should honour VIS_MCP_VIS_BIN as an override and boot without touching the require resolver", async () => {
        expect.assertions(1);

        process.env.VIS_MCP_VIS_BIN = FAKE_VIS;
        process.env.VIS_MCP_WORKSPACE_ROOT = makeTmpRoot("override");

        await expect(startMcpServer()).resolves.toBeUndefined();
    });

    it("should write a [vis-mcp] ready banner to stderr after binding the transport", async () => {
        expect.assertions(1);

        process.env.VIS_MCP_VIS_BIN = FAKE_VIS;
        process.env.VIS_MCP_WORKSPACE_ROOT = makeTmpRoot("ready");

        await startMcpServer();

        const banners = stderrLines().filter((message) => message.includes("[vis-mcp] ready"));

        expect(banners.length).toBeGreaterThanOrEqual(1);
    });

    it("should default the workspace to process.cwd() when VIS_MCP_WORKSPACE_ROOT is unset", async () => {
        expect.assertions(1);

        delete process.env.VIS_MCP_WORKSPACE_ROOT;
        process.env.VIS_MCP_VIS_BIN = FAKE_VIS;

        // Override + cwd-as-default exercises the env-fallback branch on the
        // `workspaceRoot` line of startMcpServer.
        await expect(startMcpServer()).resolves.toBeUndefined();
    });

    it("should resolve `@visulima/vis` from the workspace's node_modules when no override is set", async () => {
        expect.assertions(2);

        delete process.env.VIS_MCP_VIS_BIN;

        // Build a synthetic workspace containing a node_modules/@visulima/vis
        // shim. The bin path is relative inside the synthetic package, and
        // resolveVisBin should join it against the package.json dir.
        const root = makeTmpRoot("ws-resolve");
        const pkgDir = join(root, "node_modules", "@visulima", "vis");

        mkdirSync(pkgDir, { recursive: true });
        writeFileSync(
            join(pkgDir, "package.json"),
            JSON.stringify({
                bin: { vis: "./shim.mjs" },
                name: "@visulima/vis",
                version: "0.0.0-test",
            }),
        );
        // Reuse the existing fake-vis as the shim so the rest of the wiring
        // (which never actually shells out at boot) doesn't matter.
        writeFileSync(join(pkgDir, "shim.mjs"), "process.exit(0);\n");
        // The workspace root itself needs a package.json — createRequire
        // anchors on it.
        writeFileSync(join(root, "package.json"), JSON.stringify({ name: "synthetic-ws" }));

        process.env.VIS_MCP_WORKSPACE_ROOT = root;

        await expect(startMcpServer()).resolves.toBeUndefined();

        // The banner should report the synthetic workspace root, not cwd.
        const banners = stderrLines().filter((message) => message.includes(root));

        expect(banners.length).toBeGreaterThanOrEqual(1);
    });

    it("should accept a `bin` declared as a string (not just an object)", async () => {
        expect.assertions(1);

        delete process.env.VIS_MCP_VIS_BIN;

        const root = makeTmpRoot("ws-bin-string");
        const pkgDir = join(root, "node_modules", "@visulima", "vis");

        mkdirSync(pkgDir, { recursive: true });
        writeFileSync(
            join(pkgDir, "package.json"),
            JSON.stringify({
                bin: "./shim.mjs",
                name: "@visulima/vis",
                version: "0.0.0-test",
            }),
        );
        writeFileSync(join(pkgDir, "shim.mjs"), "process.exit(0);\n");
        writeFileSync(join(root, "package.json"), JSON.stringify({ name: "synthetic-ws" }));

        process.env.VIS_MCP_WORKSPACE_ROOT = root;

        await expect(startMcpServer()).resolves.toBeUndefined();
    });

    it("should throw a helpful error when `@visulima/vis` is installed without a `vis` bin entry", async () => {
        expect.assertions(1);

        delete process.env.VIS_MCP_VIS_BIN;

        const root = makeTmpRoot("ws-no-bin");
        const pkgDir = join(root, "node_modules", "@visulima", "vis");

        mkdirSync(pkgDir, { recursive: true });
        writeFileSync(
            join(pkgDir, "package.json"),
            // Omit `bin` entirely — the resolver should locate the package
            // but reject for missing bin metadata.
            JSON.stringify({
                name: "@visulima/vis",
                version: "0.0.0-test",
            }),
        );
        writeFileSync(join(root, "package.json"), JSON.stringify({ name: "synthetic-ws" }));

        process.env.VIS_MCP_WORKSPACE_ROOT = root;

        await expect(startMcpServer()).rejects.toThrow(/does not declare a `vis` bin entry/);
    });
});
