import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, expectTypeOf, it } from "vitest";

import { acquireLock, lockFilePath, releaseLock } from "../../../src/release/core/state";
import { VisReleaseError } from "../../../src/release/errors";

describe("state — process-level lock (RFC §19.1)", () => {
    let cwd: string;
    const changesDir = ".vis/release";

    beforeEach(() => {
        cwd = mkdtempSync(join(tmpdir(), "vis-lock-"));
    });

    afterEach(async () => {
        const fs = await import("node:fs/promises");

        await fs.rm(cwd, { force: true, recursive: true });
    });

    it("writes a lock file with current PID + timestamp", async () => {
        expect.hasAssertions();

        const path = await acquireLock(cwd, changesDir);

        expect(path).toBe(lockFilePath(cwd, changesDir));

        const lockContent = JSON.parse(readFileSync(path, "utf8")) as { acquiredAt: string; pid: number };

        expect(lockContent.pid).toBe(process.pid);

        expectTypeOf(lockContent.acquiredAt).toBeString();

        expect(new Date(lockContent.acquiredAt).getTime()).toBeGreaterThan(Date.now() - 5000);
    });

    it("releaseLock removes the file", async () => {
        expect.hasAssertions();

        await acquireLock(cwd, changesDir);
        await releaseLock(cwd, changesDir);

        const fs = await import("node:fs/promises");

        await expect(fs.access(lockFilePath(cwd, changesDir))).rejects.toThrow();
    });

    it("releaseLock is a no-op when no lock exists", async () => {
        expect.hasAssertions();
        await expect(releaseLock(cwd, changesDir)).resolves.toBeUndefined();
    });

    it("refuses to acquire when held by a live PID (current process)", async () => {
        expect.hasAssertions();

        await acquireLock(cwd, changesDir);

        await expect(acquireLock(cwd, changesDir)).rejects.toThrow(VisReleaseError);
        // Format is `Release lock held by <host>:<pid>` when hostname is recorded
        // (post Fix #7), with a `PID <n>` fallback for legacy lockfiles missing it.
        await expect(acquireLock(cwd, changesDir)).rejects.toThrow(/Release lock held by (?:[^\s:]+:\d+|PID \d+)/);
    });

    it("takes over a stale lock (dead PID)", async () => {
        // Pick a PID that's almost certainly not running.
        expect.hasAssertions();

        const fakeDeadPid = 999_999;

        mkdirSync(join(cwd, changesDir), { recursive: true });
        writeFileSync(
            lockFilePath(cwd, changesDir),
            JSON.stringify({ acquiredAt: new Date().toISOString(), pid: fakeDeadPid }),
        );

        // Should not throw — stale lock is taken over.
        const path = await acquireLock(cwd, changesDir);

        const newContent = JSON.parse(readFileSync(path, "utf8"));

        expect(newContent.pid).toBe(process.pid);
    });

    it("takes over an old lock (older than 1h) even if PID is live", async () => {
        // Use a definitely-live PID (us) but timestamp from 2 hours ago.
        expect.hasAssertions();

        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

        mkdirSync(join(cwd, changesDir), { recursive: true });
        writeFileSync(
            lockFilePath(cwd, changesDir),
            JSON.stringify({ acquiredAt: twoHoursAgo, pid: process.pid }),
        );

        const path = await acquireLock(cwd, changesDir);

        const newContent = JSON.parse(readFileSync(path, "utf8")) as { acquiredAt: string; pid: number };

        // Lock should have been replaced — acquiredAt is fresh.
        expect(new Date(newContent.acquiredAt).getTime()).toBeGreaterThan(Date.now() - 5000);
    });

    it("takes over an unparseable lock (treats as stale)", async () => {
        expect.hasAssertions();

        mkdirSync(join(cwd, changesDir), { recursive: true });
        writeFileSync(lockFilePath(cwd, changesDir), "not valid json");

        const path = await acquireLock(cwd, changesDir);

        const newContent = JSON.parse(readFileSync(path, "utf8"));

        expect(newContent.pid).toBe(process.pid);
    });

    it("uses O_EXCL: only one of two parallel acquires can succeed (RFC §19.1)", async () => {
        // Race two acquires at the same instant. With O_EXCL, exactly one
        // should succeed; the loser sees the live PID lock and throws.
        expect.hasAssertions();

        const results = await Promise.allSettled([
            acquireLock(cwd, changesDir),
            acquireLock(cwd, changesDir),
        ]);

        const fulfilled = results.filter((r) => r.status === "fulfilled");
        const rejected = results.filter((r) => r.status === "rejected");

        expect(fulfilled).toHaveLength(1);
        expect(rejected).toHaveLength(1);
        expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(VisReleaseError);
    });
});
