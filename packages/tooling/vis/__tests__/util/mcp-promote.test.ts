import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock(import("is-in-ci"), () => {
    return { default: false };
});

vi.mock(import("@visulima/fs"), async (importOriginal) => {
    const actual = await importOriginal();

    return {
        ...actual,
        ensureDirSync: vi.fn(),
        isAccessibleSync: vi.fn().mockReturnValue(false),
        readJsonSync: vi.fn(),
        writeFileSync: vi.fn(),
    };
});

const fs = await import("@visulima/fs");
const { arrayHasVisMcp, detectAiClis, mapHasVisMcp, showMcpPromote, VIS_MCP_PACKAGE } = await import("../../src/util/mcp-promote");

const isAccessibleSync = vi.mocked(fs.isAccessibleSync);
const readJsonSync = vi.mocked(fs.readJsonSync);
const writeFileSync = vi.mocked(fs.writeFileSync);

describe("mapHasVisMcp", () => {
    it("returns false for non-objects", () => {
        expect.assertions(3);

        expect(mapHasVisMcp(undefined)).toBe(false);
        expect(mapHasVisMcp(null)).toBe(false);
        expect(mapHasVisMcp("string")).toBe(false);
    });

    it("returns true when an entry references @visulima/vis-mcp", () => {
        expect.assertions(1);

        expect(
            mapHasVisMcp({
                vis: { args: ["-y", "@visulima/vis-mcp@latest"], command: "npx" },
            }),
        ).toBe(true);
    });

    it("returns true when an entry references the bare vis-mcp binary", () => {
        expect.assertions(1);

        expect(mapHasVisMcp({ anything: { command: "vis-mcp" } })).toBe(true);
    });

    it("returns false when no entry mentions vis-mcp", () => {
        expect.assertions(1);

        expect(
            mapHasVisMcp({
                other: { args: ["-y", "@modelcontextprotocol/server-foo"], command: "npx" },
            }),
        ).toBe(false);
    });
});

describe("arrayHasVisMcp", () => {
    it("returns false for non-arrays", () => {
        expect.assertions(2);

        expect(arrayHasVisMcp(undefined)).toBe(false);
        expect(arrayHasVisMcp({})).toBe(false);
    });

    it("returns true when an entry's name is vis-mcp", () => {
        expect.assertions(1);

        expect(arrayHasVisMcp([{ command: "npx", name: "vis-mcp" }])).toBe(true);
    });

    it("returns true when entry args reference @visulima/vis-mcp", () => {
        expect.assertions(1);

        expect(arrayHasVisMcp([{ args: ["-y", "@visulima/vis-mcp@latest"], command: "npx", name: "vis" }])).toBe(true);
    });

    it("returns false when no entry mentions vis-mcp", () => {
        expect.assertions(1);

        expect(arrayHasVisMcp([{ command: "npx", name: "other" }])).toBe(false);
    });
});

describe("showMcpPromote", () => {
    let stderrSpy: ReturnType<typeof vi.spyOn>;
    let originalIsTty: boolean | undefined;

    beforeEach(() => {
        stderrSpy = vi.spyOn(process.stderr, "write").mockReturnValue(true);
        originalIsTty = process.stderr.isTTY;
        delete process.env["VIS_CLI_TEST"];
        delete process.env["VIS_NO_MCP_PROMOTE"];
        isAccessibleSync.mockReset().mockReturnValue(false);
        readJsonSync.mockReset();
        writeFileSync.mockReset();
    });

    afterEach(() => {
        stderrSpy.mockRestore();
        process.stderr.isTTY = originalIsTty;
    });

    it("does not show notice when command failed", () => {
        expect.assertions(1);

        process.stderr.isTTY = true;
        showMcpPromote({ success: false });

        expect(stderrSpy).not.toHaveBeenCalled();
    });

    it("does not show notice when VIS_CLI_TEST is set", () => {
        expect.assertions(1);

        process.stderr.isTTY = true;
        process.env["VIS_CLI_TEST"] = "1";
        showMcpPromote({ success: true });

        expect(stderrSpy).not.toHaveBeenCalled();
    });

    it("does not show notice when VIS_NO_MCP_PROMOTE=1 is set", () => {
        expect.assertions(1);

        process.stderr.isTTY = true;
        process.env["VIS_NO_MCP_PROMOTE"] = "1";
        showMcpPromote({ success: true });

        expect(stderrSpy).not.toHaveBeenCalled();
    });

    it("does not show notice when mcpPromote.enabled is false in visConfig", () => {
        expect.assertions(1);

        process.stderr.isTTY = true;
        showMcpPromote({ success: true, visConfig: { mcpPromote: { enabled: false } } });

        expect(stderrSpy).not.toHaveBeenCalled();
    });

    it("does not show notice on non-TTY stderr", () => {
        expect.assertions(1);

        process.stderr.isTTY = false;
        showMcpPromote({ success: true });

        expect(stderrSpy).not.toHaveBeenCalled();
    });

    it("does not show notice for excluded commands", () => {
        expect.assertions(1);

        process.stderr.isTTY = true;
        // Pretend Claude Code is installed and unconfigured — it should still skip
        // because the command itself is `ai`.
        isAccessibleSync.mockReturnValue(true);
        readJsonSync.mockReturnValue({ mcpServers: {} });

        showMcpPromote({ command: "ai", success: true });

        expect(stderrSpy).not.toHaveBeenCalled();
    });

    it("does not show notice when no AI CLI is installed", () => {
        expect.assertions(1);

        process.stderr.isTTY = true;
        isAccessibleSync.mockReturnValue(false);

        showMcpPromote({ command: "run", success: true });

        expect(stderrSpy).not.toHaveBeenCalled();
    });

    it("does not show notice when every detected CLI already has vis-mcp", () => {
        expect.assertions(1);

        process.stderr.isTTY = true;
        // All filesystem probes succeed; every config has vis wired in.
        isAccessibleSync.mockReturnValue(true);
        readJsonSync.mockReturnValue({
            context_servers: { vis: { args: ["-y", "@visulima/vis-mcp@latest"], command: "npx" } },
            mcpServers: { vis: { args: ["-y", "@visulima/vis-mcp@latest"], command: "npx" } },
        });

        showMcpPromote({ command: "run", success: true });

        expect(stderrSpy).not.toHaveBeenCalled();
    });

    it("does not show notice when CI is set", async () => {
        expect.assertions(1);

        vi.resetModules();
        vi.doMock(import("is-in-ci"), () => {
            return { default: true };
        });
        const { showMcpPromote: showCi } = await import("../../src/util/mcp-promote");

        process.stderr.isTTY = true;
        showCi({ command: "run", success: true });

        expect(stderrSpy).not.toHaveBeenCalled();

        vi.resetModules();
        vi.doMock(import("is-in-ci"), () => {
            return { default: false };
        });
    });

    it("does not show notice when rate-limit window is still open", () => {
        expect.assertions(2);

        process.stderr.isTTY = true;
        // Pretend an unconfigured Claude Code is installed AND the state
        // file holds a "lastShown" stamp from a few seconds ago.
        isAccessibleSync.mockReturnValue(true);
        readJsonSync.mockImplementation((path: string) => {
            if (path.endsWith("mcp-promote.json")) {
                return { lastShown: Date.now() - 1000 };
            }

            return { mcpServers: {} };
        });

        showMcpPromote({ command: "run", success: true });

        expect(stderrSpy).not.toHaveBeenCalled();
        expect(writeFileSync).not.toHaveBeenCalled();
    });

    it("shows the notice and writes state for an unconfigured Claude Code install", () => {
        expect.assertions(4);

        process.stderr.isTTY = true;
        // ~/.claude/ exists; ~/.claude.json has no mcpServers; the state
        // file does not yet exist (default mock returns false for it).
        isAccessibleSync.mockImplementation((path: string) => path.endsWith(".claude") || path.endsWith(".claude.json"));
        readJsonSync.mockImplementation((path: string) => {
            if (path.endsWith(".claude.json")) {
                return {};
            }

            // mcp-promote.json — not accessible, but readJsonSync isn't called for it.
            return {};
        });

        showMcpPromote({ command: "run", success: true });

        expect(stderrSpy).toHaveBeenCalledTimes(1);

        const output = stderrSpy.mock.calls[0]?.[0] as string;

        expect(output).toContain("Claude Code");
        expect(output).toContain(`claude mcp add vis -- npx -y ${VIS_MCP_PACKAGE}@latest`);

        expect(writeFileSync).toHaveBeenCalledTimes(1);
    });
});

describe("detectAiClis (Cline regression)", () => {
    beforeEach(() => {
        isAccessibleSync.mockReset().mockReturnValue(false);
        readJsonSync.mockReset();
    });

    it("does not flag Cline as installed when only ~/.vscode/extensions exists", () => {
        expect.assertions(1);

        // Simulate a VS Code user without Cline: ~/.vscode/extensions
        // exists but the cline_mcp_settings.json file does not.
        isAccessibleSync.mockImplementation((path: string) => path.endsWith("extensions") && !path.includes("globalStorage"));

        const cline = detectAiClis().find((c) => c.id === "cline");

        expect(cline?.isInstalled).toBe(false);
    });

    it("flags Cline as installed when cline_mcp_settings.json is present", () => {
        expect.assertions(2);

        isAccessibleSync.mockImplementation((path: string) => path.endsWith("cline_mcp_settings.json"));
        readJsonSync.mockReturnValue({ mcpServers: {} });

        const cline = detectAiClis().find((c) => c.id === "cline");

        expect(cline?.isInstalled).toBe(true);
        expect(cline?.isConfigured).toBe(false);
    });
});
