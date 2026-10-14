import { mkdirSync, writeFileSync } from "node:fs";

import { strip } from "@visulima/colorize";
import { join } from "@visulima/path";
import { TrackedTaskExecutor } from "@visulima/task-runner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import runExecute from "../../../src/commands/run/handler";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../../test-helpers";

const silentLogger = { debug: () => undefined, error: () => undefined, info: () => undefined, warn: () => undefined };

const NOTICE = "tracker saw no workspace access; cached on declared inputs";

// A traced target that declares inputs. The tracker is stubbed to observe nothing, on every host,
// so the run takes the declared-fallback path.
const seedWorkspace = (workspaceRoot: string): void => {
    writeFileSync(join(workspaceRoot, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
    writeFileSync(join(workspaceRoot, "package.json"), JSON.stringify({ name: "root" }));

    const packageDir = join(workspaceRoot, "packages", "app");

    mkdirSync(packageDir, { recursive: true });
    writeFileSync(join(packageDir, "package.json"), JSON.stringify({ name: "@my/app" }));
    writeFileSync(join(packageDir, "input.txt"), "input\n");
    writeFileSync(
        join(packageDir, "project.json"),
        JSON.stringify({
            targets: {
                build: {
                    command: "echo built",
                    hashMode: "trace",
                    inputs: ["{projectRoot}/input.txt"],
                    outputs: [],
                },
            },
        }),
    );
};

describe("vis run declared-fallback notice", () => {
    let workspaceRoot: string;

    const runAndCapture = async (options: Record<string, unknown> = {}): Promise<string> => {
        const writes: string[] = [];
        const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
            writes.push(String(chunk));

            return true;
        });

        try {
            await runExecute({
                argument: ["build"],
                logger: silentLogger,
                options: { cache: true, cacheDir: join(workspaceRoot, ".cache"), parallel: 1, preflight: false, skipToolchain: true, ...options },
                runtime: {} as never,
                visConfig: undefined,
                workspaceRoot,
            } as never);
        } finally {
            stdoutSpy.mockRestore();
        }

        return strip(writes.join(""));
    };

    beforeEach(() => {
        workspaceRoot = createTemporaryDirectory("vis-declared-fallback-");
        seedWorkspace(workspaceRoot);

        vi.spyOn(TrackedTaskExecutor.prototype, "trackerKindFor").mockReturnValue("preload");
        vi.spyOn(TrackedTaskExecutor.prototype, "execute").mockResolvedValue({
            accesses: [],
            code: 0,
            hints: { cacheDisabled: false, ignoredInputs: [], ignoredOutputs: [], trackedEnv: [], trackedEnvPatterns: [] },
            terminalOutput: "built",
            tracker: "preload",
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        cleanupTemporaryDirectory(workspaceRoot);
    });

    it("prints the notice on the run that stores the fallback entry", async () => {
        expect.assertions(1);

        const output = await runAndCapture();

        expect(output).toContain(`@my/app:build: ${NOTICE}`);
    });

    it("does not repeat the notice on a cache hit", async () => {
        expect.assertions(2);

        await runAndCapture();

        const hit = await runAndCapture();

        expect(hit).toContain("[cache]");
        expect(hit).not.toContain(NOTICE);
    });

    it("stays silent under quiet output", async () => {
        expect.assertions(1);

        const output = await runAndCapture({ cacheDir: join(workspaceRoot, ".cache-quiet"), outputStyle: "quiet" });

        expect(output).not.toContain(NOTICE);
    });
});
