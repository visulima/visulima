import { existsSync, promises as fs, readFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import ignoreExecute from "../../../src/commands/ignore/handler";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../../test-helpers";

type LoggerCall = [string, ...unknown[]];

const makeLogger = (): { calls: LoggerCall[]; logger: Pick<Console, "error" | "info"> } => {
    const calls: LoggerCall[] = [];

    return {
        calls,
        logger: {
            error: (...args) => calls.push(["error", ...args]),
            info: (...args) => calls.push(["info", ...args]),
        },
    };
};

const callText = (calls: LoggerCall[]): string => calls.map((c) => c.slice(1).join(" ")).join("\n");

describe("vis ignore (generator)", () => {
    let workspaceRoot: string;

    const makeToolbox = (logger: ReturnType<typeof makeLogger>["logger"], options: Record<string, unknown> = {}) =>
        ({
            argument: [],
            fs,
            logger,
            options,
            process: { cwd: workspaceRoot },
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        }) as never;

    beforeEach(() => {
        workspaceRoot = createTemporaryDirectory("vis-ignore-cmd-");
    });

    afterEach(() => {
        cleanupTemporaryDirectory(workspaceRoot);
    });

    it("writes a deduped .dockerignore and is idempotent", async () => {
        expect.assertions(4);

        const first = makeLogger();

        await ignoreExecute(makeToolbox(first.logger, { write: true }));

        const path = join(workspaceRoot, ".dockerignore");

        expect(existsSync(path)).toBe(true);

        const content = readFileSync(path, "utf8");

        expect(content).toContain("node_modules");
        expect(content).toContain(".git");

        const second = makeLogger();

        await ignoreExecute(makeToolbox(second.logger, { write: true }));

        expect(callText(second.calls)).toMatch(/already up to date/);
    });

    it("honors --target=vercel", async () => {
        expect.assertions(1);

        const { logger } = makeLogger();

        await ignoreExecute(makeToolbox(logger, { target: "vercel", write: true }));

        expect(existsSync(join(workspaceRoot, ".vercelignore"))).toBe(true);
    });

    it("rejects an unknown target", async () => {
        expect.assertions(1);

        const { logger } = makeLogger();

        await expect(ignoreExecute(makeToolbox(logger, { target: "bogus" }))).rejects.toThrow(/Invalid --target/);
    });
});
