/**
 * `vis release doctor` — github.token-scopes (semantic-release #2469).
 *
 * The check shells out to `gh auth status --show-token` and warns when
 * the token's scopes exceed what the release flow needs (`contents:write`,
 * `pull-requests:write`, and optionally `id-token:write` for OIDC).
 *
 * Coverage:
 *   1. Over-privileged token (`repo`, `admin:org`) → warn-level fail.
 *   2. Scoped token (`contents:write`) → info-level pass.
 *   3. `gh auth status` returns no parseable scopes line → info-level skip.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const writeJson = (path: string, value: unknown): void => {
    writeFileSync(path, `${JSON.stringify(value, null, 4)}\n`);
};

const writeVisConfigCjs = (cwd: string): void => {
    const block = { release: { acknowledgeUnstable: true, defaultManaged: true } };

    writeFileSync(join(cwd, "vis.config.cjs"), `module.exports = ${JSON.stringify(block, null, 4)};\n`);
};

const setupRepo = (): string => {
    const cwd = mkdtempSync(join(tmpdir(), "vis-doctor-token-scopes-"));

    writeJson(join(cwd, "package.json"), {
        name: "fixture-root",
        packageManager: "pnpm@10.0.0",
        private: true,
        version: "0.0.0",
        workspaces: ["packages/*"],
    });

    writeFileSync(join(cwd, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
    mkdirSync(join(cwd, "packages", "a"), { recursive: true });
    writeJson(join(cwd, "packages", "a", "package.json"), { name: "@scope/a", private: true, version: "0.0.1" });
    mkdirSync(join(cwd, ".vis", "release"), { recursive: true });

    writeVisConfigCjs(cwd);

    execFileSync("git", ["init", "-q", "--initial-branch", "main"], { cwd });
    execFileSync("git", ["config", "user.email", "test@test"], { cwd });
    execFileSync("git", ["config", "user.name", "Test"], { cwd });
    execFileSync("git", ["add", "."], { cwd });
    execFileSync("git", ["commit", "-q", "-m", "initial"], { cwd });

    return cwd;
};

interface CapturedLog {
    args: unknown[];
    level: "info" | "warn" | "error";
}

const makeToolbox = (cwd: string, options: { json?: boolean } = {}) => {
    const logs: CapturedLog[] = [];

    return {
        logs,
        toolbox: {
            argument: {},
            logger: {
                error: (...args: unknown[]) => logs.push({ args, level: "error" }),
                info: (...args: unknown[]) => logs.push({ args, level: "info" }),
                warn: (...args: unknown[]) => logs.push({ args, level: "warn" }),
            } as never,
            options: {
                json: options.json,
            } as never,
            workspaceRoot: cwd,
        } as never,
    };
};

interface StdoutCapture {
    chunks: string[];
    restore: () => void;
}

const captureStdout = (): StdoutCapture => {
    const chunks: string[] = [];

    const origWrite = process.stdout.write.bind(process.stdout);

    (process.stdout as { write: unknown }).write = (chunk: string | Uint8Array): boolean => {
        chunks.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));

        return true;
    };

    return {
        chunks,
        restore: (): void => {
            (process.stdout as { write: typeof origWrite }).write = origWrite;
        },
    };
};

describe("vis release doctor — github.token-scopes (semantic-release #2469)", () => {
    let cwd: string;
    const originalExitCode = process.exitCode;
    const originalEnv = { ...process.env };

    beforeEach(() => {
        cwd = setupRepo();
        process.exitCode = 0;
        // The check only runs in CI — set the signal explicitly.
        process.env.CI = "true";
        delete process.env.GITHUB_ACTIONS;
        delete process.env.NPM_TOKEN;
        delete process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
    });

    afterEach(async () => {
        process.exitCode = originalExitCode;
        process.env = originalEnv;
        vi.doUnmock("../../../src/release/core/shell-runner");
        vi.resetModules();
        await rm(cwd, { force: true, recursive: true });
    });

    it("warns when the token carries the broad `repo` scope", async () => {
        vi.doMock(import("../../../src/release/core/shell-runner"), () => {
            return {
                createShellRunner: () => {
                    return {
                        run: async (cmd: string, args: ReadonlyArray<string>) => {
                            if (cmd === "gh" && args[0] === "auth" && args[1] === "status") {
                                return {
                                    exitCode: 0,
                                    stderr: "✓ Logged in to github.com\n  Token scopes: 'repo', 'workflow', 'admin:org'\n",
                                    stdout: "",
                                };
                            }

                            return { exitCode: 0, stderr: "", stdout: "" };
                        },
                    };
                },
            };
        });

        const capture = captureStdout();

        try {
            const { default: doctorHandler } = await import("../../../src/commands/release/doctor/handler");
            const { toolbox } = makeToolbox(cwd, { json: true });

            await doctorHandler(toolbox);

            const joined = capture.chunks.join("");
            const parsed = JSON.parse(joined) as { checks: { message: string; name: string; severity: string; status: string }[] };

            const check = parsed.checks.find((c) => c.name === "github.token-scopes");

            expect(check).toBeDefined();
            expect(check!.status).toBe("fail");
            expect(check!.severity).toBe("warn");
            expect(check!.message).toMatch(/repo/);
            expect(check!.message).toMatch(/admin:org/);
        } finally {
            capture.restore();
        }
    });

    it("passes when the token scopes are appropriately narrow", async () => {
        vi.doMock(import("../../../src/release/core/shell-runner"), () => {
            return {
                createShellRunner: () => {
                    return {
                        run: async (cmd: string, args: ReadonlyArray<string>) => {
                            if (cmd === "gh" && args[0] === "auth" && args[1] === "status") {
                                // Fine-grained PAT presented as classic scopes by gh — the
                                // narrow `contents`/`pull-requests` combo we want operators
                                // to land on.
                                return {
                                    exitCode: 0,
                                    stderr: "✓ Logged in to github.com\n  Token scopes: 'contents', 'pull-requests'\n",
                                    stdout: "",
                                };
                            }

                            return { exitCode: 0, stderr: "", stdout: "" };
                        },
                    };
                },
            };
        });

        const capture = captureStdout();

        try {
            const { default: doctorHandler } = await import("../../../src/commands/release/doctor/handler");
            const { toolbox } = makeToolbox(cwd, { json: true });

            await doctorHandler(toolbox);

            const joined = capture.chunks.join("");
            const parsed = JSON.parse(joined) as { checks: { name: string; severity: string; status: string }[] };

            const check = parsed.checks.find((c) => c.name === "github.token-scopes");

            expect(check).toBeDefined();
            expect(check!.status).toBe("pass");
            expect(check!.severity).toBe("info");
        } finally {
            capture.restore();
        }
    });

    it("skips when `gh auth status` returns no parseable Token scopes line", async () => {
        vi.doMock(import("../../../src/release/core/shell-runner"), () => {
            return {
                createShellRunner: () => {
                    return {
                        run: async (cmd: string, args: ReadonlyArray<string>) => {
                            if (cmd === "gh" && args[0] === "auth" && args[1] === "status") {
                                // Non-zero exit + no scopes line — simulates no auth.
                                return {
                                    exitCode: 1,
                                    stderr: "You are not logged in to any GitHub hosts. Run gh auth login\n",
                                    stdout: "",
                                };
                            }

                            return { exitCode: 0, stderr: "", stdout: "" };
                        },
                    };
                },
            };
        });

        const capture = captureStdout();

        try {
            const { default: doctorHandler } = await import("../../../src/commands/release/doctor/handler");
            const { toolbox } = makeToolbox(cwd, { json: true });

            await doctorHandler(toolbox);

            const joined = capture.chunks.join("");
            const parsed = JSON.parse(joined) as { checks: { name: string; severity: string; status: string }[] };

            const check = parsed.checks.find((c) => c.name === "github.token-scopes");

            expect(check).toBeDefined();
            expect(check!.status).toBe("skip");
            expect(check!.severity).toBe("info");
        } finally {
            capture.restore();
        }
    });
});
