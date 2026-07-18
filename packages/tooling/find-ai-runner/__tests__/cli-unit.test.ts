import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AiProviderInfo, AiRunResult } from "../src/index";

const detectAllProvidersAsync = vi.fn<() => Promise<AiProviderInfo[]>>();
const detectProvider = vi.fn<(name: string) => AiProviderInfo>();
const runProvider = vi.fn<() => Promise<AiRunResult>>();
const buildCliArgs = vi.fn<() => string[]>();

vi.mock(import("../src/index"), async (importOriginal) => {
    const actual = await importOriginal();

    return {
        ...actual,
        buildCliArgs: (...arguments_: Parameters<typeof actual.buildCliArgs>) => buildCliArgs(...arguments_),
        detectAllProvidersAsync: () => detectAllProvidersAsync(),
        detectProvider: (...arguments_: Parameters<typeof actual.detectProvider>) => detectProvider(...arguments_),
        runProvider: (...arguments_: Parameters<typeof actual.runProvider>) => runProvider(...arguments_),
    };
});

const VERSION_PATTERN = /^\d+\.\d+\.\d+/;
const noop = (): void => {};

const originalArgv = process.argv;
let logSpy: ReturnType<typeof vi.spyOn<Console, "log">>;
let errorSpy: ReturnType<typeof vi.spyOn<Console, "error">>;

/** Import the CLI module fresh so its top-level `main()` runs against the given argv. */
const runCli = async (arguments_: string[]): Promise<void> => {
    process.argv = ["node", "cli.js", ...arguments_];
    process.exitCode = undefined;
    vi.resetModules();

    await import("../src/cli");
};

const logOutput = (): string => logSpy.mock.calls.map((call) => String(call[0])).join("\n");

const errorOutput = (): string => errorSpy.mock.calls.map((call) => String(call[0])).join("\n");

const makeInfo = (overrides: Partial<AiProviderInfo> = {}): AiProviderInfo => {
    return {
        available: false,
        name: "claude",
        ...overrides,
    };
};

describe("cLI module", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        logSpy = vi.spyOn(console, "log").mockImplementation(noop);
        errorSpy = vi.spyOn(console, "error").mockImplementation(noop);
        detectAllProvidersAsync.mockResolvedValue([]);
        detectProvider.mockReturnValue(makeInfo());
        buildCliArgs.mockReturnValue([]);
        runProvider.mockResolvedValue({ provider: "claude", stderr: "", stdout: "" });
    });

    afterEach(() => {
        process.argv = originalArgv;
        process.exitCode = undefined;
        vi.restoreAllMocks();
    });

    describe("help and version", () => {
        it("should print usage with --help", async () => {
            expect.assertions(2);

            await runCli(["--help"]);

            expect(logOutput()).toContain("find-ai-runner - Detect and invoke AI CLI tools");
            expect(process.exitCode).toBeUndefined();
        });

        it("should print usage when no command is given", async () => {
            expect.assertions(1);

            await runCli([]);

            expect(logOutput()).toContain("Commands:");
        });

        it("should print the package version with --version", async () => {
            expect.assertions(2);

            await runCli(["--version"]);

            expect(logOutput()).toMatch(VERSION_PATTERN);
            expect(detectAllProvidersAsync).not.toHaveBeenCalled();
        });
    });

    describe("list command", () => {
        it("should report when no providers are detected", async () => {
            expect.assertions(1);

            detectAllProvidersAsync.mockResolvedValue([makeInfo({ available: false })]);

            await runCli(["list"]);

            expect(logOutput()).toContain("No AI CLI providers detected on this system.");
        });

        it("should print available and unavailable providers with version and path", async () => {
            expect.assertions(2);

            detectAllProvidersAsync.mockResolvedValue([
                makeInfo({ available: true, name: "claude", path: "/bin/claude", version: "1.2.3" }),
                makeInfo({ available: false, name: "gemini" }),
            ]);

            await runCli(["list"]);

            const output = logOutput();

            expect(output).toContain("claude (v1.2.3) - /bin/claude");
            expect(output).toContain("gemini");
        });

        it("should emit JSON with --json", async () => {
            expect.assertions(2);

            const providers = [makeInfo({ available: true, name: "claude" })];

            detectAllProvidersAsync.mockResolvedValue(providers);

            await runCli(["list", "--json"]);

            const parsed = JSON.parse(logOutput()) as AiProviderInfo[];

            expect(parsed).toHaveLength(1);
            expect(parsed[0]?.name).toBe("claude");
        });
    });

    describe("detect command", () => {
        it("should print details for an available provider", async () => {
            expect.assertions(2);

            detectProvider.mockReturnValue(makeInfo({ available: true, detectionMethod: "which", path: "/bin/claude", version: "1.0.0" }));

            await runCli(["detect", "claude"]);

            const output = logOutput();

            expect(output).toContain("claude is available");
            expect(output).toContain("Detected via: which");
        });

        it("should print unknown placeholders when fields are missing", async () => {
            expect.assertions(3);

            detectProvider.mockReturnValue(makeInfo({ available: true }));

            await runCli(["detect", "claude"]);

            const output = logOutput();

            expect(output).toContain("Path: unknown");
            expect(output).toContain("Version: unknown");
            expect(output).toContain("Detected via: unknown");
        });

        it("should report an unavailable provider", async () => {
            expect.assertions(1);

            detectProvider.mockReturnValue(makeInfo({ available: false }));

            await runCli(["detect", "claude"]);

            expect(logOutput()).toContain("claude is not available on this system.");
        });

        it("should emit JSON with --json", async () => {
            expect.assertions(1);

            detectProvider.mockReturnValue(makeInfo({ available: true, name: "claude" }));

            await runCli(["detect", "claude", "--json"]);

            const parsed = JSON.parse(logOutput()) as AiProviderInfo;

            expect(parsed.name).toBe("claude");
        });

        it("should fail when no provider name is given", async () => {
            expect.assertions(2);

            await runCli(["detect"]);

            expect(errorOutput()).toContain("provider name required");
            expect(process.exitCode).toBe(1);
        });

        it("should fail for an unknown provider", async () => {
            expect.assertions(2);

            await runCli(["detect", "nonexistent"]);

            expect(errorOutput()).toContain("unknown provider \"nonexistent\"");
            expect(process.exitCode).toBe(1);
        });
    });

    describe("run command", () => {
        it("should run a provider and print stdout", async () => {
            expect.assertions(2);

            detectProvider.mockReturnValue(makeInfo({ available: true, path: "/bin/claude" }));
            runProvider.mockResolvedValue({ provider: "claude", stderr: "", stdout: "the answer" });

            await runCli(["run", "claude", "explain", "this"]);

            expect(runProvider).toHaveBeenCalledWith(expect.objectContaining({ available: true }), "explain this", expect.any(Object));
            expect(logOutput()).toContain("the answer");
        });

        it("should print stderr to console.error when present", async () => {
            expect.assertions(1);

            detectProvider.mockReturnValue(makeInfo({ available: true, path: "/bin/claude" }));
            runProvider.mockResolvedValue({ provider: "claude", stderr: "a warning", stdout: "ok" });

            await runCli(["run", "claude", "hello"]);

            expect(errorOutput()).toContain("a warning");
        });

        it("should forward model, max-tokens, and timeout options", async () => {
            expect.assertions(1);

            detectProvider.mockReturnValue(makeInfo({ available: true, path: "/bin/claude" }));

            await runCli(["run", "claude", "hello", "--model", "opus", "--max-tokens", "2048", "--timeout", "1000"]);

            expect(runProvider).toHaveBeenCalledWith(expect.any(Object), "hello", {
                dangerous: false,
                maxTokens: 2048,
                model: "opus",
                timeoutMs: 1000,
            });
        });

        it("should forward the dangerous flag when --dangerous is passed", async () => {
            expect.assertions(1);

            detectProvider.mockReturnValue(makeInfo({ available: true, path: "/bin/claude" }));

            await runCli(["run", "claude", "hello", "--dangerous"]);

            expect(runProvider).toHaveBeenCalledWith(expect.any(Object), "hello", expect.objectContaining({ dangerous: true }));
        });

        it("should warn about an unknown flag and still run", async () => {
            expect.assertions(2);

            detectProvider.mockReturnValue(makeInfo({ available: true, path: "/bin/claude" }));

            await runCli(["run", "claude", "hello", "--mdoel", "opus"]);

            expect(errorOutput()).toContain("unknown option \"--mdoel\"");
            expect(runProvider).toHaveBeenCalledTimes(1);
        });

        it("should fail when the provider is not available", async () => {
            expect.assertions(2);

            detectProvider.mockReturnValue(makeInfo({ available: false }));

            await runCli(["run", "claude", "hello"]);

            expect(errorOutput()).toContain("claude is not available on this system.");
            expect(process.exitCode).toBe(1);
        });

        it("should fail without a provider", async () => {
            expect.assertions(2);

            await runCli(["run"]);

            expect(errorOutput()).toContain("provider and prompt required");
            expect(process.exitCode).toBe(1);
        });

        it("should fail without a prompt", async () => {
            expect.assertions(2);

            await runCli(["run", "claude"]);

            expect(errorOutput()).toContain("provider and prompt required");
            expect(process.exitCode).toBe(1);
        });

        it("should fail for an unknown provider", async () => {
            expect.assertions(2);

            await runCli(["run", "nonexistent", "hello"]);

            expect(errorOutput()).toContain("unknown provider");
            expect(process.exitCode).toBe(1);
        });

        it("should set exit code 1 when runProvider rejects", async () => {
            expect.assertions(2);

            detectProvider.mockReturnValue(makeInfo({ available: true, path: "/bin/claude" }));
            runProvider.mockRejectedValue(new Error("spawn blew up"));

            await runCli(["run", "claude", "hello"]);

            expect(errorOutput()).toContain("Error: spawn blew up");
            expect(process.exitCode).toBe(1);
        });
    });

    describe("args command", () => {
        it("should print space-joined args", async () => {
            expect.assertions(1);

            buildCliArgs.mockReturnValue(["-p", "hello world"]);

            await runCli(["args", "claude", "hello", "world"]);

            expect(logOutput()).toBe("-p hello world");
        });

        it("should emit JSON args with --json", async () => {
            expect.assertions(1);

            buildCliArgs.mockReturnValue(["-p", "hi"]);

            await runCli(["args", "claude", "hi", "--json"]);

            const parsed = JSON.parse(logOutput()) as string[];

            expect(parsed).toStrictEqual(["-p", "hi"]);
        });

        it("should forward model and max-tokens to buildCliArgs", async () => {
            expect.assertions(1);

            buildCliArgs.mockReturnValue([]);

            await runCli(["args", "claude", "hi", "--model", "opus", "--max-tokens", "999"]);

            expect(buildCliArgs).toHaveBeenCalledWith("claude", "hi", { dangerous: false, maxTokens: 999, model: "opus" });
        });

        it("should fail without a prompt", async () => {
            expect.assertions(2);

            await runCli(["args", "claude"]);

            expect(errorOutput()).toContain("provider and prompt required");
            expect(process.exitCode).toBe(1);
        });

        it("should fail for an unknown provider", async () => {
            expect.assertions(2);

            await runCli(["args", "nonexistent", "hello"]);

            expect(errorOutput()).toContain("unknown provider");
            expect(process.exitCode).toBe(1);
        });
    });

    describe("unknown command", () => {
        it("should fail and print usage", async () => {
            expect.assertions(3);

            await runCli(["foobar"]);

            expect(errorOutput()).toContain("Unknown command: foobar");
            expect(logOutput()).toContain("find-ai-runner - Detect and invoke AI CLI tools");
            expect(process.exitCode).toBe(1);
        });
    });
});
