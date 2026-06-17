/**
 * In-process micro-benchmarks for vis's dispatch hot paths.
 *
 * Companion to the hyperfine shell harness in this directory. The shell scripts
 * measure END-TO-END process wall-clock (cerebro boot + jiti + spawn) and can
 * only be run with hyperfine; vitest runs IN-PROCESS, so it cannot see process
 * startup. What it CAN measure — and what hyperfine cannot isolate — is the cost
 * of vis's OWN logic that runs on every `vis run` / `vis install` invocation:
 * package-manager detection, installer resolution, lockfile-drift detection, and
 * semver range checks. This is the layer we control and optimize; keeping it
 * here lets us catch an algorithmic regression that the ~40ms Node-boot floor
 * would otherwise hide in the hyperfine numbers.
 *
 * Run with `pnpm --filter @visulima/vis run bench`.
 */
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, bench, describe } from "vitest";

import { detectLockfileDrift, detectPm, resolveInstaller } from "../../src/pm/pm-runner";
import { satisfies } from "../../src/runtime/toolchain";

// ── Fixtures: isolated single-lockfile workspaces, built once. ───────────────
// detectPm/resolveInstaller read the lockfile family on disk, so each PM gets a
// clean dir with exactly one lockfile (a dir with competing lockfiles would
// exercise a different, ambiguous branch).
const roots: string[] = [];

const makeWorkspace = (lockfile: string, lockBody = ""): string => {
    const dir = mkdtempSync(join(tmpdir(), "vis-bench-internals-"));
    roots.push(dir);
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "bench-ws", version: "1.0.0" }));
    writeFileSync(join(dir, lockfile), lockBody);

    return dir;
};

const pnpmDir = makeWorkspace("pnpm-lock.yaml", "lockfileVersion: '9.0'\n");
const bunDir = makeWorkspace("bun.lock", "{}\n");
const npmDir = makeWorkspace("package-lock.json", JSON.stringify({ lockfileVersion: 3 }));

// An aube installer over a dir carrying a foreign (pnpm) lockfile — the only
// shape for which detectLockfileDrift does real work (it early-returns otherwise).
const aubeInstaller = { name: "aube" as const, useCorepack: false, version: "latest" };

// A representative batch of semver checks, mirroring engines/devEngines gating.
const SEMVER_CASES: ReadonlyArray<readonly [string, string]> = [
    ["22.14.0", "^22.14.0 || >=24.10.0"],
    ["24.10.0", ">=24.10.0"],
    ["18.19.0", "^22.14.0"],
    ["20.11.0", ">=18 <22"],
    ["1.2.3", "~1.2.0"],
    ["5.5.4", "5.x"],
];

afterAll(() => {
    // Best-effort cleanup; tmp dirs are reaped by the OS regardless.
    for (const dir of roots) {
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
            (require("node:fs") as typeof import("node:fs")).rmSync(dir, { force: true, recursive: true });
        } catch {
            /* ignore */
        }
    }
});

describe("dispatch internals · package-manager detection", () => {
    bench("detectPm · pnpm workspace", () => {
        detectPm(pnpmDir);
    });

    bench("detectPm · bun workspace", () => {
        detectPm(bunDir);
    });

    bench("detectPm · npm workspace", () => {
        detectPm(npmDir);
    });
});

describe("dispatch internals · installer resolution", () => {
    bench("resolveInstaller · auto (detect → pnpm)", () => {
        resolveInstaller(pnpmDir, {});
    });

    bench("resolveInstaller · explicit backend (no fs probe)", () => {
        resolveInstaller(pnpmDir, { backend: "pnpm" });
    });
});

describe("dispatch internals · lockfile-drift detection", () => {
    bench("detectLockfileDrift · aube over foreign lockfile", () => {
        detectLockfileDrift(pnpmDir, aubeInstaller);
    });
});

describe("dispatch internals · semver gating (pure)", () => {
    bench("satisfies · engines batch", () => {
        for (const [actual, range] of SEMVER_CASES) {
            satisfies(actual, range);
        }
    });
});
