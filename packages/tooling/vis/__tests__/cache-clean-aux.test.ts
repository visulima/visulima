import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const aiClearMock = vi.fn(() => 0);
const socketClearMock = vi.fn(() => 0);

vi.mock(import("../src/ai/ai-cache"), async (importOriginal) => {
    const actual = await importOriginal<typeof import("../src/ai/ai-cache")>();

    return {
        ...actual,
        clearCache: aiClearMock,
    };
});

vi.mock(import("../src/security/socket-security"), async (importOriginal) => {
    const actual = await importOriginal<typeof import("../src/security/socket-security")>();

    return {
        ...actual,
        clearSocketCache: socketClearMock,
    };
});

const writeCacheEntry = (cacheDirectory: string, hash: string): void => {
    const entry = join(cacheDirectory, hash);

    mkdirSync(entry, { recursive: true });
    writeFileSync(join(entry, "code"), "0");
    writeFileSync(join(entry, "terminalOutput"), `output for ${hash}`);
    writeFileSync(join(entry, ".commit"), "");
};

describe("cacheCleanExecute --type filter", () => {
    let workspaceRoot: string;
    let cacheDirectory: string;

    beforeEach(() => {
        workspaceRoot = mkdtempSync(join(tmpdir(), "vis-cache-aux-ws-"));
        cacheDirectory = join(workspaceRoot, ".task-runner-cache");
        mkdirSync(cacheDirectory);
        writeCacheEntry(cacheDirectory, "hash1");
        aiClearMock.mockClear();
        aiClearMock.mockReturnValue(0);
        socketClearMock.mockClear();
        socketClearMock.mockReturnValue(0);
    });

    afterEach(() => {
        rmSync(workspaceRoot, { force: true, recursive: true });
    });

    const buildToolbox = (options: Record<string, unknown>): unknown => {
        return {
            argument: [],
            logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
            options,
            visConfig: undefined,
            workspaceRoot,
        };
    };

    it("clears every store on default --type=all", async () => {
        expect.assertions(2);

        const { cacheCleanExecute } = await import("../src/commands/cache/handler");

        await cacheCleanExecute(buildToolbox({ cacheDir: undefined, dryRun: false, force: false }) as never);

        expect(aiClearMock).toHaveBeenCalledTimes(1);
        expect(socketClearMock).toHaveBeenCalledTimes(1);
    });

    it("clears only the AI cache on --type=ai", async () => {
        expect.assertions(2);

        const { cacheCleanExecute } = await import("../src/commands/cache/handler");

        await cacheCleanExecute(buildToolbox({ cacheDir: undefined, dryRun: false, force: false, type: "ai" }) as never);

        expect(aiClearMock).toHaveBeenCalledTimes(1);
        expect(socketClearMock).not.toHaveBeenCalled();
    });

    it("clears only the Socket.dev cache on --type=socket", async () => {
        expect.assertions(2);

        const { cacheCleanExecute } = await import("../src/commands/cache/handler");

        await cacheCleanExecute(buildToolbox({ cacheDir: undefined, dryRun: false, force: false, type: "socket" }) as never);

        expect(aiClearMock).not.toHaveBeenCalled();
        expect(socketClearMock).toHaveBeenCalledTimes(1);
    });

    it("leaves both aux stores untouched on --type=task", async () => {
        expect.assertions(2);

        const { cacheCleanExecute } = await import("../src/commands/cache/handler");

        await cacheCleanExecute(buildToolbox({ cacheDir: undefined, dryRun: false, force: false, type: "task" }) as never);

        expect(aiClearMock).not.toHaveBeenCalled();
        expect(socketClearMock).not.toHaveBeenCalled();
    });

    it("skips every clear on --dry-run", async () => {
        expect.assertions(2);

        const { cacheCleanExecute } = await import("../src/commands/cache/handler");

        await cacheCleanExecute(buildToolbox({ cacheDir: undefined, dryRun: true, force: false }) as never);

        expect(aiClearMock).not.toHaveBeenCalled();
        expect(socketClearMock).not.toHaveBeenCalled();
    });

    it("continues to the Socket.dev clear when the AI clear throws", async () => {
        expect.assertions(2);

        aiClearMock.mockImplementationOnce(() => {
            throw new Error("EPERM: stale lockfile");
        });

        const { cacheCleanExecute } = await import("../src/commands/cache/handler");

        await cacheCleanExecute(buildToolbox({ cacheDir: undefined, dryRun: false, force: false }) as never);

        expect(aiClearMock).toHaveBeenCalledTimes(1);
        expect(socketClearMock).toHaveBeenCalledTimes(1);
    });
});
