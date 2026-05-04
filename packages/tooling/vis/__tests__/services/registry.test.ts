import { stat } from "node:fs/promises";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
    deleteEntry,
    getRegistryDir,
    isAlive,
    pruneDead,
    readAllEntries,
    readEntry,
    REGISTRY_FILE_MODE,
    slugify,
    withServiceLock,
    writeEntry,
} from "../../src/services/registry";
import type { ServiceEntry } from "../../src/services/types";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../test-helpers";

const buildEntry = (overrides: Partial<ServiceEntry> = {}): ServiceEntry => {
    return {
        command: "node -e 'setInterval(()=>{},1000)'",
        config: {},
        cwd: "/tmp",
        env: {},
        id: "pkg:db",
        logFile: "/tmp/pkg__db.log",
        pid: process.pid,
        slug: slugify("pkg:db"),
        startedAt: new Date().toISOString(),
        visVersion: "0.0.0-test",
        ...overrides,
    };
};

describe("services/registry", () => {
    let workspaceRoot: string;
    let homeOverride: string;
    let originalHome: string | undefined;

    beforeEach(() => {
        // Per-test HOME so each registry directory lives under a fresh
        // tmp tree — keeps the user's real ~/.vis-services untouched.
        workspaceRoot = createTemporaryDirectory("vis-test-ws-");
        homeOverride = createTemporaryDirectory("vis-test-home-");
        originalHome = process.env["HOME"];
        process.env["HOME"] = homeOverride;
    });

    afterEach(() => {
        if (originalHome === undefined) {
            delete process.env["HOME"];
        } else {
            process.env["HOME"] = originalHome;
        }

        cleanupTemporaryDirectory(workspaceRoot);
        cleanupTemporaryDirectory(homeOverride);
    });

    describe(slugify, () => {
        it("replaces colons with double underscore", () => {
            expect.assertions(1);
            expect(slugify("apps/api:db")).toBe("apps_api__db");
        });

        it("replaces forward slashes with single underscore", () => {
            expect.assertions(1);
            expect(slugify("@scope/pkg:test")).toBe("@scope_pkg__test");
        });

        it("returns a string with no path-unsafe chars", () => {
            expect.assertions(1);
            expect(slugify("a/b:c/d:e")).toBe("a_b__c_d__e");
        });
    });

    describe(getRegistryDir, () => {
        it("creates the directory under the user homedir on demand", async () => {
            expect.assertions(2);

            const directory = await getRegistryDir(workspaceRoot);

            expect(directory.startsWith(homeOverride)).toBe(true);
            expect(directory).toContain(".vis-services");
        });

        it("returns the same directory for the same workspace", async () => {
            expect.assertions(1);

            const a = await getRegistryDir(workspaceRoot);
            const b = await getRegistryDir(workspaceRoot);

            expect(a).toBe(b);
        });

        it("returns different directories for different workspaces", async () => {
            expect.assertions(1);

            const other = createTemporaryDirectory("vis-test-ws2-");

            try {
                const a = await getRegistryDir(workspaceRoot);
                const b = await getRegistryDir(other);

                expect(a).not.toBe(b);
            } finally {
                cleanupTemporaryDirectory(other);
            }
        });
    });

    describe("write + read round-trip", () => {
        it("returns the same entry that was written", async () => {
            expect.assertions(1);

            const entry = buildEntry({ id: "pkg:db" });

            await writeEntry(workspaceRoot, entry);

            await expect(readEntry(workspaceRoot, "pkg:db")).resolves.toEqual(entry);
        });

        it("returns undefined for an unknown id", async () => {
            expect.assertions(1);
            await expect(readEntry(workspaceRoot, "nope:nope")).resolves.toBeUndefined();
        });

        it("returns every entry from readAllEntries", async () => {
            expect.assertions(2);

            await writeEntry(workspaceRoot, buildEntry({ id: "a:db", slug: slugify("a:db") }));
            await writeEntry(workspaceRoot, buildEntry({ id: "b:cache", slug: slugify("b:cache") }));

            const all = await readAllEntries(workspaceRoot);
            const ids = all.map((e) => e.id).sort();

            expect(all).toHaveLength(2);
            expect(ids).toEqual(["a:db", "b:cache"]);
        });
    });

    describe(deleteEntry, () => {
        it("removes the on-disk entry", async () => {
            expect.assertions(2);

            await writeEntry(workspaceRoot, buildEntry({ id: "pkg:db" }));

            await expect(readEntry(workspaceRoot, "pkg:db")).resolves.toBeDefined();

            await deleteEntry(workspaceRoot, "pkg:db");

            await expect(readEntry(workspaceRoot, "pkg:db")).resolves.toBeUndefined();
        });

        it("is idempotent for unknown ids", async () => {
            expect.assertions(1);

            await expect(deleteEntry(workspaceRoot, "missing:id")).resolves.toBeUndefined();
        });
    });

    describe(isAlive, () => {
        it("returns true for the current process", () => {
            expect.assertions(1);
            expect(isAlive(process.pid)).toBe(true);
        });

        it("returns false for an obviously dead PID", () => {
            expect.assertions(1);
            // PID 0 (idle) errors with EPERM/EINVAL on most systems; we want
            // a PID that's almost certainly free. 99_999_999 is safely above
            // the kernel's pid_max on every common config.
            expect(isAlive(99_999_999)).toBe(false);
        });
    });

    describe(pruneDead, () => {
        it("removes entries with dead PIDs and returns pruned ids plus survivors", async () => {
            expect.assertions(5);

            await writeEntry(workspaceRoot, buildEntry({ id: "alive:svc", pid: process.pid }));
            await writeEntry(workspaceRoot, buildEntry({ id: "dead:svc", pid: 99_999_999, slug: slugify("dead:svc") }));

            const { pruned, surviving } = await pruneDead(workspaceRoot);

            expect(pruned).toEqual(["dead:svc"]);
            expect(surviving).toHaveLength(1);
            expect(surviving[0]?.id).toBe("alive:svc");
            await expect(readEntry(workspaceRoot, "dead:svc")).resolves.toBeUndefined();
            await expect(readEntry(workspaceRoot, "alive:svc")).resolves.toBeDefined();
        });

        it("returns empty pruned list and all entries when everything is alive", async () => {
            expect.assertions(2);

            await writeEntry(workspaceRoot, buildEntry({ id: "alive:svc", pid: process.pid }));

            const result = await pruneDead(workspaceRoot);

            expect(result.pruned).toEqual([]);
            expect(result.surviving.map((e) => e.id)).toEqual(["alive:svc"]);
        });
    });

    describe("atomic write", () => {
        it("never observes a half-written entry under concurrent writers", async () => {
            expect.assertions(1);

            const writers = Array.from({ length: 20 }, (_, index) =>
                writeEntry(workspaceRoot, buildEntry({ command: `cmd-${String(index)}`, id: "race:svc" })));

            await Promise.all(writers);

            // The final entry must be one of the values we wrote — never a
            // truncated or merged blob.
            const final = await readEntry(workspaceRoot, "race:svc");

            expect(final?.command.startsWith("cmd-")).toBe(true);
        });

        it("writes entry files with mode 0o600 (owner-only)", async () => {
            expect.assertions(1);

            await writeEntry(workspaceRoot, buildEntry({ id: "perm:svc" }));

            const directory = await getRegistryDir(workspaceRoot);
            const stats = await stat(join(directory, "perm__svc.json"));

            // Mask off the type bits — only the permission bits matter.
            // eslint-disable-next-line no-bitwise
            expect(stats.mode & 0o777).toBe(REGISTRY_FILE_MODE);
        });
    });

    describe(withServiceLock, () => {
        it("serializes overlapping invocations for the same id", async () => {
            expect.assertions(2);

            // Without the lock, the two `fn`s would interleave and the
            // observed order would be A1 B1 A2 B2. The lock forces
            // strict A* before B* (or vice-versa).
            const order: string[] = [];

            const slow = async (label: string): Promise<void> => {
                order.push(`${label}1`);
                await new Promise((resolve) => {
                    setTimeout(resolve, 50);
                });
                order.push(`${label}2`);
            };

            await Promise.all([withServiceLock(workspaceRoot, "lock:svc", () => slow("A")), withServiceLock(workspaceRoot, "lock:svc", () => slow("B"))]);

            const aIndex = order.indexOf("A2");
            const bIndex = order.indexOf("B1");

            // Either A finished completely before B started, or B
            // finished completely before A started — never interleaved.
            expect(order).toHaveLength(4);
            expect(aIndex < bIndex || order.indexOf("B2") < order.indexOf("A1")).toBe(true);
        });

        it("does not serialize across different ids", async () => {
            expect.assertions(1);

            // Same workspace, different ids → independent locks → must
            // run concurrently (verified by total wall time < 2 × delay).
            const start = Date.now();

            await Promise.all([
                withServiceLock(workspaceRoot, "lock:a", async () => {
                    await new Promise((resolve) => {
                        setTimeout(resolve, 100);
                    });
                }),
                withServiceLock(workspaceRoot, "lock:b", async () => {
                    await new Promise((resolve) => {
                        setTimeout(resolve, 100);
                    });
                }),
            ]);

            // Generous slack for slow CI; serial would be > 200ms.
            expect(Date.now() - start).toBeLessThan(180);
        });

        it("releases the lock when the wrapped function throws", async () => {
            expect.assertions(2);

            await expect(
                withServiceLock(workspaceRoot, "lock:throws", async () => {
                    throw new Error("intentional");
                }),
            ).rejects.toThrow("intentional");

            // Second acquisition must succeed — proves the lock file
            // was unlinked even on the throw path.
            const result = await withServiceLock(workspaceRoot, "lock:throws", async () => "ok");

            expect(result).toBe("ok");
        });
    });
});
