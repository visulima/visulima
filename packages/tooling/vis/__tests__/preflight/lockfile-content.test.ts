import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { checkLockfileFreshness } from "../../src/preflight/lockfile";

const LOCKFILE_BODY = "lockfileVersion: '9.0'\nimporters:\n  .:\n    dependencies:\n      left-pad: 1.3.0\n";

describe("lockfile preflight — content comparison", () => {
    let scratch: string;

    /**
     * A checkout whose lockfile is newer than the install marker — the shape
     * every CI job has after `git clone` over a restored `node_modules`, and
     * the one the mtime check alone always called stale.
     */
    const seed = (options: { copy?: string; lockfile?: string }): void => {
        writeFileSync(join(scratch, "pnpm-lock.yaml"), options.lockfile ?? LOCKFILE_BODY);

        mkdirSync(join(scratch, "node_modules/.pnpm"), { recursive: true });
        writeFileSync(join(scratch, "node_modules/.modules.yaml"), "hoistPattern:\n  - '*'\n");

        if (options.copy !== undefined) {
            writeFileSync(join(scratch, "node_modules/.pnpm/lock.yaml"), options.copy);
        }

        // Age the install markers so mtime alone would report "stale".
        const past = new Date(Date.now() - 60_000);

        utimesSync(join(scratch, "node_modules/.modules.yaml"), past, past);

        if (options.copy !== undefined) {
            utimesSync(join(scratch, "node_modules/.pnpm/lock.yaml"), past, past);
        }
    };

    beforeEach(() => {
        scratch = mkdtempSync(join(tmpdir(), "vis-lockfile-"));
    });

    afterEach(() => {
        rmSync(scratch, { force: true, recursive: true });
    });

    it("passes on a byte-identical copy even though the lockfile is newer", () => {
        expect.assertions(2);

        seed({ copy: LOCKFILE_BODY });

        const result = checkLockfileFreshness(scratch, { inCi: true });

        expect(result.failure).toBeUndefined();
        expect(result.detail?.comparedBy).toBe("content");
    });

    it("does NOT fail on a pruned copy — a --prod or --filter install writes one legitimately", () => {
        expect.assertions(2);

        // pnpm's copy records what is actually linked, so a partial install
        // differs from the workspace lockfile without anything being stale.
        // Treating that as drift hard-failed CI and told the user to re-run
        // the very install that produced it.
        seed({ copy: "lockfileVersion: '9.0'\nimporters:\n  .: {}\n" });

        const result = checkLockfileFreshness(scratch, { inCi: true });

        expect(result.detail?.comparedBy).toBe("mtime");
        expect(result.failure).toBe("stale-install");
    });

    it("falls back to mtime when the manager writes no copy at all", () => {
        expect.assertions(2);

        seed({});

        const result = checkLockfileFreshness(scratch, { inCi: true });

        expect(result.detail?.comparedBy).toBe("mtime");
        expect(result.failure).toBe("stale-install");
    });
});
