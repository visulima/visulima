/**
 * `vis release notifications test` — dry-run channel verification.
 *
 * The handler exercises four code paths:
 *   1. Read `release.notifications` from the workspace config.
 *   2. Materialise channels (slack/discord/webhook + plugins).
 *   3. Filter by --channel.
 *   4. Dispatch + capture per-channel pass/fail.
 *
 * Network is stubbed via `vi.spyOn(globalThis, "fetch")` — no real HTTP
 * leaves the test, regardless of which channel kind is in play.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { access, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import notificationsHandler from "../../../src/commands/release/notifications/handler";

const writeJson = (path: string, value: unknown): void => {
    writeFileSync(path, `${JSON.stringify(value, null, 4)}\n`);
};

const writeVisConfigCjs = (cwd: string, releaseBlock: Record<string, unknown>): void => {
    const block = { release: { ...releaseBlock, acknowledgeUnstable: true } };

    writeFileSync(join(cwd, "vis.config.cjs"), `module.exports = ${JSON.stringify(block, null, 4)};\n`);
};

const setupFixture = (releaseBlock: Record<string, unknown>): string => {
    const cwd = mkdtempSync(join(tmpdir(), "vis-notifications-handler-"));

    writeJson(join(cwd, "package.json"), {
        name: "fixture-root",
        packageManager: "pnpm@10.0.0",
        private: true,
        version: "0.0.0",
        workspaces: ["packages/*"],
    });

    writeFileSync(join(cwd, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
    mkdirSync(join(cwd, "packages"), { recursive: true });
    mkdirSync(join(cwd, "packages", "a"), { recursive: true });
    writeJson(join(cwd, "packages", "a", "package.json"), { name: "@scope/a", version: "1.0.0" });
    mkdirSync(join(cwd, ".vis", "release"), { recursive: true });

    writeVisConfigCjs(cwd, releaseBlock);

    execFileSync("git", ["init", "-q", "--initial-branch", "main"], { cwd });
    execFileSync("git", ["config", "user.email", "test@test"], { cwd });
    execFileSync("git", ["config", "user.name", "Test"], { cwd });
    execFileSync("git", ["add", "."], { cwd });
    execFileSync("git", ["commit", "-q", "-m", "initial"], { cwd });

    return cwd;
};

interface CallResult {
    errors: string[];
    exitCode: number | undefined;
    infos: string[];
    warns: string[];
}

const callHandler = async (cwd: string, options: Record<string, unknown>): Promise<CallResult> => {
    const infos: string[] = [];
    const errors: string[] = [];
    const warns: string[] = [];

    const logger = {
        error: (message: string) => errors.push(message),
        info: (message: string) => infos.push(message),
        warn: (message: string) => warns.push(message),
    };

    const priorExit = process.exitCode;

    process.exitCode = 0;

    // The handler reads through the injected `toolbox.fs` (CerebroFs); node:fs/promises
    // satisfies that surface for the methods it uses.
    const fs = { access, mkdir, readdir, readFile, rm, stat, writeFile } as never;

    await notificationsHandler({ fs, logger, options: { action: "test", ...options }, workspaceRoot: cwd });

    const exitCode = typeof process.exitCode === "number" ? process.exitCode : 0;

    process.exitCode = priorExit;

    return { errors, exitCode, infos, warns };
};

// TODO(windows): buildContext loads vis.config via the native importTs loader,
// which intermittently deadlocks on win32 (~30s timeout + EBUSY on temp rmdir).
// Skip on Windows until the loader is fixed on a real Windows box. See
// project_vis_windows_release_layered_fixes_pr687.
const isWindows = process.platform === "win32";

describe.skipIf(isWindows)("vis release notifications test", () => {
    let cwd: string | undefined;
    let fetchSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        cwd = undefined;
        fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response("ok", { status: 200 }),
        );
    });

    afterEach(async () => {
        fetchSpy.mockRestore();

        if (cwd) {
            await rm(cwd, { force: true, recursive: true });
        }
    });

    it("happy path — all channels succeed and exit code is 0", async () => {
        expect.hasAssertions();

        cwd = setupFixture({
            notifications: {
                discord: { webhook: "https://discord.com/api/webhooks/123/abc" },
                slack: { webhook: "https://hooks.slack.com/services/T/B/123" },
                webhook: { url: "https://example.com/hook" },
            },
        });

        const result = await callHandler(cwd, {});

        // Three POSTs — one per channel kind.
        expect(fetchSpy).toHaveBeenCalledTimes(3);
        expect(result.exitCode).toBe(0);
        expect(result.errors).toStrictEqual([]);
        // Per-channel "OK" lines.
        expect(result.infos.filter((m) => m.includes("OK"))).toHaveLength(3);
    });

    it("one channel fails → exit code is non-zero", async () => {
        expect.hasAssertions();

        cwd = setupFixture({
            notifications: {
                slack: { webhook: "https://hooks.slack.com/services/T/B/123" },
                webhook: { url: "https://example.com/hook" },
            },
        });

        // First call (slack) succeeds, second call (webhook) fails.
        fetchSpy.mockReset();
        fetchSpy.mockResolvedValueOnce(new Response("ok", { status: 200 }));
        fetchSpy.mockResolvedValueOnce(new Response("server error", { status: 500 }));

        const result = await callHandler(cwd, {});

        expect(result.exitCode).toBe(1);
        // One success, one failure rendered.
        expect(result.infos.some((m) => m.includes("OK"))).toBe(true);
        expect(result.errors.some((m) => m.includes("FAIL"))).toBe(true);
    });

    it("--channel=slack filters to only the slack channel", async () => {
        expect.hasAssertions();

        cwd = setupFixture({
            notifications: {
                discord: { webhook: "https://discord.com/api/webhooks/123/abc" },
                slack: { webhook: "https://hooks.slack.com/services/T/B/123" },
                webhook: { url: "https://example.com/hook" },
            },
        });

        const result = await callHandler(cwd, { channel: "slack" });

        // Only the slack POST should have fired.
        expect(fetchSpy).toHaveBeenCalledTimes(1);

        const firstCallUrl = (fetchSpy.mock.calls[0]![0] as URL | string).toString();

        expect(firstCallUrl).toContain("hooks.slack.com");
        expect(result.exitCode).toBe(0);
    });

    it("--channel=slack:eng filters to the id'd slack channel only", async () => {
        expect.hasAssertions();

        cwd = setupFixture({
            notifications: {
                slack: [
                    { id: "eng", webhook: "https://hooks.slack.com/services/T/B/eng" },
                    { id: "ops", webhook: "https://hooks.slack.com/services/T/B/ops" },
                ],
            },
        });

        const result = await callHandler(cwd, { channel: "slack:eng" });

        // Exactly one fetch (the eng channel), not the ops channel.
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        expect((fetchSpy.mock.calls[0]![0] as URL | string).toString()).toContain("/eng");
        expect(result.exitCode).toBe(0);
    });

    it("--custom-context reads JSON from disk and forwards it to channels", async () => {
        expect.hasAssertions();

        cwd = setupFixture({
            notifications: {
                webhook: { url: "https://example.com/hook" },
            },
        });

        const customPath = join(cwd, "fake.json");

        await writeFile(
            customPath,
            JSON.stringify({
                channel: "alpha",
                completedAt: "2026-05-22T14:00:00.000Z",
                published: [
                    { name: "@operator/custom", url: "https://example.com/p", version: "9.9.9" },
                ],
                repo: "operator/custom",
                skipped: [],
            }),
        );

        const result = await callHandler(cwd, { customContext: customPath });

        expect(result.exitCode).toBe(0);
        expect(fetchSpy).toHaveBeenCalledTimes(1);

        // Body sent to the webhook should reflect the operator-supplied
        // context, not the synthetic default.
        const init = fetchSpy.mock.calls[0]![1] as RequestInit | undefined;
        const body = typeof init?.body === "string" ? init.body : "";

        expect(body).toContain("@operator/custom");
        expect(body).toContain("9.9.9");
    });

    it("no notifications configured → graceful exit with hint, exit code 0", async () => {
        expect.hasAssertions();

        cwd = setupFixture({});

        const result = await callHandler(cwd, {});

        expect(fetchSpy).not.toHaveBeenCalled();
        expect(result.exitCode).toBe(0);
        expect(result.infos.some((m) => m.toLowerCase().includes("no notifications configured"))).toBe(true);
    });

    it("--channel filter matching nothing → exit non-zero with hint", async () => {
        expect.hasAssertions();

        cwd = setupFixture({
            notifications: {
                slack: { webhook: "https://hooks.slack.com/services/T/B/123" },
            },
        });

        const result = await callHandler(cwd, { channel: "discord" });

        expect(fetchSpy).not.toHaveBeenCalled();
        expect(result.exitCode).toBe(1);
        expect(result.errors.some((m) => m.toLowerCase().includes("no channels matched"))).toBe(true);
    });

    it("--json emits machine-readable output", async () => {
        expect.hasAssertions();

        cwd = setupFixture({
            notifications: {
                webhook: { url: "https://example.com/hook" },
            },
        });

        const writes: string[] = [];
        const original = process.stdout.write.bind(process.stdout);

        process.stdout.write = ((chunk: string | Uint8Array) => {
            writes.push(typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk));

            return true;
        });

        try {
            await callHandler(cwd, { json: true });
        } finally {
            process.stdout.write = original;
        }

        const combined = writes.join("");
        // Parseable JSON with the documented shape.
        const parsed = JSON.parse(combined) as { channels: { ok: boolean }[]; ok: boolean };

        expect(parsed.ok).toBe(true);
        expect(parsed.channels.length).toBeGreaterThan(0);
    });
});
