// @vitest-environment node
import { resolve } from "node:path";

import type { ViteDevServer } from "vite";
import { beforeEach, describe, expect, it, vi } from "vitest";

const launchMock = vi.fn();

vi.mock(import("launch-editor"), () => {
    return { default: launchMock };
});

const { openInEditor } = await import("../../../src/rpc/functions/open-in-editor");

const makeServer = (root: string): ViteDevServer => ({ config: { root } }) as unknown as ViteDevServer;

describe("rpc/functions/open-in-editor", () => {
    beforeEach(() => {
        launchMock.mockClear();
    });

    describe(openInEditor, () => {
        it("resolves a relative file against server root and passes no position", async () => {
            expect.assertions(2);

            await openInEditor(makeServer("/project"), "src/index.ts");

            expect(launchMock).toHaveBeenCalledTimes(1);
            expect(launchMock).toHaveBeenCalledWith(resolve("/project", "src/index.ts"), undefined);
        });

        it("keeps an in-root absolute file path untouched", async () => {
            expect.assertions(1);

            await openInEditor(makeServer("/project"), "/project/abs/path/file.ts");

            expect(launchMock).toHaveBeenCalledWith(resolve("/project", "/project/abs/path/file.ts"), undefined);
        });

        it("appends line only when column is omitted", async () => {
            expect.assertions(1);

            await openInEditor(makeServer("/project"), "/project/abs/file.ts", 42);

            expect(launchMock).toHaveBeenCalledWith(`${resolve("/project", "/project/abs/file.ts")}:42`, undefined);
        });

        it("appends line and column when both are provided", async () => {
            expect.assertions(1);

            await openInEditor(makeServer("/project"), "/project/abs/file.ts", 42, 7);

            expect(launchMock).toHaveBeenCalledWith(`${resolve("/project", "/project/abs/file.ts")}:42:7`, undefined);
        });

        it("forwards the server-configured editor override", async () => {
            expect.assertions(1);

            await openInEditor(makeServer("/project"), "/project/abs/file.ts", 1, 1, "code");

            expect(launchMock).toHaveBeenCalledWith(`${resolve("/project", "/project/abs/file.ts")}:1:1`, "code");
        });

        it("rejects a file path outside the project root", async () => {
            expect.assertions(2);

            await expect(openInEditor(makeServer("/project"), "../../etc/passwd")).rejects.toThrow("outside project root");
            expect(launchMock).not.toHaveBeenCalled();
        });
    });
});
