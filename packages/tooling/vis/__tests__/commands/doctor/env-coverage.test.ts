import { mkdirSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { EnvCoveragePosture, EnvCoverageTarget } from "../../../src/commands/doctor/env-coverage";
import {
    buildEnvCoveragePosture,
    describeEnvCoverage,
    describeEnvCoverageTarget,
    ENV_COVERAGE_NAME_LIMIT,
    extractWindowsEnvVars,
} from "../../../src/commands/doctor/env-coverage";
import type { DoctorResults, SectionId } from "../../../src/commands/doctor/sections";
import { buildJsonPayload, shouldFail } from "../../../src/commands/doctor/sections";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../../test-helpers";

const TARGET = "@fix/app:build";

interface Fixture {
    dependencies?: Record<string, string>;
    targets: Record<string, Record<string, unknown>>;
}

/** Writes a one-project workspace whose `build` target runs `command`. */
const writeApp = (root: string, command: string, extra: Record<string, unknown> = {}, fixture: Partial<Fixture> = {}): void => {
    const directory = join(root, "packages", "app");

    mkdirSync(directory, { recursive: true });
    writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "fixture-root", private: true }, undefined, 2));
    writeFileSync(
        join(directory, "package.json"),
        JSON.stringify({ dependencies: fixture.dependencies ?? {}, name: "@fix/app" }, undefined, 2),
    );
    writeFileSync(
        join(directory, "project.json"),
        JSON.stringify({ targets: fixture.targets ?? { build: { command, ...extra } } }, undefined, 2),
    );
};

const findTarget = (posture: EnvCoveragePosture, target: string): EnvCoverageTarget | undefined =>
    posture.targets.find((entry) => entry.target === target);

/**
 * The names reported for the `build` target. `$CONTROL` is always uncovered,
 * so an empty or missing result means the check did not run, not that it
 * found nothing.
 */
const reportedNames = (posture: EnvCoveragePosture): string[] => findTarget(posture, TARGET)?.variables ?? [];

describe(buildEnvCoveragePosture, () => {
    let root: string;

    beforeEach(() => {
        root = createTemporaryDirectory("vis-env-coverage-");
    });

    afterEach(() => {
        cleanupTemporaryDirectory(root);
    });

    it("reports a referenced name that no cache key covers", async () => {
        expect.assertions(4);

        writeApp(root, "echo $UNCOVERED");

        const posture = await buildEnvCoveragePosture({}, root);

        expect(posture.status).toBe("warn");
        expect(posture.targets).toHaveLength(1);
        expect(findTarget(posture, TARGET)).toMatchObject({ total: 1, variables: ["UNCOVERED"] });
        expect(findTarget(posture, TARGET)?.hints).toStrictEqual(["fingerprintEnv", "autoEnvVars", "untrackedEnv"]);
    });

    it("does not report a name covered by fingerprintEnv, exact or glob", async () => {
        expect.assertions(2);

        writeApp(root, "echo $COVERED $CONTROL", { fingerprintEnv: ["COVERED"] });

        expect(reportedNames(await buildEnvCoveragePosture({}, root))).toStrictEqual(["CONTROL"]);

        writeApp(root, "echo $COVERED $CONTROL", { fingerprintEnv: ["COV*"] });

        expect(reportedNames(await buildEnvCoveragePosture({}, root))).toStrictEqual(["CONTROL"]);
    });

    it("does not report a name covered by an env:// input, directly or through a named input", async () => {
        expect.assertions(2);

        writeApp(root, "echo $COVERED $CONTROL", { inputs: ["env://COVERED", "{projectRoot}/**/*"] });

        expect(reportedNames(await buildEnvCoveragePosture({}, root))).toStrictEqual(["CONTROL"]);

        writeApp(root, "echo $COVERED $CONTROL", { inputs: ["build-inputs"] });

        expect(reportedNames(await buildEnvCoveragePosture({ namedInputs: { "build-inputs": ["env://COVERED"] } }, root))).toStrictEqual(["CONTROL"]);
    });

    it("does not report a name covered by workspace envVars or globalEnv", async () => {
        expect.assertions(1);

        writeApp(root, "echo $FROM_ENV_VARS $FROM_GLOBAL $CONTROL");

        const posture = await buildEnvCoveragePosture({ taskRunner: { envVars: ["FROM_ENV_VARS"], globalEnv: ["FROM_GLOBAL"] } }, root);

        expect(reportedNames(posture)).toStrictEqual(["CONTROL"]);
    });

    it("keys $NAME references under autoEnvVars, but still reports %NAME% references", async () => {
        expect.assertions(3);

        writeApp(root, "echo $SHELL_STYLE %WINDOWS_STYLE%");

        const posture = await buildEnvCoveragePosture({ taskRunner: { autoEnvVars: true } }, root);

        expect(reportedNames(posture)).toStrictEqual(["WINDOWS_STYLE"]);
        expect(findTarget(posture, TARGET)?.hints).toStrictEqual(["fingerprintEnv", "untrackedEnv"]);

        // Without autoEnvVars the `$` form is a gap as well.
        expect(reportedNames(await buildEnvCoveragePosture({}, root))).toStrictEqual(["SHELL_STYLE", "WINDOWS_STYLE"]);
    });

    it("does not report a name the user keeps out of the key on purpose", async () => {
        expect.assertions(3);

        writeApp(root, "echo $UNTRACKED_TARGET $UNTRACKED_WORKSPACE $CONTROL", { untrackedEnv: ["UNTRACKED_TARGET"] });

        expect(reportedNames(await buildEnvCoveragePosture({}, root))).toStrictEqual(["CONTROL", "UNTRACKED_WORKSPACE"]);

        writeApp(root, "echo $UNTRACKED_TARGET $UNTRACKED_WORKSPACE $CONTROL", { untrackedEnv: ["UNTRACKED_*"] });

        expect(reportedNames(await buildEnvCoveragePosture({}, root))).toStrictEqual(["CONTROL"]);

        writeApp(root, "echo $UNTRACKED_TARGET $UNTRACKED_WORKSPACE $CONTROL");

        expect(reportedNames(await buildEnvCoveragePosture({ taskRunner: { untrackedEnvVars: ["UNTRACKED_WORKSPACE"] } }, root))).toStrictEqual([
            "CONTROL",
            "UNTRACKED_TARGET",
        ]);
    });

    it("never reports vis-injected or CI names", async () => {
        expect.assertions(1);

        writeApp(
            root,
            "echo $VIS_TASK_SLOTS $VIS_ARG_TAG $INIT_CWD $CI $PATH $HOME $TERM $FORCE_COLOR $GITHUB_SHA $CI_COMMIT_SHA $NODE_OPTIONS $CONTROL",
        );

        expect(reportedNames(await buildEnvCoveragePosture({}, root))).toStrictEqual(["CONTROL"]);
    });

    it("applies clean-mode visibility: a name the child cannot see is not a gap", async () => {
        expect.assertions(2);

        writeApp(root, "echo $ALLOWED $HIDDEN", { options: { env: { allow: ["ALLOWED"], mode: "clean" } } });

        expect(reportedNames(await buildEnvCoveragePosture({}, root))).toStrictEqual(["ALLOWED"]);

        writeApp(root, "echo $ALLOWED $HIDDEN $CONTROL");

        expect(reportedNames(await buildEnvCoveragePosture({ taskRunner: { env: { allow: ["ALLOWED", "CONTROL"], mode: "clean" } } }, root))).toStrictEqual([
            "ALLOWED",
            "CONTROL",
        ]);
    });

    it("skips trace-mode, uncached and always targets", async () => {
        expect.assertions(3);

        writeApp(root, "echo $CONTROL", {}, {
            targets: {
                always: { always: true, command: "echo $ALWAYS_ONLY" },
                build: { command: "echo $CONTROL" },
                nocache: { cache: false, command: "echo $NOCACHE_ONLY" },
                traced: { command: "echo $TRACED_ONLY", hashMode: "trace" },
            },
        });

        const posture = await buildEnvCoveragePosture({}, root);

        expect(posture.targets.map((entry) => entry.target)).toStrictEqual([TARGET]);
        expect(reportedNames(posture)).toStrictEqual(["CONTROL"]);

        // Workspace autoFingerprint routes every target through tracking.
        writeApp(root, "echo $CONTROL");

        await expect(buildEnvCoveragePosture({ taskRunner: { autoFingerprint: true } }, root)).resolves.toStrictEqual({ status: "ok", targets: [] });
    });

    it("counts a framework-inferred env prefix as covered only while framework inference is on", async () => {
        expect.assertions(2);

        writeApp(root, "echo $NEXT_PUBLIC_API $CONTROL", {}, { dependencies: { next: "15.0.0" } });

        expect(reportedNames(await buildEnvCoveragePosture({ taskRunner: { frameworkInference: true } }, root))).toStrictEqual(["CONTROL"]);
        expect(reportedNames(await buildEnvCoveragePosture({}, root))).toStrictEqual(["CONTROL", "NEXT_PUBLIC_API"]);
    });

    it("finds %NAME% references without flagging date formats", async () => {
        expect.assertions(4);

        expect(extractWindowsEnvVars("date +%Y%m%d%H%M && echo %USERNAME%")).toStrictEqual(["USERNAME"]);
        expect(extractWindowsEnvVars("date +%FT%T")).toStrictEqual([]);

        writeApp(root, "date +%Y%m%d%H%M");

        await expect(buildEnvCoveragePosture({}, root)).resolves.toStrictEqual({ status: "ok", targets: [] });

        writeApp(root, "echo %USERNAME%");

        expect(findTarget(await buildEnvCoveragePosture({}, root), TARGET)?.hints).toStrictEqual(["fingerprintEnv", "untrackedEnv"]);
    });

    it("lists at most ENV_COVERAGE_NAME_LIMIT names and counts the rest", async () => {
        expect.assertions(2);

        const names = Array.from({ length: ENV_COVERAGE_NAME_LIMIT + 2 }, (_, index) => `GAP_${String(index).padStart(2, "0")}`);

        writeApp(root, names.map((name) => `$${name}`).join(" "));

        const entry = findTarget(await buildEnvCoveragePosture({}, root), TARGET);

        expect(entry?.variables).toHaveLength(ENV_COVERAGE_NAME_LIMIT);
        expect(entry?.total).toBe(ENV_COVERAGE_NAME_LIMIT + 2);
    });

    it("reports ok with no targets when nothing is referenced", async () => {
        expect.assertions(2);

        writeApp(root, "echo hello");

        await expect(buildEnvCoveragePosture({}, root)).resolves.toStrictEqual({ status: "ok", targets: [] });

        const empty = createTemporaryDirectory("vis-env-coverage-empty-");

        await expect(buildEnvCoveragePosture({}, empty)).resolves.toStrictEqual({ status: "ok", targets: [] });

        cleanupTemporaryDirectory(empty);
    });
});

describe("env coverage output", () => {
    const entry: EnvCoverageTarget = {
        hints: ["fingerprintEnv", "autoEnvVars", "untrackedEnv"],
        target: TARGET,
        total: 10,
        variables: ["A", "B"],
    };

    const results = (posture: EnvCoveragePosture): DoctorResults => {
        return {
            duplicates: [],
            elapsedMs: 0,
            envCoverage: posture,
            installedCount: 0,
            optimizations: [],
            outdated: [],
            runtime: [],
            sections: new Set<SectionId>(),
            socketIssues: { alerts: 0, lowScore: 0 },
            supplyChain: { findings: [], status: "ok" },
            vulnCount: 0,
            workspaceCount: 0,
        };
    };

    it("describes a target with the capped names, the count past the cap and the fix hints", () => {
        expect.assertions(2);

        expect(describeEnvCoverageTarget(entry)).toBe(`${TARGET}: A, B (+8 more). fix: fingerprintEnv, autoEnvVars or untrackedEnv`);
        expect(describeEnvCoverageTarget({ ...entry, hints: ["fingerprintEnv", "untrackedEnv"], total: 2 })).toBe(
            `${TARGET}: A, B. fix: fingerprintEnv or untrackedEnv`,
        );
    });

    it("emits the envCoverage JSON shape with status, target, names, total and hints", () => {
        expect.assertions(2);

        const payload = buildJsonPayload(results({ status: "warn", targets: [entry] }), "pnpm");

        expect(payload.envCoverage).toStrictEqual({
            status: "warn",
            targets: [{ hints: ["fingerprintEnv", "autoEnvVars", "untrackedEnv"], target: TARGET, total: 10, variables: ["A", "B"] }],
        });
        expect(payload.status).toBe("warn");
    });

    it("omits the envCoverage key from JSON when nothing is uncovered", () => {
        expect.assertions(1);

        expect(buildJsonPayload(results({ status: "ok", targets: [] }), "pnpm")).not.toHaveProperty("envCoverage");
    });

    it("produces human lines only when there is a gap, so a clean run prints no block", () => {
        expect.assertions(2);

        expect(describeEnvCoverage({ status: "ok", targets: [] })).toStrictEqual([]);
        expect(describeEnvCoverage({ status: "warn", targets: [entry] })).toStrictEqual([describeEnvCoverageTarget(entry)]);
    });

    it("never changes the exit code by default, and fails under --strict like other warnings", () => {
        expect.assertions(2);

        const warn = results({ status: "warn", targets: [entry] });

        expect(shouldFail(warn, false)).toBe(false);
        expect(shouldFail(warn, true)).toBe(true);
    });
});
