import { describe, expect, it, vi } from "vitest";

import type { CerebroFs, Toolbox } from "../../src";
import { Cerebro as Cli } from "../../src";

const COMMAND_NOT_FOUND_RE = /Command "?nonexistent"? .*not found/i;
const NO_HANDLER_RE = /no execute or loader/i;

describe("runtime injection", () => {
    describe("toolbox.process", () => {
        it("exposes cwd from CliOptions", async () => {
            expect.assertions(1);

            let captured: string | undefined;
            const cli = new Cli("test", { argv: ["go"], cwd: "/virtual/project" });

            cli.addCommand({
                execute: ({ process }: Toolbox) => {
                    captured = process.cwd;
                },
                name: "go",
            });

            await cli.run({ shouldExitProcess: false });

            expect(captured).toBe("/virtual/project");
        });

        it("exposes env override when provided", async () => {
            expect.assertions(1);

            let captured: Record<string, string | undefined> | undefined;
            const envSnapshot = { API_KEY: "secret-xyz", NODE_ENV: "test" };
            const cli = new Cli("test", { argv: ["go"], env: envSnapshot });

            cli.addCommand({
                execute: ({ process }: Toolbox) => {
                    captured = process.env;
                },
                name: "go",
            });

            await cli.run({ shouldExitProcess: false });

            expect(captured).toStrictEqual(envSnapshot);
        });

        it("exposes stdin buffer", async () => {
            expect.assertions(1);

            let captured: string | undefined;
            const cli = new Cli("test", { argv: ["go"], stdin: "piped input here" });

            cli.addCommand({
                execute: ({ process }: Toolbox) => {
                    captured = process.stdin;
                },
                name: "go",
            });

            await cli.run({ shouldExitProcess: false });

            expect(captured).toBe("piped input here");
        });

        it("calls injected exit instead of global process.exit", async () => {
            expect.assertions(2);

            const exitSpy = vi.fn();
            const cli = new Cli("test", { argv: ["go"], exit: exitSpy });

            cli.addCommand({
                execute: ({ process }: Toolbox) => {
                    // eslint-disable-next-line unicorn/no-process-exit -- exercising the injected exit, not the global
                    process.exit(42);
                },
                name: "go",
            });

            await cli.run({ shouldExitProcess: false });

            expect(exitSpy).toHaveBeenCalledTimes(1);
            expect(exitSpy).toHaveBeenCalledWith(42);
        });

        it("exposes platform and arch from runtime", async () => {
            expect.assertions(2);

            let capturedPlatform: string | undefined;
            let capturedArch: string | undefined;
            const cli = new Cli("test", { argv: ["go"] });

            cli.addCommand({
                execute: ({ process }: Toolbox) => {
                    capturedPlatform = process.platform;
                    capturedArch = process.arch;
                },
                name: "go",
            });

            await cli.run({ shouldExitProcess: false });

            expect(capturedPlatform).toBeTypeOf("string");
            expect(capturedArch).toBeTypeOf("string");
        });

        it("exposes argv as the constructor's argv option", async () => {
            expect.assertions(1);

            let captured: ReadonlyArray<string> | undefined;
            const cli = new Cli("test", { argv: ["go", "alpha", "beta"] });

            cli.addCommand({
                argument: { name: "items", type: String },
                execute: ({ process }: Toolbox) => {
                    captured = process.argv;
                },
                name: "go",
            });

            await cli.run({ shouldExitProcess: false });

            expect(captured).toStrictEqual(["go", "alpha", "beta"]);
        });
    });

    describe("toolbox.env", () => {
        it("reads command env definitions from the CliOptions.env override, not the host env", async () => {
            expect.assertions(1);

            // Prove the override wins even when the host env has a different value.
            process.env.API_KEY = "host-value";

            let captured: unknown;
            const cli = new Cli("test", { argv: ["go"], env: { API_KEY: "override-value" } });

            cli.addCommand({
                env: [{ name: "API_KEY", type: String }],
                execute: ({ env }: Toolbox) => {
                    captured = env.apiKey;
                },
                name: "go",
            });

            try {
                await cli.run({ shouldExitProcess: false });
            } finally {
                delete process.env.API_KEY;
            }

            expect(captured).toBe("override-value");
        });
    });

    describe("toolbox.fs", () => {
        it("uses injected fs adapter when provided", async () => {
            expect.assertions(2);

            const fakeFs = {
                access: vi.fn().mockResolvedValue(undefined),
                mkdir: vi.fn().mockResolvedValue(undefined),
                readdir: vi.fn().mockResolvedValue([]),
                readFile: vi.fn().mockResolvedValue("hello world"),
                rm: vi.fn().mockResolvedValue(undefined),
                stat: vi.fn().mockResolvedValue({ isDirectory: () => false, isFile: () => true }),
                writeFile: vi.fn().mockResolvedValue(undefined),
            } as unknown as CerebroFs;

            const cli = new Cli("test", { argv: ["read"], fs: fakeFs });

            let captured: string | Uint8Array | undefined;

            cli.addCommand({
                execute: async ({ fs }: Toolbox) => {
                    captured = await fs.readFile("/some/path", "utf8");
                    await fs.writeFile("/other/path", "data", "utf8");
                },
                name: "read",
            });

            await cli.run({ shouldExitProcess: false });

            expect(captured).toBe("hello world");
            expect(fakeFs.writeFile).toHaveBeenCalledWith("/other/path", "data", "utf8");
        });

        it("defaults to node:fs/promises when no fs is injected", async () => {
            expect.assertions(2);

            let captured: { hasAccess: boolean; hasReadFile: boolean } | undefined;
            const cli = new Cli("test", { argv: ["check"] });

            cli.addCommand({
                execute: ({ fs }: Toolbox) => {
                    captured = {
                        hasAccess: typeof fs.access === "function",
                        hasReadFile: typeof fs.readFile === "function",
                    };
                },
                name: "check",
            });

            await cli.run({ shouldExitProcess: false });

            expect(captured?.hasAccess).toBe(true);
            expect(captured?.hasReadFile).toBe(true);
        });
    });

    describe("toolbox.console", () => {
        it("is the same reference as toolbox.logger", async () => {
            expect.assertions(1);

            let isSameReference: boolean | undefined;
            const cli = new Cli("test", { argv: ["go"] });

            cli.addCommand({
                execute: ({ console: consoleApi, logger }: Toolbox) => {
                    isSameReference = consoleApi === logger;
                },
                name: "go",
            });

            await cli.run({ shouldExitProcess: false });

            expect(isSameReference).toBe(true);
        });

        it("uses the injected logger object", async () => {
            expect.assertions(1);

            const calls: string[] = [];
            const fakeLogger = {
                debug: vi.fn(),
                error: vi.fn(),
                info: vi.fn(),
                log: vi.fn((...args: unknown[]) => calls.push(String(args[0]))),
                warn: vi.fn(),
            } as unknown as Console;

            const cli = new Cli("test", { argv: ["go"], logger: fakeLogger });

            cli.addCommand({
                execute: ({ console: consoleApi }: Toolbox) => {
                    consoleApi.log("hello from console alias");
                },
                name: "go",
            });

            await cli.run({ shouldExitProcess: false });

            expect(calls).toStrictEqual(["hello from console alias"]);
        });
    });
});

// eslint-disable-next-line vitest/prefer-lowercase-title -- referencing the class.method API surface
describe("Cli.clone", () => {
    it("creates an independent instance that shares commands", async () => {
        expect.assertions(3);

        const original = new Cli("test", { argv: ["build"] });
        const executeSpy = vi.fn();

        original.addCommand({ execute: executeSpy, name: "build" });

        const clone = original.clone();

        expect(clone).not.toBe(original);
        expect(clone.getCommands().get("build")).toBe(original.getCommands().get("build"));

        await clone.run({ shouldExitProcess: false });

        expect(executeSpy).toHaveBeenCalledTimes(1);
    });

    it("applies option overrides without mutating the original", async () => {
        expect.assertions(2);

        const originalExit = vi.fn();
        const cloneExit = vi.fn();
        const original = new Cli("test", { argv: ["go"], exit: originalExit });

        original.addCommand({
            execute: ({ process }: Toolbox) => {
                // eslint-disable-next-line unicorn/no-process-exit -- exercising the injected exit
                process.exit(1);
            },
            name: "go",
        });

        const clone = original.clone({ exit: cloneExit });

        await clone.run({ shouldExitProcess: false });

        expect(cloneExit).toHaveBeenCalledWith(1);
        expect(originalExit).not.toHaveBeenCalled();
    });

    it("keeps verbosity isolated between two clones with their own env overrides", async () => {
        expect.assertions(2);

        const original = new Cli("test", { argv: ["show"] });
        const levels: Record<string, string | undefined> = {};

        original.addCommand({
            execute: ({ options, process }: Toolbox) => {
                levels[options.tag as string] = process.env.CEREBRO_OUTPUT_LEVEL;
            },
            name: "show",
            options: [{ name: "tag", type: String }],
        });

        const verboseEnv: Record<string, string | undefined> = {};
        const quietEnv: Record<string, string | undefined> = {};

        const verboseClone = original.clone({ argv: ["show", "--tag", "verbose", "--verbose"], env: verboseEnv });
        const quietClone = original.clone({ argv: ["show", "--tag", "quiet", "--quiet"], env: quietEnv });

        await verboseClone.run({ shouldExitProcess: false });
        await quietClone.run({ shouldExitProcess: false });

        // Each instance writes its level into its own env override, not a shared one.
        expect(verboseEnv.CEREBRO_OUTPUT_LEVEL).toBe("64");
        expect(quietEnv.CEREBRO_OUTPUT_LEVEL).toBe("16");
    });

    it("adding a command to the clone does not affect the original", () => {
        expect.assertions(2);

        const original = new Cli("test");

        original.addCommand({ execute: vi.fn(), name: "build" });

        const clone = original.clone();

        clone.addCommand({ execute: vi.fn(), name: "deploy" });

        expect(original.getCommands().has("deploy")).toBe(false);
        expect(clone.getCommands().has("deploy")).toBe(true);
    });

    it("copies custom global options onto the clone", () => {
        expect.assertions(2);

        const original = new Cli("test");

        original.addGlobalOption({ description: "Override working directory", name: "workdir", type: String });

        const clone = original.clone();

        expect(clone.getGlobalOptions().some((option) => option.name === "workdir")).toBe(true);

        // The clone owns a separate array, so adding to it does not mutate the original.
        clone.addGlobalOption({ description: "Extra", name: "extra", type: String });

        expect(original.getGlobalOptions().some((option) => option.name === "extra")).toBe(false);
    });

    it("applies argv override on the clone without mutating the original", async () => {
        expect.assertions(2);

        const calls: string[] = [];
        const original = new Cli("test", { argv: ["greet", "alice"] });

        original.addCommand({
            argument: { name: "name", type: String },
            execute: ({ argument }: Toolbox) => {
                calls.push(argument.join(","));
            },
            name: "greet",
        });

        const clone = original.clone({ argv: ["greet", "bob"] });

        await clone.run({ shouldExitProcess: false });
        await original.run({ shouldExitProcess: false });

        expect(calls).toContain("bob");
        expect(calls).toContain("alice");
    });
});

// eslint-disable-next-line vitest/prefer-lowercase-title -- referencing the class.method API surface
describe("Cli.getAction", () => {
    it("returns the execute function for eager commands", async () => {
        expect.assertions(2);

        const cli = new Cli("test");
        const executeFunction = vi.fn();

        cli.addCommand({ execute: executeFunction, name: "build" });

        const action = await cli.getAction("build");

        expect(action).toBe(executeFunction);

        await action({} as unknown as Toolbox);

        expect(executeFunction).toHaveBeenCalledTimes(1);
    });

    it("resolves the loader for lazy commands", async () => {
        expect.assertions(2);

        const cli = new Cli("test");
        const lazyExecute = vi.fn();

        cli.addCommand({
            // eslint-disable-next-line @typescript-eslint/require-await -- loader signature is `async`
            loader: async () => {
                return { default: lazyExecute };
            },
            name: "lazy",
        });

        const action = await cli.getAction("lazy");

        expect(action).toBe(lazyExecute);

        await action({} as unknown as Toolbox);

        expect(lazyExecute).toHaveBeenCalledTimes(1);
    });

    it("supports space-separated nested command paths", async () => {
        expect.assertions(1);

        const cli = new Cli("test");
        const executeFunction = vi.fn();

        cli.addCommand({
            commandPath: ["git", "remote"],
            execute: executeFunction,
            name: "add",
        });

        const action = await cli.getAction("git remote add");

        expect(action).toBe(executeFunction);
    });

    it("throws CommandNotFoundError for missing commands", async () => {
        expect.assertions(1);

        const cli = new Cli("test");

        cli.addCommand({ execute: vi.fn(), name: "build" });

        await expect(cli.getAction("nonexistent")).rejects.toThrow(COMMAND_NOT_FOUND_RE);
    });

    it("throws when the command has neither execute nor loader", async () => {
        expect.assertions(1);

        const cli = new Cli("test");

        // Build a command object directly so addCommand's validation can be
        // bypassed — this models a runtime-injected command whose handler
        // was stripped at some point (broken plugin, hot-reload race).
        const brokenCommand = { description: "broken", name: "broken" } as never;

        (cli as unknown as { getCommands: () => Map<string, unknown> }).getCommands().set("broken", brokenCommand);

        await expect(cli.getAction("broken")).rejects.toThrow(NO_HANDLER_RE);
    });
});
