import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import configLoaderPlugin from "../../src/plugins/config-loader";

describe("configLoaderPlugin Deno warning", () => {
    let root: string;

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), "vis-deno-"));
    });

    afterEach(() => {
        rmSync(root, { force: true, recursive: true });
    });

    const run = async (): Promise<ReturnType<typeof vi.fn>> => {
        const warn = vi.fn();

        await configLoaderPlugin.beforeCommand?.({
            logger: { error: vi.fn(), info: vi.fn(), warn },
            options: { cwd: root },
        } as never);

        return warn;
    };

    it("warns when a project has Deno files and no JS lockfile", async () => {
        expect.hasAssertions();

        writeFileSync(join(root, "deno.lock"), "{}");

        const warn = await run();

        expect(warn).toHaveBeenCalledWith(expect.stringContaining("Deno is no longer supported"));
    });

    it("stays silent when a JS lockfile is present next to the Deno files", async () => {
        expect.hasAssertions();

        writeFileSync(join(root, "deno.json"), "{}");
        writeFileSync(join(root, "pnpm-lock.yaml"), "");

        const warn = await run();

        expect(warn).not.toHaveBeenCalledWith(expect.stringContaining("Deno is no longer supported"));
    });
});
