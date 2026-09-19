/**
 * `vis release doctor` — workspace-discovered vs. release-managed
 * (visulima/visulima#863).
 *
 * `ctx.packages` is the *release-managed* set, so an empty list used to be
 * reported as `workspace-discovered: No packages discovered. Ensure your
 * package manager's workspace block resolves.` — an error pointing at
 * `pnpm-workspace.yaml` even when the workspace resolved perfectly and the
 * only thing missing was `defaultManaged` / a per-package `"vis-release":
 * { "managed": true }`.
 *
 * The two states are now separate checks:
 *   - `workspace-discovered`      — does the package manager see any project?
 *   - `release-managed-packages`  — has any of them opted in?
 *
 * Only the first can be an error; "workspace resolves, nothing opted in yet"
 * is a legitimate mid-migration state, so it warns and the doctor exits 0.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import doctorHandler from "../../../src/commands/release/doctor/handler";
import { buildContext } from "../../../src/release/core/orchestrator";
import { fixturePackageManager, RELEASE_SUITE_TIMEOUT, removeTemporaryDirectoryWithRetry, restorePristineStdout } from "../../test-helpers";

// These tests shell out to real git/pnpm and transpile the release/core graph;
// the 30s global default is too tight on Windows CI. See RELEASE_SUITE_TIMEOUT.
vi.setConfig({ hookTimeout: RELEASE_SUITE_TIMEOUT, testTimeout: RELEASE_SUITE_TIMEOUT });

interface DoctorCheck {
    message: string;
    name: string;
    severity: string;
    status: string;
}

const writeJson = (path: string, value: unknown): void => {
    writeFileSync(path, `${JSON.stringify(value, null, 4)}\n`);
};

/**
 * Create a throwaway pnpm workspace + git repo for one doctor run.
 * @param options Fixture knobs.
 * @param options.defaultManaged Value for `release.defaultManaged`; the key is omitted entirely when undefined.
 * @param options.extraPackages How many additional, deliberately unmanaged `packages/extra-N` members to
 * create — used to prove the workspace count and the release-managed count are reported separately.
 * @param options.namedRoot Whether the root manifest carries a `name` — `pnpm -r ls` only reports
 * manifests that have one, so an unnamed root plus no members is how a workspace that genuinely
 * resolves to zero projects is simulated.
 * @param options.privatePackage Whether `packages/a` is `private: true` — `isPackageManaged` drops
 * private packages unless `release.privatePackages.version` is set, independently of `defaultManaged`.
 * @param options.withPackage Whether to create `packages/a` (a nameable workspace member).
 */
const setupRepo = (
    options: { defaultManaged?: boolean; extraPackages?: number; namedRoot?: boolean; privatePackage?: boolean; withPackage?: boolean } = {},
): string => {
    const { defaultManaged, extraPackages = 0, namedRoot = true, privatePackage = false, withPackage = true } = options;
    const cwd = mkdtempSync(join(tmpdir(), "vis-doctor-managed-"));

    writeJson(join(cwd, "package.json"), {
        ...(namedRoot ? { name: "fixture-root" } : {}),
        packageManager: fixturePackageManager(),
        private: true,
        version: "0.0.0",
        workspaces: ["packages/*"],
    });

    writeFileSync(join(cwd, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");

    if (withPackage) {
        mkdirSync(join(cwd, "packages", "a"), { recursive: true });
        writeJson(join(cwd, "packages", "a", "package.json"), { name: "@scope/a", private: privatePackage, version: "0.0.1" });
    }

    for (let index = 0; index < extraPackages; index += 1) {
        const dir = join(cwd, "packages", `extra-${index}`);

        mkdirSync(dir, { recursive: true });
        writeJson(join(dir, "package.json"), { name: `@scope/extra-${index}`, private: false, version: "0.0.1" });
    }

    mkdirSync(join(cwd, ".vis", "release"), { recursive: true });

    const block = { release: { acknowledgeUnstable: true, ...(defaultManaged === undefined ? {} : { defaultManaged }) } };

    writeFileSync(join(cwd, "vis.config.cjs"), `module.exports = ${JSON.stringify(block, null, 4)};\n`);

    execFileSync("git", ["init", "-q", "--initial-branch", "main"], { cwd });
    execFileSync("git", ["config", "user.email", "test@test"], { cwd });
    execFileSync("git", ["config", "user.name", "Test"], { cwd });
    execFileSync("git", ["config", "commit.gpgsign", "false"], { cwd });
    execFileSync("git", ["config", "tag.gpgSign", "false"], { cwd });
    execFileSync("git", ["add", "."], { cwd });
    execFileSync("git", ["commit", "-q", "-m", "initial"], { cwd });

    return cwd;
};

const makeToolbox = (cwd: string) =>
    ({
        argument: {},
        logger: {
            error: () => undefined,
            info: () => undefined,
            warn: () => undefined,
        } as never,
        options: { json: true } as never,
        workspaceRoot: cwd,
    }) as never;

const runDoctor = async (cwd: string): Promise<DoctorCheck[]> => {
    const chunks: string[] = [];
    const originalWrite = process.stdout.write.bind(process.stdout);

    (process.stdout as { write: unknown }).write = (chunk: string | Uint8Array): boolean => {
        chunks.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));

        return true;
    };

    try {
        await doctorHandler(makeToolbox(cwd));
    } finally {
        (process.stdout as { write: typeof originalWrite }).write = originalWrite;
    }

    return (JSON.parse(chunks.join("")) as { checks: DoctorCheck[] }).checks;
};

const find = (checks: DoctorCheck[], name: string): DoctorCheck | undefined => checks.find((check) => check.name === name);

describe("vis release doctor — workspace-discovered vs release-managed (#863)", () => {
    let cwd: string;
    const originalExitCode = process.exitCode;
    const originalEnvironment = { ...process.env };

    // Warm the `release/core` lazy-`import()` graph once so the first real test
    // isn't charged the cold transpile cost on top of its own subprocess spawns.
    beforeAll(async () => {
        const scratch = setupRepo({ defaultManaged: true });

        try {
            await buildContext({ cwd: scratch });
        } catch {
            // Warm-up only — failures here are not test failures.
        } finally {
            await removeTemporaryDirectoryWithRetry(scratch);
        }
    });

    beforeEach(() => {
        process.exitCode = 0;
        // The doctor's `oidc-available` check fires error-severity when CI=true
        // and no NPM_TOKEN; unrelated noise for these tests.
        delete process.env.CI;
        delete process.env.GITHUB_ACTIONS;
        delete process.env.NPM_TOKEN;
        delete process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
    });

    afterEach(async () => {
        restorePristineStdout();
        process.exitCode = originalExitCode;
        process.env = originalEnvironment;

        if (cwd) {
            await removeTemporaryDirectoryWithRetry(cwd);
        }
    });

    it("passes both checks when packages are release-managed", async () => {
        expect.assertions(5);

        cwd = setupRepo({ defaultManaged: true });

        const checks = await runDoctor(cwd);
        const discovered = find(checks, "workspace-discovered");
        const managed = find(checks, "release-managed-packages");

        expect(discovered).toMatchObject({ severity: "info", status: "pass" });
        expect(discovered?.message).toMatch(/^Discovered \d+ workspace package\(s\)\.$/);
        expect(managed).toMatchObject({ severity: "info", status: "pass" });
        expect(managed?.message).toMatch(/^\d+ of \d+ package\(s\) are release-managed\.$/);
        expect(process.exitCode).toBe(0);
    });

    it("blames opt-in, not the workspace block, when packages exist but none is managed", async () => {
        expect.assertions(6);

        // No `defaultManaged`, no per-package `vis-release.managed` — the exact
        // shape reported in #863.
        cwd = setupRepo();

        const checks = await runDoctor(cwd);
        const discovered = find(checks, "workspace-discovered");
        const managed = find(checks, "release-managed-packages");

        // The workspace itself resolved — that check must NOT be the error.
        expect(discovered).toMatchObject({ severity: "info", status: "pass" });
        expect(discovered?.message).not.toContain("workspace block");

        expect(managed).toMatchObject({ severity: "warn", status: "fail" });
        expect(managed?.message).toContain("No release-managed packages");
        expect(managed?.message).toContain("Set release.defaultManaged: true in vis.config.ts, or add \"vis-release\": { \"managed\": true } to a package.json.");

        // A warn, not an error: mid-migration is a legitimate state.
        expect(process.exitCode).toBe(0);
    });

    it("keeps the workspace-block error when discovery genuinely finds nothing", async () => {
        expect.assertions(4);

        cwd = setupRepo({ namedRoot: false, withPackage: false });

        const checks = await runDoctor(cwd);
        const discovered = find(checks, "workspace-discovered");
        const managed = find(checks, "release-managed-packages");

        expect(discovered).toMatchObject({ severity: "error", status: "fail" });
        expect(discovered?.message).toBe("No packages discovered. Ensure your package manager's workspace block resolves.");
        expect(managed).toMatchObject({ status: "skip" });
        expect(process.exitCode).toBe(1);
    });

    it("reports the workspace count, not the managed count, when only some packages are managed", async () => {
        expect.hasAssertions();

        // 4 workspace packages, exactly 1 opted in. `ctx.packages` is the
        // managed subset, so reporting its length here would print
        // "Discovered 1 workspace package(s)." — re-conflating the two numbers
        // this check exists to separate (visulima/visulima#863).
        // `listWorkspacePackages` counts the workspace root as a project, so
        // this fixture is: root + packages/a + 3 extras == 5 discovered, 1 managed.
        cwd = setupRepo({ extraPackages: 3 });
        writeJson(join(cwd, "packages", "a", "package.json"), {
            name: "@scope/a",
            private: false,
            version: "0.0.1",
            "vis-release": { managed: true },
        });

        const checks = await runDoctor(cwd);
        const discovered = checks.find((check) => check.name === "workspace-discovered");
        const managed = checks.find((check) => check.name === "release-managed-packages");

        expect(discovered?.status).toBe("pass");
        expect(discovered?.message).toBe("Discovered 5 workspace package(s).");
        expect(managed?.status).toBe("pass");
        expect(managed?.message).toBe("1 of 5 package(s) are release-managed.");
    });

    it("names the private-package rule when defaultManaged is on but every package is private", async () => {
        expect.assertions(3);

        // `isPackageManaged` drops private packages regardless of
        // `defaultManaged`, so pointing only at the two opt-in knobs would be
        // its own dead end.
        cwd = setupRepo({ defaultManaged: true, privatePackage: true });

        const checks = await runDoctor(cwd);
        const managed = find(checks, "release-managed-packages");

        expect(managed).toMatchObject({ severity: "warn", status: "fail" });
        expect(managed?.message).toContain("Every discovered package is private");
        expect(managed?.message).toContain("release.privatePackages.version");
    });

    it("says why the plan is empty instead of reporting a clean 'No pending releases.'", async () => {
        expect.assertions(2);

        cwd = setupRepo();

        const checks = await runDoctor(cwd);
        const plan = find(checks, "plan-readable");

        expect(plan?.status).toBe("pass");
        expect(plan?.message).toBe("No pending releases — no package is release-managed, so the plan is always empty.");
    });
});
