/**
 * Tests for `core/version-resolver.ts` — the disk / registry / git-tag
 * dispatch that feeds `oldVersion` into the release plan (nx parity).
 *
 * Test surface:
 *   - disk mode returns the manifest version verbatim.
 *   - registry mode dispatches via `versionActions.readPublishedVersion()`.
 *     For npm packages that's an `npm view` shell call, intercepted here
 *     via MockRunner.
 *   - registry mode 404 → falls back to manifest with a warning surfaced
 *     through the `fallbackReason` field.
 *   - git-tag mode happy path: at least one matching tag, the highest
 *     semver wins.
 *   - git-tag mode no-matching-tag → falls back to manifest with a
 *     warning that nudges toward `--first-release`.
 *   - per-package override (`packages.&lt;name>.currentVersionResolver`)
 *     wins over the workspace-level setting.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { DependencyGraph } from "../../../src/release/core/dep-graph";
import { NpmAdapter } from "../../../src/release/core/package-managers/npm";
import { MockRunner } from "../../../src/release/core/shell-runner";
import {
    __resetLookupMemoForTests,
    compileReleaseTagRegex,
    REGISTRY_LOOKUP_CONCURRENCY,
    resolveCurrentVersion,
    resolveCurrentVersionsForWorkspace,
    resolveModeForPackage,
} from "../../../src/release/core/version-resolver";
import type { PackageManifest, VisReleaseConfig, WorkspacePackage } from "../../../src/release/types";

const mkPkg = (name: string, version: string, isPrivate = false): WorkspacePackage => {
    const manifest: PackageManifest = { name, version, ...(isPrivate ? { private: true } : {}) };

    return {
        dir: `/r/packages/${name.replace(/^@[^/]+\//, "")}`,
        manifest,
        manifestPath: `/r/packages/${name.replace(/^@[^/]+\//, "")}/package.json`,
        name,
        private: isPrivate,
        version,
    };
};

const mkRunner = (): MockRunner => new MockRunner();

const mkPm = (runner: MockRunner) => {
    // NpmAdapter is the simplest adapter to construct — every readPublished-
    // Version implementation we exercise here goes through `pm.runner.run`,
    // so the adapter's identity is more about wiring than behaviour.
    const adapter = new NpmAdapter(runner);

    return adapter;
};

const mkDepGraph = (pkgs: WorkspacePackage[]): DependencyGraph => new DependencyGraph(pkgs);

describe("resolveCurrentVersion — disk mode", () => {
    it("returns the manifest version verbatim and tags the result as resolvedFrom: disk", async () => {
        expect.hasAssertions();

        const runner = mkRunner();
        const pkg = mkPkg("@scope/a", "1.2.3");

        const result = await resolveCurrentVersion(pkg, "disk", mkDepGraph([pkg]), {
            cwd: "/r",
            pm: mkPm(runner),
            runner,
        });

        expect(result.version).toBe("1.2.3");
        expect(result.resolvedFrom).toBe("disk");
        expect(result.fallbackReason).toBeUndefined();
    });
});

describe("resolveCurrentVersion — registry mode (npm package)", () => {
    it("returns the registry version when `npm view` answers with a semver", async () => {
        expect.hasAssertions();

        const runner = mkRunner();
        const pkg = mkPkg("@scope/a", "1.2.3");

        runner.on("npm", ["view", "@scope/a", "version"], () => {
            return { exitCode: 0, stderr: "", stdout: "2.5.1\n" };
        });

        const result = await resolveCurrentVersion(pkg, "registry", mkDepGraph([pkg]), {
            cwd: "/r",
            pm: mkPm(runner),
            runner,
        });

        expect(result.version).toBe("2.5.1");
        expect(result.resolvedFrom).toBe("registry");
        expect(result.fallbackReason).toBeUndefined();
    });

    it("falls back to the manifest version when `npm view` returns a 404 (non-zero exit, empty stdout)", async () => {
        expect.hasAssertions();

        const runner = mkRunner();
        const pkg = mkPkg("@scope/new-pkg", "0.0.1");

        runner.on("npm", ["view", "@scope/new-pkg", "version"], () => {
            return {
                exitCode: 1,
                stderr: "npm error code E404\nnpm error 404 Not Found",
                stdout: "",
            };
        });

        const result = await resolveCurrentVersion(pkg, "registry", mkDepGraph([pkg]), {
            cwd: "/r",
            pm: mkPm(runner),
            runner,
        });

        // Falls back to disk.
        expect(result.version).toBe("0.0.1");
        expect(result.resolvedFrom).toBe("disk");
        // Reason explains the 404 so the orchestrator can surface a plan warning.
        expect(result.fallbackReason).toMatch(/no version|404|not-yet-published/i);
    });
});

describe("resolveCurrentVersion — git-tag mode", () => {
    it("happy path: finds the highest matching tag and returns its version", async () => {
        expect.hasAssertions();

        const runner = mkRunner();
        const pkg = mkPkg("@scope/a", "1.0.0"); // manifest lags behind tags

        // `git tag --list <glob> --sort=-v:refname` returns tags newest-first.
        runner.on("git", ["tag", "--list"], () => {
            return {
                exitCode: 0,
                stderr: "",
                stdout: ["@scope/a@2.3.1", "@scope/a@2.3.0", "@scope/a@2.2.0", "@scope/a@1.9.5"].join("\n"),
            };
        });

        const result = await resolveCurrentVersion(pkg, "git-tag", mkDepGraph([pkg]), {
            cwd: "/r",
            pm: mkPm(runner),
            runner,
            workspaceConfig: { releaseTagPattern: "{name}@{version}" },
        });

        expect(result.version).toBe("2.3.1");
        expect(result.resolvedFrom).toBe("git-tag");
    });

    it("no matching tag → falls back to manifest, with a warning nudging toward --first-release", async () => {
        expect.hasAssertions();

        const runner = mkRunner();
        const pkg = mkPkg("@scope/freshpkg", "0.0.1");

        runner.on("git", ["tag", "--list"], () => {
            return { exitCode: 0, stderr: "", stdout: "" };
        });

        const result = await resolveCurrentVersion(pkg, "git-tag", mkDepGraph([pkg]), {
            cwd: "/r",
            pm: mkPm(runner),
            runner,
            workspaceConfig: { releaseTagPattern: "{name}@{version}" },
        });

        expect(result.version).toBe("0.0.1");
        expect(result.resolvedFrom).toBe("disk");
        expect(result.fallbackReason).toMatch(/no git tag matched/i);
        expect(result.fallbackReason).toMatch(/--first-release/);
    });
});

describe("resolveModeForPackage — precedence", () => {
    it("per-package override wins over workspace-level", () => {
        expect.hasAssertions();

        const mode = resolveModeForPackage({ currentVersionResolver: "registry" }, { currentVersionResolver: "git-tag" }, false);

        expect(mode).toBe("git-tag");
    });

    it("workspace-level wins over the default disk", () => {
        expect.hasAssertions();

        const mode = resolveModeForPackage({ currentVersionResolver: "registry" }, undefined, false);

        expect(mode).toBe("registry");
    });

    it("`firstRelease` forces disk regardless of config", () => {
        expect.hasAssertions();

        const mode = resolveModeForPackage({ currentVersionResolver: "registry" }, { currentVersionResolver: "git-tag" }, true);

        expect(mode).toBe("disk");
    });

    it("default is disk when nothing is configured", () => {
        expect.hasAssertions();

        const mode = resolveModeForPackage(undefined, undefined, false);

        expect(mode).toBe("disk");
    });
});

describe("resolveCurrentVersionsForWorkspace — batch resolution", () => {
    beforeEach(() => {
        // Each test creates its own packages with isolated names so the
        // memo doesn't bleed across cases, but explicitly reset for
        // belt-and-braces — the memo lives at module scope.
        __resetLookupMemoForTests();
    });

    it("resolves every package in parallel and surfaces per-package fallbacks as warnings", async () => {
        expect.hasAssertions();

        const runner = mkRunner();
        const a = mkPkg("@scope/a", "1.0.0");
        const b = mkPkg("@scope/b", "2.0.0");
        const depGraph = mkDepGraph([a, b]);
        const perPkg = new Map([["@scope/b", { currentVersionResolver: "disk" }]]);

        // a uses the workspace default (registry); b uses a per-pkg override (disk).

        // npm view @scope/a — 404 to exercise the fallback path
        runner.on("npm", ["view", "@scope/a", "version"], () => {
            return {
                exitCode: 1,
                stderr: "404",
                stdout: "",
            };
        });

        const workspaceConfig: VisReleaseConfig = { currentVersionResolver: "registry" };

        const { versions, warnings } = await resolveCurrentVersionsForWorkspace([a, b], depGraph, workspaceConfig, perPkg, {
            cwd: "/r",
            firstRelease: false,
            pm: mkPm(runner),
            runner,
        });

        // a fell back to its manifest version; b is disk by per-pkg override.
        expect(versions.get("@scope/a")).toBe("1.0.0");
        expect(versions.get("@scope/b")).toBe("2.0.0");

        // Only the registry fallback emits a warning — disk mode is silent.
        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toMatch(/currentVersionResolver \(registry\)/);
        expect(warnings[0]).toMatch(/@scope\/a/);
    });

    it("`firstRelease: true` forces every package to disk even when config says otherwise", async () => {
        expect.hasAssertions();

        const runner = mkRunner();
        const a = mkPkg("@scope/a", "1.0.0");
        const depGraph = mkDepGraph([a]);

        // Set up a registry handler that would 404 — but we should never hit it.
        let registryCalled = false;

        runner.on("npm", ["view"], () => {
            registryCalled = true;

            return { exitCode: 0, stderr: "", stdout: "9.9.9\n" };
        });

        const { versions, warnings } = await resolveCurrentVersionsForWorkspace([a], depGraph, { currentVersionResolver: "registry" }, new Map(), {
            cwd: "/r",
            firstRelease: true,
            pm: mkPm(runner),
            runner,
        });

        expect(versions.get("@scope/a")).toBe("1.0.0");
        // firstRelease short-circuits BEFORE the registry call — no warning.
        expect(warnings).toHaveLength(0);
        expect(registryCalled).toBe(false);
    });
});

/**
 * C-3 — registry storm. The unbounded `Promise.all` historically fired
 * one parallel `npm view` per package, which on a 49-package monorepo
 * is enough to trip crates.io's 1 rps quota / PyPI's per-IP throttle.
 * The cap + memo together must:
 *   - never exceed REGISTRY_LOOKUP_CONCURRENCY in-flight probes at once
 *   - de-duplicate repeated lookups for the same `name@mode@version`
 *     within a process (a follow-up `buildContext` shouldn't re-fetch).
 */
describe("resolveCurrentVersionsForWorkspace — concurrency cap (C-3)", () => {
    beforeEach(() => {
        __resetLookupMemoForTests();
    });

    /**
     * Minimal counting runner: holds responses behind a manually-released
     * deferred so we can observe how many lookups are in-flight at once.
     * Returns 9.9.9 when finally released so every package resolves
     * cleanly (no warnings).
     */
    class CountingRunner {
        public concurrentPeak = 0;

        public inFlight = 0;

        public totalCalls = 0;

        private releases: (() => void)[] = [];

        public async run(
            _command: string,
            _args: ReadonlyArray<string>,
            _options: { cwd: string; env?: NodeJS.ProcessEnv; silent?: boolean },
        ): Promise<{ exitCode: number; stderr: string; stdout: string }> {
            this.totalCalls += 1;
            this.inFlight += 1;
            this.concurrentPeak = Math.max(this.concurrentPeak, this.inFlight);

            await new Promise<void>((resolve) => {
                this.releases.push(resolve);
            });

            this.inFlight -= 1;

            return { exitCode: 0, stderr: "", stdout: "9.9.9\n" };
        }

        public releaseAll(): void {
            const queued = this.releases;

            this.releases = [];

            for (const r of queued) {
                r();
            }
        }
    }

    it("never exceeds REGISTRY_LOOKUP_CONCURRENCY in-flight registry probes (cap = 4 by default)", async () => {
        expect.hasAssertions();

        const counting = new CountingRunner();
        // NpmAdapter's `readPublishedVersion` runs through `pm.runner.run`,
        // so the CountingRunner must be the adapter's runner — not just
        // the `options.runner` (which is only used for the git-tag path).
        const pm = new NpmAdapter(counting);
        const pkgs = Array.from({ length: 100 }, (_, i) => mkPkg(`@scope/pkg-${i}`, "0.0.1"));
        const depGraph = mkDepGraph(pkgs);

        // Kick off the resolver — it will block on the CountingRunner's
        // deferred until we release. Don't await yet.
        const resolverPromise = resolveCurrentVersionsForWorkspace(pkgs, depGraph, { currentVersionResolver: "registry" }, new Map(), {
            cwd: "/r",
            firstRelease: false,
            pm,
            runner: counting,
        });

        // Yield to the event loop a few times so all the limiter slots
        // that CAN start actually start. Anything beyond the cap should
        // still be queued, not in-flight.
        for (let i = 0; i < 20; i++) {
            await Promise.resolve();
        }

        // The interesting assertion — in-flight is never higher than the
        // documented cap, even though we dispatched 100 lookups at once.
        expect(counting.concurrentPeak).toBeLessThanOrEqual(REGISTRY_LOOKUP_CONCURRENCY);
        expect(counting.inFlight).toBeLessThanOrEqual(REGISTRY_LOOKUP_CONCURRENCY);

        // Drain — release the deferred batch repeatedly until the whole
        // resolver completes. Each release lets one job finish; the
        // limiter then enqueues the next from the queue.
        while (counting.inFlight > 0 || counting.totalCalls < pkgs.length) {
            counting.releaseAll();

            await Promise.resolve();
        }

        // Final drain pass — any tail jobs.
        counting.releaseAll();
        await resolverPromise;

        // Every package was resolved exactly once.
        expect(counting.totalCalls).toBe(pkgs.length);
        expect(counting.concurrentPeak).toBeLessThanOrEqual(REGISTRY_LOOKUP_CONCURRENCY);
    });

    it("memoises repeat lookups within the same process — a second resolve hits the cache (one fetch only)", async () => {
        expect.hasAssertions();

        const runner = mkRunner();
        const a = mkPkg("@scope/memoed", "1.0.0");
        const depGraph = mkDepGraph([a]);
        let fetchCount = 0;

        runner.on("npm", ["view", "@scope/memoed", "version"], () => {
            fetchCount += 1;

            return { exitCode: 0, stderr: "", stdout: "5.0.0\n" };
        });

        const first = await resolveCurrentVersionsForWorkspace([a], depGraph, { currentVersionResolver: "registry" }, new Map(), {
            cwd: "/r",
            firstRelease: false,
            pm: mkPm(runner),
            runner,
        });

        const second = await resolveCurrentVersionsForWorkspace([a], depGraph, { currentVersionResolver: "registry" }, new Map(), {
            cwd: "/r",
            firstRelease: false,
            pm: mkPm(runner),
            runner,
        });

        // Both invocations resolved to the same registry value.
        expect(first.versions.get("@scope/memoed")).toBe("5.0.0");
        expect(second.versions.get("@scope/memoed")).toBe("5.0.0");
        // But the registry was hit exactly ONCE — the second call hit the memo.
        expect(fetchCount).toBe(1);
    });

    it("skipRegistryLookup: true falls back to disk for every package, never probing the registry", async () => {
        expect.hasAssertions();

        const runner = mkRunner();
        const a = mkPkg("@scope/skip-a", "1.0.0");
        const b = mkPkg("@scope/skip-b", "2.0.0");
        const depGraph = mkDepGraph([a, b]);
        let registryCalled = false;

        runner.on("npm", ["view"], () => {
            registryCalled = true;

            return { exitCode: 0, stderr: "", stdout: "9.9.9\n" };
        });

        const { versions, warnings } = await resolveCurrentVersionsForWorkspace(
            [a, b],
            depGraph,
            { currentVersionResolver: "registry" }, // configured registry mode
            new Map(),
            { cwd: "/r", firstRelease: false, pm: mkPm(runner), runner, skipRegistryLookup: true },
        );

        // Every package fell back to its manifest version.
        expect(versions.get("@scope/skip-a")).toBe("1.0.0");
        expect(versions.get("@scope/skip-b")).toBe("2.0.0");
        // Registry was NEVER called.
        expect(registryCalled).toBe(false);
        // No warning surfaced — the operator opted out of the lookup
        // deliberately at the entry-point.
        expect(warnings).toHaveLength(0);
    });
});

/**
 * N-7 — git-tag fallback honours releaseTagPattern. Previously a custom
 * pattern like `v{version}` worked for the strict regex but the second-
 * chance fallback was a literal `${pkg.name}@` prefix, so a workspace
 * with a non-`{name}@{version}` pattern could yield "no candidates"
 * when the strict regex happened to under-match.
 */
describe("git-tag mode — releaseTagPattern compilation (N-7)", () => {
    it("compileReleaseTagRegex: a custom pattern 'v{version}' matches 'v1.2.3' but not random 'v1'", () => {
        expect.hasAssertions();

        const re = compileReleaseTagRegex("v{version}", { name: "@scope/foo" });

        const m = re.exec("v1.2.3");

        expect(m).not.toBeNull();
        expect(m![1]).toBe("1.2.3");

        // Bare `v1` is NOT a valid semver — the matcher rejects partial versions.
        expect(re.exec("v1")).toBeNull();
        // A tag that doesn't even start with `v` is rejected.
        expect(re.exec("1.2.3")).toBeNull();
        // Extra trailing data is rejected (anchored matcher).
        expect(re.exec("v1.2.3-suffix-not-prerelease!")).toBeNull();
    });

    it("compileReleaseTagRegex: a name-prefix pattern '{name}-v{version}' anchors on the package name", () => {
        expect.hasAssertions();

        const re = compileReleaseTagRegex("{name}-v{version}", { name: "cerebro" });

        expect(re.exec("cerebro-v3.0.0")![1]).toBe("3.0.0");
        // Wrong name is rejected.
        expect(re.exec("other-v3.0.0")).toBeNull();
    });

    it("git-tag mode honours a workspace-configured releaseTagPattern: 'v{version}' (no literal name@ fallback)", async () => {
        expect.hasAssertions();

        const runner = mkRunner();
        const pkg = mkPkg("@scope/a", "0.0.1");

        // Tag history uses `v{version}` (no package name in the tag).
        runner.on("git", ["tag", "--list"], () => {
            return {
                exitCode: 0,
                stderr: "",
                stdout: ["v1.4.0", "v1.3.0", "v1.0.0"].join("\n"),
            };
        });

        const result = await resolveCurrentVersion(pkg, "git-tag", mkDepGraph([pkg]), {
            cwd: "/r",
            pm: mkPm(runner),
            runner,
            workspaceConfig: { releaseTagPattern: "v{version}" },
        });

        expect(result.version).toBe("1.4.0");
        expect(result.resolvedFrom).toBe("git-tag");
    });

    it("git-tag mode rejects tags that don't match the configured pattern (no second-chance literal-prefix fallback)", async () => {
        expect.hasAssertions();

        const runner = mkRunner();
        const pkg = mkPkg("@scope/a", "0.0.1");

        // The tag history is `@scope/a@1.0.0` style — but the operator
        // configured `v{version}`. With the old fallback this would
        // incorrectly succeed via the literal `${pkg.name}@` prefix;
        // with the fix it falls back to manifest with a warning.
        runner.on("git", ["tag", "--list"], () => {
            return {
                exitCode: 0,
                stderr: "",
                stdout: ["@scope/a@1.0.0"].join("\n"),
            };
        });

        const result = await resolveCurrentVersion(pkg, "git-tag", mkDepGraph([pkg]), {
            cwd: "/r",
            pm: mkPm(runner),
            runner,
            workspaceConfig: { releaseTagPattern: "v{version}" },
        });

        // The glob `v*` doesn't even match `@scope/a@1.0.0`, so we'd
        // typically hit the "no tags returned" branch — but the
        // important assertion is that we don't silently succeed via a
        // literal-prefix backdoor.
        expect(result.resolvedFrom).toBe("disk");
        expect(result.version).toBe("0.0.1");
    });
});
