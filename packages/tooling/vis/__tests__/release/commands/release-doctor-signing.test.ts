/**
 * `vis release doctor` — git.signing check (F9 redaction + F24 floating-tag
 * risk).
 *
 * Two behaviours under test:
 *
 *   1. F9 — when `signing.mode === "gpg"` and the operator-supplied
 *      `signing.key` is a filesystem path (or any value with `/` / `\`),
 *      the doctor's success message must NOT echo the raw value to
 *      stdout. CI captures all stdout to logs; private-key paths
 *      leaking there is a low-grade secret-exposure bug.
 *
 *   2. F24 — when both `signing.mode === "sigstore"` AND
 *      `floatingMajorTag === true` are configured, the doctor emits a
 *      `floating-major-tag.signing-risk` check at warn severity. The
 *      floating-tag retarget force-pushes the tag on every release,
 *      which produces a new sigstore transparency-log entry per release
 *      — operators should know they're filling Rekor with retargets.
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

const writeVisConfigCjs = (cwd: string, releaseBlock: Record<string, unknown>): void => {
    const block = {
        release: {
            acknowledgeUnstable: true,
            defaultManaged: true,
            ...releaseBlock,
        },
    };

    writeFileSync(join(cwd, "vis.config.cjs"), `module.exports = ${JSON.stringify(block, null, 4)};\n`);
};

const setupRepo = (releaseBlock: Record<string, unknown>): string => {
    const cwd = mkdtempSync(join(tmpdir(), "vis-doctor-signing-"));

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

    writeVisConfigCjs(cwd, releaseBlock);

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

// Stub gh + git probes the doctor invokes; the signing branch only needs
// `git config user.signingkey` / `gpg.format` to return non-empty so the
// "pass" message path is exercised.
const stubShellRunnerForSigningPass = (signingKey = "deadbeef1234"): void => {
    vi.doMock(import("../../../src/release/core/shell-runner"), () => {
        return {
            createShellRunner: () => {
                return {
                    run: async (cmd: string, args: ReadonlyArray<string>) => {
                        if (cmd === "git" && args[0] === "config" && args[1] === "user.signingkey") {
                            return { exitCode: 0, stderr: "", stdout: `${signingKey}\n` };
                        }

                        if (cmd === "git" && args[0] === "config" && args[1] === "gpg.format") {
                            return { exitCode: 0, stderr: "", stdout: "openpgp\n" };
                        }

                        if (cmd === "git" && args[0] === "config" && args[1] === "user.name") {
                            return { exitCode: 0, stderr: "", stdout: "Test\n" };
                        }

                        if (cmd === "git" && args[0] === "config" && args[1] === "user.email") {
                            return { exitCode: 0, stderr: "", stdout: "test@test\n" };
                        }

                        return { exitCode: 0, stderr: "", stdout: "" };
                    },
                };
            },
        };
    });
};

describe("vis release doctor — git.signing key redaction (F9)", () => {
    let cwd: string;
    const originalExitCode = process.exitCode;
    const originalEnv = { ...process.env };

    beforeEach(() => {
        process.exitCode = 0;
        delete process.env.CI;
        delete process.env.GITHUB_ACTIONS;
    });

    afterEach(async () => {
        process.exitCode = originalExitCode;
        process.env = originalEnv;
        vi.doUnmock("../../../src/release/core/shell-runner");
        vi.resetModules();

        if (cwd) {
            await rm(cwd, { force: true, recursive: true });
        }
    });

    it("redacts filesystem-path signing keys (does not echo the full path)", async () => {
        // A path-style signing.key — common when operators point at an
        // exported private key file rather than a key id.
        const keyPath = "/home/runner/.ssh/release-signing-key";

        cwd = setupRepo({ signing: { key: keyPath, mode: "gpg" } });
        stubShellRunnerForSigningPass(keyPath);

        const capture = captureStdout();

        try {
            const { default: doctorHandler } = await import("../../../src/commands/release/doctor/handler");
            const { toolbox } = makeToolbox(cwd, { json: true });

            await doctorHandler(toolbox);

            const joined = capture.chunks.join("");
            const parsed = JSON.parse(joined) as { checks: { message: string; name: string; severity: string; status: string }[] };

            const check = parsed.checks.find((c) => c.name === "git.signing");

            expect(check).toBeDefined();
            expect(check!.status).toBe("pass");
            // The raw path must NOT appear anywhere in the message.
            expect(check!.message).not.toContain(keyPath);
            expect(check!.message).not.toContain("/home/runner");
            // We still surface "configured" so operators can confirm a
            // signing key is in fact wired up.
            expect(check!.message).toMatch(/configured/);
        } finally {
            capture.restore();
        }
    });

    it("emits a redacted-tail hint for short key ids (no path chars)", async () => {
        // A short hex key id (no `/` or `\`) — keeping the last 4 chars
        // is useful for the operator to confirm WHICH key was picked.
        const keyId = "ABCDEF1234567890";

        cwd = setupRepo({ signing: { key: keyId, mode: "gpg" } });
        stubShellRunnerForSigningPass(keyId);

        const capture = captureStdout();

        try {
            const { default: doctorHandler } = await import("../../../src/commands/release/doctor/handler");
            const { toolbox } = makeToolbox(cwd, { json: true });

            await doctorHandler(toolbox);

            const joined = capture.chunks.join("");
            const parsed = JSON.parse(joined) as { checks: { message: string; name: string; severity: string; status: string }[] };

            const check = parsed.checks.find((c) => c.name === "git.signing");

            expect(check).toBeDefined();
            expect(check!.status).toBe("pass");
            // Last 4 chars surface, prefixed with an ellipsis.
            expect(check!.message).toContain("…7890");
            // The full id does NOT.
            expect(check!.message).not.toContain(keyId);
        } finally {
            capture.restore();
        }
    });
});

describe("vis release doctor — floating-major-tag.signing-risk (F24)", () => {
    let cwd: string;
    const originalExitCode = process.exitCode;
    const originalEnv = { ...process.env };

    beforeEach(() => {
        process.exitCode = 0;
        delete process.env.CI;
        delete process.env.GITHUB_ACTIONS;
    });

    afterEach(async () => {
        process.exitCode = originalExitCode;
        process.env = originalEnv;
        vi.doUnmock("../../../src/release/core/shell-runner");
        vi.doUnmock("../../../src/release/core/git");
        vi.resetModules();

        if (cwd) {
            await rm(cwd, { force: true, recursive: true });
        }
    });

    it("warns when floatingMajorTag AND signing.mode=sigstore are both set", async () => {
        cwd = setupRepo({ floatingMajorTag: true, signing: { mode: "sigstore" } });

        // Stub gitsign --version returning 0 so the sigstore check passes
        // and we reach the F24 risk check.
        vi.doMock(import("../../../src/release/core/shell-runner"), () => {
            return {
                createShellRunner: () => {
                    return {
                        run: async (cmd: string) => {
                            if (cmd === "gitsign") {
                                return { exitCode: 0, stderr: "", stdout: "gitsign 0.10.0\n" };
                            }

                            return { exitCode: 0, stderr: "", stdout: "" };
                        },
                    };
                },
            };
        });

        const capture = captureStdout();

        try {
            // Reset the gitsignAvailable cache so the mocked runner is
            // actually invoked.
            const { resetGitsignCacheForTests } = await import("../../../src/release/core/git");

            resetGitsignCacheForTests();

            const { default: doctorHandler } = await import("../../../src/commands/release/doctor/handler");
            const { toolbox } = makeToolbox(cwd, { json: true });

            await doctorHandler(toolbox);

            const joined = capture.chunks.join("");
            const parsed = JSON.parse(joined) as { checks: { message: string; name: string; severity: string; status: string }[] };

            const check = parsed.checks.find((c) => c.name === "floating-major-tag.signing-risk");

            expect(check).toBeDefined();
            expect(check!.status).toBe("fail");
            expect(check!.severity).toBe("warn");
            expect(check!.message).toMatch(/sigstore/);
            expect(check!.message).toMatch(/floatingMajorTag/i);
            expect(check!.message).toMatch(/Rekor|transparency-log/);
        } finally {
            capture.restore();
        }
    });

    it("does NOT emit the risk check when floatingMajorTag is off", async () => {
        cwd = setupRepo({ floatingMajorTag: false, signing: { mode: "sigstore" } });

        vi.doMock(import("../../../src/release/core/shell-runner"), () => {
            return {
                createShellRunner: () => {
                    return {
                        run: async (cmd: string) => {
                            if (cmd === "gitsign") {
                                return { exitCode: 0, stderr: "", stdout: "gitsign 0.10.0\n" };
                            }

                            return { exitCode: 0, stderr: "", stdout: "" };
                        },
                    };
                },
            };
        });

        const capture = captureStdout();

        try {
            const { resetGitsignCacheForTests } = await import("../../../src/release/core/git");

            resetGitsignCacheForTests();

            const { default: doctorHandler } = await import("../../../src/commands/release/doctor/handler");
            const { toolbox } = makeToolbox(cwd, { json: true });

            await doctorHandler(toolbox);

            const joined = capture.chunks.join("");
            const parsed = JSON.parse(joined) as { checks: { name: string }[] };

            expect(parsed.checks.some((c) => c.name === "floating-major-tag.signing-risk")).toBe(false);
        } finally {
            capture.restore();
        }
    });

    it("does NOT emit the risk check when signing.mode is gpg (no Rekor entries)", async () => {
        cwd = setupRepo({ floatingMajorTag: true, signing: { mode: "gpg" } });
        stubShellRunnerForSigningPass("ABCD1234");

        const capture = captureStdout();

        try {
            const { default: doctorHandler } = await import("../../../src/commands/release/doctor/handler");
            const { toolbox } = makeToolbox(cwd, { json: true });

            await doctorHandler(toolbox);

            const joined = capture.chunks.join("");
            const parsed = JSON.parse(joined) as { checks: { name: string }[] };

            expect(parsed.checks.some((c) => c.name === "floating-major-tag.signing-risk")).toBe(false);
        } finally {
            capture.restore();
        }
    });
});

describe("vis release doctor — floating-major-tag.legacy-tags (wave-7)", () => {
    let cwd: string;
    const originalExitCode = process.exitCode;
    const originalEnv = { ...process.env };

    beforeEach(() => {
        process.exitCode = 0;
        delete process.env.CI;
        delete process.env.GITHUB_ACTIONS;
    });

    afterEach(async () => {
        process.exitCode = originalExitCode;
        process.env = originalEnv;
        vi.doUnmock("../../../src/release/core/shell-runner");
        vi.resetModules();

        if (cwd) {
            await rm(cwd, { force: true, recursive: true });
        }
    });

    // Stub `git tag --list "v*"` to return the supplied tag set; pass git
    // config probes through so the signing/identity checks behave normally.
    const stubGitTagList = (tags: ReadonlyArray<string>): void => {
        vi.doMock(import("../../../src/release/core/shell-runner"), () => {
            return {
                createShellRunner: () => {
                    return {
                        run: async (cmd: string, args: ReadonlyArray<string>) => {
                            if (cmd === "git" && args[0] === "tag" && args[1] === "--list" && args[2] === "v*") {
                                return { exitCode: 0, stderr: "", stdout: `${tags.join("\n")}\n` };
                            }

                            if (cmd === "git" && args[0] === "config" && args[1] === "user.name") {
                                return { exitCode: 0, stderr: "", stdout: "Test\n" };
                            }

                            if (cmd === "git" && args[0] === "config" && args[1] === "user.email") {
                                return { exitCode: 0, stderr: "", stdout: "test@test\n" };
                            }

                            return { exitCode: 0, stderr: "", stdout: "" };
                        },
                    };
                },
            };
        });
    };

    it("is skipped (no check emitted) when floatingMajorTag is disabled", async () => {
        cwd = setupRepo({ floatingMajorTag: false });
        stubGitTagList(["v1", "v2"]); // legacy tags exist but should be ignored

        const capture = captureStdout();

        try {
            const { default: doctorHandler } = await import("../../../src/commands/release/doctor/handler");
            const { toolbox } = makeToolbox(cwd, { json: true });

            await doctorHandler(toolbox);

            const joined = capture.chunks.join("");
            const parsed = JSON.parse(joined) as { checks: { name: string }[] };

            // The doctor should never even emit the check when the feature is off.
            expect(parsed.checks.some((c) => c.name === "floating-major-tag.legacy-tags")).toBe(false);
        } finally {
            capture.restore();
        }
    });

    it("fires (warn / fail) when floatingMajorTag is on AND legacy v<major> tags exist", async () => {
        cwd = setupRepo({ floatingMajorTag: true });
        stubGitTagList(["v1", "v2", "v1.0.0", "acme-action-v1"]);

        const capture = captureStdout();

        try {
            const { default: doctorHandler } = await import("../../../src/commands/release/doctor/handler");
            const { toolbox } = makeToolbox(cwd, { json: true });

            await doctorHandler(toolbox);

            const joined = capture.chunks.join("");
            const parsed = JSON.parse(joined) as { checks: { message: string; name: string; severity: string; status: string }[] };

            const check = parsed.checks.find((c) => c.name === "floating-major-tag.legacy-tags");

            expect(check).toBeDefined();
            expect(check!.status).toBe("fail");
            expect(check!.severity).toBe("warn");
            // Both pure-`v<digits>` tags appear; the SemVer tag and the
            // new-format tag must NOT be listed.
            expect(check!.message).toMatch(/v1/);
            expect(check!.message).toMatch(/v2/);
            expect(check!.message).not.toMatch(/v1\.0\.0/);
            expect(check!.message).not.toMatch(/acme-action-v1/);
            // Migration hint mentions the new format.
            expect(check!.message).toMatch(/<safe-name>-v<major>/);
            expect(check!.message).toMatch(/git tag -f/);
        } finally {
            capture.restore();
        }
    });

    it("passes when floatingMajorTag is on but only new-format tags exist", async () => {
        cwd = setupRepo({ floatingMajorTag: true });
        // No bare `v<N>` — only the new-format tags and a SemVer tag.
        stubGitTagList(["acme-action-v1", "acme-action-v2", "v1.0.0"]);

        const capture = captureStdout();

        try {
            const { default: doctorHandler } = await import("../../../src/commands/release/doctor/handler");
            const { toolbox } = makeToolbox(cwd, { json: true });

            await doctorHandler(toolbox);

            const joined = capture.chunks.join("");
            const parsed = JSON.parse(joined) as { checks: { name: string; severity: string; status: string }[] };

            const check = parsed.checks.find((c) => c.name === "floating-major-tag.legacy-tags");

            expect(check).toBeDefined();
            expect(check!.status).toBe("pass");
            expect(check!.severity).toBe("info");
        } finally {
            capture.restore();
        }
    });

    it("caps the listed tags at 5 with a `+N more` suffix when there are more", async () => {
        cwd = setupRepo({ floatingMajorTag: true });
        stubGitTagList(["v1", "v2", "v3", "v4", "v5", "v6", "v7"]);

        const capture = captureStdout();

        try {
            const { default: doctorHandler } = await import("../../../src/commands/release/doctor/handler");
            const { toolbox } = makeToolbox(cwd, { json: true });

            await doctorHandler(toolbox);

            const joined = capture.chunks.join("");
            const parsed = JSON.parse(joined) as { checks: { message: string; name: string; status: string }[] };

            const check = parsed.checks.find((c) => c.name === "floating-major-tag.legacy-tags");

            expect(check).toBeDefined();
            expect(check!.status).toBe("fail");
            // First 5 listed; tail mentions "+2 more"
            expect(check!.message).toMatch(/v1, v2, v3, v4, v5/);
            expect(check!.message).toMatch(/\+2 more/);

            // v6/v7 are NOT in the explicit list portion (they're rolled
            // into "+2 more").
            const firstListSegment = check!.message.split(").")[0]!;

            expect(firstListSegment).not.toMatch(/v6/);
            expect(firstListSegment).not.toMatch(/v7/);
        } finally {
            capture.restore();
        }
    });
});
