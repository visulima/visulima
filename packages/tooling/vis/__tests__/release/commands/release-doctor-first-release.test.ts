/**
 * `vis release doctor --first-release` — M-1 greenfield-bootstrap
 * sanity check.
 *
 * The doctor check exists to prevent operators from running
 * `--first-release` on a workspace that ALREADY has tags or published
 * versions — that combination silently overwrites / double-bumps,
 * both data-loss bugs.
 *
 * Test surface:
 *   1. Fresh repo + no tags + `--first-release` → check passes.
 *   2. Repo with a matching release tag + `--first-release` → check
 *      errors out (process.exitCode === 1).
 *   3. Without `--first-release`, the check is skipped (status: "skip"
 *      / not present).
 *
 * We invoke the doctor handler's default export directly with a
 * minimal Toolbox stub — the handler reads `options.firstRelease` and
 * `options.json` only.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import doctorHandler from "../../../src/commands/release/doctor/handler";

const writeJson = (path: string, value: unknown): void => {
    writeFileSync(path, `${JSON.stringify(value, null, 4)}\n`);
};

const writeVisConfigCjs = (cwd: string): void => {
    const block = { release: { acknowledgeUnstable: true, defaultManaged: true } };

    writeFileSync(join(cwd, "vis.config.cjs"), `module.exports = ${JSON.stringify(block, null, 4)};\n`);
};

const setupRepo = (packageVersion: string = "0.0.1"): string => {
    const cwd = mkdtempSync(join(tmpdir(), "vis-doctor-firstrel-"));

    writeJson(join(cwd, "package.json"), {
        name: "fixture-root",
        packageManager: "pnpm@10.0.0",
        private: true,
        version: "0.0.0",
        workspaces: ["packages/*"],
    });

    writeFileSync(join(cwd, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
    mkdirSync(join(cwd, "packages", "a"), { recursive: true });
    writeJson(join(cwd, "packages", "a", "package.json"), {
        name: "@scope/a",
        private: true,
        version: packageVersion,
    });
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

const makeToolbox = (cwd: string, options: { firstRelease?: boolean; json?: boolean } = {}) => {
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
                firstRelease: options.firstRelease,
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

describe("vis release doctor — first-release.repo-not-greenfield (M-1)", () => {
    let cwd: string;
    const originalExitCode = process.exitCode;
    const originalEnv = { ...process.env };

    beforeEach(() => {
        cwd = setupRepo("0.0.1");
        process.exitCode = 0;
        // Tests must not be affected by ambient CI signals — the
        // doctor's `oidc-available` check fires error-severity when
        // CI=true AND no NPM_TOKEN; that's unrelated noise for these
        // greenfield-bootstrap tests.
        delete process.env.CI;
        delete process.env.GITHUB_ACTIONS;
        delete process.env.NPM_TOKEN;
        delete process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
    });

    afterEach(async () => {
        process.exitCode = originalExitCode;
        process.env = originalEnv;
        await rm(cwd, { force: true, recursive: true });
    });

    it("passes on a greenfield repo (no tags, no published versions) when --first-release is set", async () => {
        const capture = captureStdout();

        try {
            const { toolbox } = makeToolbox(cwd, { firstRelease: true, json: true });

            await doctorHandler(toolbox);

            const joined = capture.chunks.join("");
            const parsed = JSON.parse(joined) as { checks: { name: string; severity: string; status: string }[] };

            const check = parsed.checks.find((c) => c.name === "first-release.repo-not-greenfield");

            expect(check).toBeDefined();
            expect(check!.status).toBe("pass");
            expect(check!.severity).toBe("info");
        } finally {
            capture.restore();
        }
    });

    it("errors out when --first-release is set but a matching release tag exists", async () => {
        // Create a tag matching the default `{name}@{version}` pattern
        // — once present, the workspace is no longer greenfield.
        execFileSync("git", ["tag", "@scope/a@0.0.1"], { cwd });

        const capture = captureStdout();

        try {
            const { toolbox } = makeToolbox(cwd, { firstRelease: true, json: true });

            await doctorHandler(toolbox);

            const joined = capture.chunks.join("");
            const parsed = JSON.parse(joined) as { checks: { message: string; name: string; severity: string; status: string }[] };

            const check = parsed.checks.find((c) => c.name === "first-release.repo-not-greenfield");

            expect(check).toBeDefined();
            expect(check!.status).toBe("fail");
            expect(check!.severity).toBe("error");
            // Message should call out the tag — operators must see what
            // they're conflicting with.
            expect(check!.message).toMatch(/tag/i);
            // The check fires an error → process.exitCode is 1.
            expect(process.exitCode).toBe(1);
        } finally {
            capture.restore();
        }
    });

    it("skips the check entirely when --first-release is NOT set", async () => {
        // Even with a tag present, the check is silent without the flag —
        // doctor is not a "is this greenfield?" probe, it's an opt-in
        // guardrail for the bootstrap workflow.
        execFileSync("git", ["tag", "@scope/a@0.0.1"], { cwd });

        const capture = captureStdout();

        try {
            const { toolbox } = makeToolbox(cwd, { firstRelease: false, json: true });

            await doctorHandler(toolbox);

            const joined = capture.chunks.join("");
            const parsed = JSON.parse(joined) as { checks: { name: string }[] };

            const check = parsed.checks.find((c) => c.name === "first-release.repo-not-greenfield");

            // Not present at all → check was skipped (correct UX).
            expect(check).toBeUndefined();
        } finally {
            capture.restore();
        }
    });
});
