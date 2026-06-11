import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { platform } from "node:os";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AiProviderInfo } from "../src/index";
import { buildCliArgs, detectAllProviders, detectAvailableProviders, detectProvider, PROVIDER_NAMES, PROVIDERS, runProvider } from "../src/index";

const IS_WINDOWS = platform() === "win32";
const WHICH_CMD = IS_WINDOWS ? "where" : "which";

vi.mock(import("node:child_process"), () => {
    return {
        execFileSync: vi.fn<typeof execFileSync>(),
        spawn: vi.fn<typeof import("node:child_process").spawn>(),
    };
});

vi.mock(import("node:fs"), () => {
    return {
        existsSync: vi.fn<typeof existsSync>(() => false),
    };
});

const mockExecFileSync = vi.mocked(execFileSync);
const mockExistsSync = vi.mocked(existsSync);

// --- PROVIDERS ---

describe("pROVIDERS", () => {
    it("should define all 11 providers", () => {
        expect.assertions(12);

        expect(Object.keys(PROVIDERS)).toHaveLength(11);
        expect(PROVIDERS.claude).toBeDefined();
        expect(PROVIDERS.gemini).toBeDefined();
        expect(PROVIDERS.codex).toBeDefined();
        expect(PROVIDERS.copilot).toBeDefined();
        expect(PROVIDERS.cursor).toBeDefined();
        expect(PROVIDERS.crush).toBeDefined();
        expect(PROVIDERS.amp).toBeDefined();
        expect(PROVIDERS.kimi).toBeDefined();
        expect(PROVIDERS.qwen).toBeDefined();
        expect(PROVIDERS.opencode).toBeDefined();
        expect(PROVIDERS.droid).toBeDefined();
    });

    it("should define environment variables for each provider", () => {
        expect.assertions(11);

        expect(PROVIDERS.claude.envVariable).toBe("CLAUDE_PATH");
        expect(PROVIDERS.gemini.envVariable).toBe("GEMINI_PATH");
        expect(PROVIDERS.codex.envVariable).toBe("CODEX_PATH");
        expect(PROVIDERS.copilot.envVariable).toBe("COPILOT_PATH");
        expect(PROVIDERS.cursor.envVariable).toBe("CURSOR_PATH");
        expect(PROVIDERS.crush.envVariable).toBe("CRUSH_PATH");
        expect(PROVIDERS.amp.envVariable).toBe("AMP_PATH");
        expect(PROVIDERS.kimi.envVariable).toBe("KIMI_PATH");
        expect(PROVIDERS.qwen.envVariable).toBe("QWEN_PATH");
        expect(PROVIDERS.opencode.envVariable).toBe("OPENCODE_PATH");
        expect(PROVIDERS.droid.envVariable).toBe("DROID_PATH");
    });

    it("should have buildArgs function for every provider", () => {
        expect.assertions(11);

        for (const config of Object.values(PROVIDERS)) {
            expect(config.buildArgs).toBeTypeOf("function");
        }
    });

    it("should define default models for major providers", () => {
        expect.assertions(3);

        // claude/codex now default to provider-default (empty) to avoid pinning stale snapshots.
        expect(PROVIDERS.claude.defaultModel).toBe("");
        expect(PROVIDERS.gemini.defaultModel).toContain("gemini");
        expect(PROVIDERS.codex.defaultModel).toBe("");
    });

    it("should declare model and maxTokens support per provider", () => {
        expect.assertions(4);

        expect(PROVIDERS.gemini.supportsModel).toBe(true);
        expect(PROVIDERS.gemini.supportsMaxTokens).toBe(true);
        expect(PROVIDERS.amp.supportsModel).toBe(false);
        expect(PROVIDERS.claude.supportsMaxTokens).toBe(false);
    });

    it("should define alternate commands where applicable", () => {
        expect.assertions(3);

        expect(PROVIDERS.codex.alternateCommands).toContain("openai-codex");
        expect(PROVIDERS.gemini.alternateCommands).toContain("gemini-cli");
        expect(PROVIDERS.qwen.alternateCommands).toContain("qwen-code");
    });
});

describe("pROVIDER_NAMES", () => {
    it("should list all provider names alphabetically", () => {
        expect.assertions(4);

        expect(PROVIDER_NAMES).toHaveLength(11);
        expect(PROVIDER_NAMES[0]).toBe("amp");
        expect(PROVIDER_NAMES[1]).toBe("claude");
        expect(PROVIDER_NAMES[2]).toBe("codex");
    });
});

// --- detectProvider ---

describe(detectProvider, () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mockExecFileSync.mockImplementation(() => {
            throw new Error("not found");
        });
        mockExistsSync.mockReturnValue(false);
    });

    it("should return unavailable when nothing found", () => {
        expect.assertions(3);

        const result = detectProvider("claude");

        expect(result.available).toBe(false);
        expect(result.name).toBe("claude");
        expect(result.path).toBeUndefined();
    });

    it("should detect via environment variable", () => {
        expect.assertions(4);

        const originalEnv = process.env["CLAUDE_PATH"];

        process.env["CLAUDE_PATH"] = "/custom/path/claude";
        mockExistsSync.mockImplementation((path) => path === "/custom/path/claude");
        mockExecFileSync.mockImplementation((_cmd: string, args?: ReadonlyArray<string>) => {
            if (args?.[0] === "--version") {
                return "1.2.3\n";
            }

            throw new Error("not found");
        });

        const result = detectProvider("claude");

        expect(result.available).toBe(true);
        expect(result.detectionMethod).toBe("envvar");
        expect(result.path).toBe("/custom/path/claude");
        expect(result.version).toBe("1.2.3");

        process.env["CLAUDE_PATH"] = originalEnv;
    });

    it("should detect via which command", () => {
        expect.assertions(4);

        mockExecFileSync.mockImplementation((cmd: string, args?: ReadonlyArray<string>) => {
            if (cmd === WHICH_CMD && args?.[0] === "claude") {
                return "/usr/local/bin/claude\n";
            }

            if (args?.[0] === "--version") {
                return "v2.0.0\n";
            }

            throw new Error("not found");
        });

        const result = detectProvider("claude");

        expect(result.available).toBe(true);
        expect(result.detectionMethod).toBe("which");
        expect(result.path).toBe("/usr/local/bin/claude");
        expect(result.version).toBe("2.0.0");
    });

    it("should try alternate commands", () => {
        expect.assertions(2);

        mockExecFileSync.mockImplementation((cmd: string, args?: ReadonlyArray<string>) => {
            if (cmd === WHICH_CMD && args?.[0] === "openai-codex") {
                return "/usr/local/bin/openai-codex\n";
            }

            if (args?.[0] === "--version") {
                return "v0.1.0\n";
            }

            throw new Error("not found");
        });

        const result = detectProvider("codex");

        expect(result.available).toBe(true);
        expect(result.path).toBe("/usr/local/bin/openai-codex");
    });

    it("should try qwen-code alternate command", () => {
        expect.assertions(1);

        mockExecFileSync.mockImplementation((cmd: string, args?: ReadonlyArray<string>) => {
            if (cmd === WHICH_CMD && args?.[0] === "qwen-code") {
                return "/usr/local/bin/qwen-code\n";
            }

            throw new Error("not found");
        });

        const result = detectProvider("qwen");

        expect(result.available).toBe(true);
    });

    it.skipIf(IS_WINDOWS)("should detect via known paths", () => {
        expect.assertions(3);

        mockExecFileSync.mockImplementation((_cmd: string, args?: ReadonlyArray<string>) => {
            if (args?.[0] === "--version") {
                return "3.0.0\n";
            }

            throw new Error("not found");
        });
        mockExistsSync.mockImplementation((path) => path === "/opt/homebrew/bin/gemini");

        const result = detectProvider("gemini");

        expect(result.available).toBe(true);
        expect(result.detectionMethod).toBe("known-path");
        expect(result.path).toBe("/opt/homebrew/bin/gemini");
    });

    it("should handle version detection failure gracefully", () => {
        expect.assertions(2);

        mockExecFileSync.mockImplementation((cmd: string, args?: ReadonlyArray<string>) => {
            if (cmd === WHICH_CMD && args?.[0] === "claude") {
                return "/usr/local/bin/claude\n";
            }

            throw new Error("version failed");
        });

        const result = detectProvider("claude");

        expect(result.available).toBe(true);
        expect(result.version).toBeUndefined();
    });

    it("should parse version with v prefix", () => {
        expect.assertions(1);

        mockExecFileSync.mockImplementation((cmd: string, args?: ReadonlyArray<string>) => {
            if (cmd === WHICH_CMD && args?.[0] === "gemini") {
                return "/usr/bin/gemini\n";
            }

            if (args?.[0] === "--version") {
                return "gemini-cli v1.5.2\n";
            }

            throw new Error("not found");
        });

        const result = detectProvider("gemini");

        expect(result.version).toBe("1.5.2");
    });

    it("should parse prerelease version", () => {
        expect.assertions(1);

        mockExecFileSync.mockImplementation((cmd: string, args?: ReadonlyArray<string>) => {
            if (cmd === WHICH_CMD && args?.[0] === "claude") {
                return "/usr/bin/claude\n";
            }

            if (args?.[0] === "--version") {
                return "2.0.0-beta.1\n";
            }

            throw new Error("not found");
        });

        const result = detectProvider("claude");

        expect(result.version).toBe("2.0.0-beta.1");
    });

    it("should detect additional providers like amp", () => {
        expect.assertions(2);

        mockExecFileSync.mockImplementation((cmd: string, args?: ReadonlyArray<string>) => {
            if (cmd === WHICH_CMD && args?.[0] === "amp") {
                return "/usr/local/bin/amp\n";
            }

            throw new Error("not found");
        });

        const result = detectProvider("amp");

        expect(result.available).toBe(true);
        expect(result.name).toBe("amp");
    });
});

// --- detectAllProviders ---

describe(detectAllProviders, () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mockExecFileSync.mockImplementation(() => {
            throw new Error("not found");
        });
        mockExistsSync.mockReturnValue(false);
    });

    it("should return all 11 providers", () => {
        expect.assertions(12);

        const results = detectAllProviders();

        expect(results).toHaveLength(11);

        const names = results.map((r) => r.name);

        expect(names).toContain("gemini");
        expect(names).toContain("claude");
        expect(names).toContain("codex");
        expect(names).toContain("copilot");
        expect(names).toContain("cursor");
        expect(names).toContain("crush");
        expect(names).toContain("amp");
        expect(names).toContain("kimi");
        expect(names).toContain("qwen");
        expect(names).toContain("opencode");
        expect(names).toContain("droid");
    });

    it("should return in alphabetical order", () => {
        expect.assertions(3);

        const results = detectAllProviders();

        expect(results[0]?.name).toBe("amp");
        expect(results[1]?.name).toBe("claude");
        expect(results[2]?.name).toBe("codex");
    });
});

// --- detectAvailableProviders ---

describe(detectAvailableProviders, () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mockExecFileSync.mockImplementation(() => {
            throw new Error("not found");
        });
        mockExistsSync.mockReturnValue(false);
    });

    it("should return empty when nothing available", () => {
        expect.assertions(1);

        expect(detectAvailableProviders()).toHaveLength(0);
    });

    it("should return only available providers", () => {
        expect.assertions(2);

        mockExecFileSync.mockImplementation((cmd: string, args?: ReadonlyArray<string>) => {
            if (cmd === WHICH_CMD && args?.[0] === "claude") {
                return "/usr/bin/claude\n";
            }

            throw new Error("not found");
        });

        const results = detectAvailableProviders();

        expect(results).toHaveLength(1);
        expect(results[0]?.name).toBe("claude");
    });

    it("should include detection-only providers if found", () => {
        expect.assertions(3);

        mockExecFileSync.mockImplementation((cmd: string, args?: ReadonlyArray<string>) => {
            if (cmd === WHICH_CMD && (args?.[0] === "claude" || args?.[0] === "amp")) {
                return `/usr/bin/${args[0] as string}\n`;
            }

            throw new Error("not found");
        });

        const results = detectAvailableProviders();

        expect(results).toHaveLength(2);

        const names = results.map((r) => r.name);

        expect(names).toContain("claude");
        expect(names).toContain("amp");
    });
});

// --- buildCliArgs ---

describe(buildCliArgs, () => {
    it("should build safe claude args without the permission-bypass flag by default", () => {
        expect.assertions(5);

        const args = buildCliArgs("claude", "analyze this");

        expect(args).not.toContain("--dangerously-skip-permissions");
        expect(args).toContain("--output-format");
        expect(args).toContain("text");
        expect(args).toContain("-p");
        expect(args).toContain("analyze this");
    });

    it("should add the claude permission-bypass flag when dangerous is true", () => {
        expect.assertions(1);

        const args = buildCliArgs("claude", "analyze this", { dangerous: true });

        expect(args).toContain("--dangerously-skip-permissions");
    });

    it("should omit the claude --model flag when no model is set (provider-default)", () => {
        expect.assertions(1);

        const args = buildCliArgs("claude", "analyze this");

        expect(args).not.toContain("--model");
    });

    it("should build gemini args", () => {
        expect.assertions(4);

        const args = buildCliArgs("gemini", "analyze this");

        expect(args).toContain("--sandbox");
        expect(args).toContain("--max-output-tokens");
        expect(args).toContain("-p");
        expect(args).toContain("analyze this");
    });

    it("should build codex args targeting the modern `codex exec` surface", () => {
        expect.assertions(4);

        const args = buildCliArgs("codex", "analyze this");

        expect(args[0]).toBe("exec");
        expect(args).toContain("analyze this");
        // The retired flags must not be emitted anymore.
        expect(args).not.toContain("--approval-mode");
        expect(args).not.toContain("--max-tokens");
    });

    it("should add the codex bypass flag when dangerous is true", () => {
        expect.assertions(1);

        const args = buildCliArgs("codex", "analyze this", { dangerous: true });

        expect(args).toContain("--dangerously-bypass-approvals-and-sandbox");
    });

    it("should use custom model", () => {
        expect.assertions(1);

        const args = buildCliArgs("claude", "test", { model: "claude-opus-4-20250514" });
        const modelIndex = args.indexOf("--model");

        expect(args[modelIndex + 1]).toBe("claude-opus-4-20250514");
    });

    it("should use custom maxTokens", () => {
        expect.assertions(1);

        const args = buildCliArgs("gemini", "test", { maxTokens: 8192 });

        expect(args).toContain("8192");
    });

    it("should use the gemini default model when not specified", () => {
        expect.assertions(1);

        const args = buildCliArgs("gemini", "test");

        expect(args).toContain(PROVIDERS.gemini.defaultModel);
    });

    it("should build amp args with -x flag and no bypass flag by default", () => {
        expect.assertions(3);

        const args = buildCliArgs("amp", "analyze this");

        expect(args).toContain("-x");
        expect(args).toContain("analyze this");
        expect(args).not.toContain("--dangerously-allow-all");
    });

    it("should add the amp bypass flag when dangerous is true", () => {
        expect.assertions(1);

        const args = buildCliArgs("amp", "analyze this", { dangerous: true });

        expect(args).toContain("--dangerously-allow-all");
    });

    it("should build kimi args with --quiet and -p", () => {
        expect.assertions(3);

        const args = buildCliArgs("kimi", "analyze this");

        expect(args).toContain("--quiet");
        expect(args).toContain("-p");
        expect(args).toContain("analyze this");
    });

    it("should build kimi args with custom model", () => {
        expect.assertions(2);

        const args = buildCliArgs("kimi", "test", { model: "k2" });

        expect(args).toContain("-m");
        expect(args).toContain("k2");
    });

    it("should build opencode args with run subcommand", () => {
        expect.assertions(2);

        const args = buildCliArgs("opencode", "analyze this");

        expect(args[0]).toBe("run");
        expect(args[1]).toBe("analyze this");
    });

    it("should build opencode args with custom model", () => {
        expect.assertions(2);

        const args = buildCliArgs("opencode", "test", { model: "anthropic/claude-opus-4" });

        expect(args).toContain("-m");
        expect(args).toContain("anthropic/claude-opus-4");
    });

    it("should build qwen args with -p and -o text, no --yolo by default", () => {
        expect.assertions(5);

        const args = buildCliArgs("qwen", "analyze this");

        expect(args).toContain("-p");
        expect(args).toContain("analyze this");
        expect(args).not.toContain("--yolo");
        expect(args).toContain("-o");
        expect(args).toContain("text");
    });

    it("should add the qwen --yolo flag when dangerous is true", () => {
        expect.assertions(1);

        const args = buildCliArgs("qwen", "analyze this", { dangerous: true });

        expect(args).toContain("--yolo");
    });

    it("should build droid args with positional prompt and no bypass flag by default", () => {
        expect.assertions(4);

        const args = buildCliArgs("droid", "analyze this");

        expect(args[0]).toBe("analyze this");
        expect(args).not.toContain("--skip-permissions-unsafe");
        expect(args).toContain("-o");
        expect(args).toContain("text");
    });

    it("should add the droid bypass flag when dangerous is true", () => {
        expect.assertions(1);

        const args = buildCliArgs("droid", "analyze this", { dangerous: true });

        expect(args).toContain("--skip-permissions-unsafe");
    });

    it("should build droid args with custom model", () => {
        expect.assertions(2);

        const args = buildCliArgs("droid", "test", { model: "gpt-4" });

        expect(args).toContain("-m");
        expect(args).toContain("gpt-4");
    });

    it("should build cursor args with -p and no --force by default", () => {
        expect.assertions(5);

        const args = buildCliArgs("cursor", "analyze this");

        expect(args).toContain("-p");
        expect(args).not.toContain("--force");
        expect(args).toContain("--output-format");
        expect(args).toContain("text");
        expect(args).toContain("analyze this");
    });

    it("should add the cursor --force flag when dangerous is true", () => {
        expect.assertions(1);

        const args = buildCliArgs("cursor", "analyze this", { dangerous: true });

        expect(args).toContain("--force");
    });

    it("should build cursor args with custom model", () => {
        expect.assertions(2);

        const args = buildCliArgs("cursor", "test", { model: "gpt-5.2" });

        expect(args).toContain("--model");
        expect(args).toContain("gpt-5.2");
    });

    it("should build copilot args with -p and no --allow-all-tools by default", () => {
        expect.assertions(3);

        const args = buildCliArgs("copilot", "analyze this");

        expect(args).toContain("-p");
        expect(args).toContain("analyze this");
        expect(args).not.toContain("--allow-all-tools");
    });

    it("should add the copilot --allow-all-tools flag when dangerous is true", () => {
        expect.assertions(1);

        const args = buildCliArgs("copilot", "analyze this", { dangerous: true });

        expect(args).toContain("--allow-all-tools");
    });

    it("should build copilot args with custom model", () => {
        expect.assertions(2);

        const args = buildCliArgs("copilot", "test", { model: "claude-sonnet-4.5" });

        expect(args).toContain("--model");
        expect(args).toContain("claude-sonnet-4.5");
    });

    it("should build crush args with run subcommand and no --yolo by default", () => {
        expect.assertions(3);

        const args = buildCliArgs("crush", "analyze this");

        expect(args[0]).toBe("run");
        expect(args).not.toContain("--yolo");
        expect(args).toContain("analyze this");
    });

    it("should add the crush --yolo flag when dangerous is true", () => {
        expect.assertions(1);

        const args = buildCliArgs("crush", "analyze this", { dangerous: true });

        expect(args).toContain("--yolo");
    });

    it("should build crush args with custom model", () => {
        expect.assertions(2);

        const args = buildCliArgs("crush", "test", { model: "anthropic/claude-sonnet-4" });

        expect(args).toContain("-m");
        expect(args).toContain("anthropic/claude-sonnet-4");
    });
});

// --- runProvider ---

describe(runProvider, () => {
    it("should reject when provider is not available", async () => {
        expect.assertions(1);

        const provider: AiProviderInfo = {
            available: false,
            name: "claude",
        };

        await expect(runProvider(provider, "test")).rejects.toThrow("not available");
    });

    it("should reject when provider has no path", async () => {
        expect.assertions(1);

        const provider: AiProviderInfo = {
            available: true,
            name: "claude",
        };

        await expect(runProvider(provider, "test")).rejects.toThrow("not available");
    });
});
