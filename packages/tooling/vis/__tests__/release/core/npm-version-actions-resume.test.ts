import { describe, expect, it } from "vitest";

import type { CommandRunner } from "../../../src/release/core/package-managers/interface";
import { NpmVersionActions } from "../../../src/release/core/version-actions/npm";

/**
 * Coverage for the resume-staged-publish path: when `resumeStageId` is
 * set in the PublishContext, the action MUST NOT pack + publish — the
 * tarball is already on the registry. Re-packing would either be
 * rejected by npm as a duplicate version (best case) or create a
 * parallel stage that confuses maintainers (worst case).
 *
 * The action should jump straight to `waitForStageDecision(existing.id)`
 * via the injected runner and translate the decision back into a
 * PublishResult identical in shape to a fresh publish.
 */

interface RunCall {
    args: ReadonlyArray<string>;
    command: string;
}

const buildRunner = (responses: { args?: ReadonlyArray<string>; exitCode?: number; stdout?: string }[]): { calls: RunCall[]; runner: CommandRunner } => {
    const calls: RunCall[] = [];
    let cursor = 0;

    const runner: CommandRunner = {
        run: async (command, args) => {
            calls.push({ args, command });

            const next = responses[cursor];

            cursor += 1;

            return next
                ? { exitCode: next.exitCode ?? 0, stderr: "", stdout: next.stdout ?? "" }
                : { exitCode: 1, stderr: "no more stub responses", stdout: "" };
        },
    };

    return { calls, runner };
};

const baseContext = (overrides: { resumeStageId?: string; stageEnabled?: boolean } = {}) => {
    const runner = overrides.stageEnabled
        ? buildRunner([
            // stage view: still pending
            { stdout: JSON.stringify({ id: "stage-xyz" }) },
            // stage view again: gone (decision made)
            { exitCode: 1, stdout: "" },
            // npm view: tarball URL → approved
            { exitCode: 0, stdout: "https://registry.npmjs.org/@scope/pkg/-/pkg-1.2.0.tgz" },
        ])
        : buildRunner([]);

    return {
        catalogs: { default: undefined },
        cleanPackageJsonConfig: undefined,
        dryRun: false,
        otp: undefined,
        perPackageConfig: {},
        pkg: {
            dir: "/cwd",
            manifest: { name: "@scope/pkg", version: "1.1.0" },
            manifestPath: "/cwd/package.json",
            name: "@scope/pkg",
            private: false,
            version: "1.1.0",
        },
        pm: {
            // The resume path should NOT invoke any pm method — these
            // throw so the test fails loudly if pack/publish is touched.
            detectVersion: async () => "10.0.0",
            id: "npm" as const,
            installLockfileOnly: async () => { throw new Error("must not install on resume"); },
            list: async () => [],
            minVersion: "8.0.0",
            pack: async () => { throw new Error("must not pack on resume"); },
            publish: async () => { throw new Error("must not publish on resume"); },
            readCatalogYaml: async () => undefined,
            runner: runner.runner,
        } as never,
        provenance: false,
        registry: undefined,
        release: {
            bumpLevel: "patch" as const,
            changeFiles: [],
            name: "@scope/pkg",
            newVersion: "1.2.0",
            oldVersion: "1.1.0",
        },
        resumeStageId: overrides.resumeStageId,
        runner: runner.runner,
        runnerCalls: runner.calls,
        tag: "latest",
        versionedManifestByName: new Map(),
        workspaceConfig: {
            publish: {
                stage: overrides.stageEnabled
                    ? { pollIntervalMs: 1, timeoutMs: 60_000 }
                    : false,
            },
        },
    };
};

describe("npmVersionActions.publish: resume path", () => {
    it("does NOT pack or publish — only waits on the existing stage decision", async () => {
        expect.hasAssertions();

        const actions = new NpmVersionActions();
        const ctx = baseContext({ resumeStageId: "stage-xyz", stageEnabled: true });

        const result = await actions.publish(ctx as never);

        // The decision-detect runs `npm stage view` then `npm view`.
        // We must NOT see any pack / publish in the recorded calls.
        // Join the full args so multi-word probes (`npm stage view`) are
        // visible to the substring assertions below — args[0] alone would
        // only ever show `npm stage`.
        const commandSummary = ctx.runnerCalls.map((c) => `${c.command} ${c.args.join(" ")}`);

        expect(commandSummary.some((s) => s.startsWith("npm pack"))).toBe(false);
        expect(commandSummary.some((s) => s.startsWith("npm publish"))).toBe(false);
        expect(commandSummary.some((s) => s.includes("stage view"))).toBe(true);
        expect(commandSummary.some((s) => s.includes("view"))).toBe(true);

        expect(result.published).toBe(true);
        expect(result.output).toContain("[resumed]");
    });

    it("throws CONFIG_INVALID when publish.stage is disabled but resume is requested", async () => {
        expect.hasAssertions();

        const actions = new NpmVersionActions();
        const ctx = baseContext({ resumeStageId: "stage-xyz", stageEnabled: false });

        await expect(actions.publish(ctx as never)).rejects.toMatchObject({
            code: "CONFIG_INVALID",
        });
    });

    it("returns `stage-rejected` on the resume path when the wait decides rejected", async () => {
        expect.hasAssertions();

        const actions = new NpmVersionActions();
        // Set up runner: stage view gone, npm view returns nothing → rejected
        const { calls, runner } = buildRunner([
            { exitCode: 1, stdout: "" }, // stage view → 404
            { exitCode: 1, stdout: "" }, // npm view → no tarball
        ]);

        const ctx = {
            ...baseContext({ resumeStageId: "stage-xyz", stageEnabled: true }),
            pm: {
                detectVersion: async () => "10.0.0",
                pack: async () => { throw new Error("must not pack on resume"); },
                publish: async () => { throw new Error("must not publish on resume"); },
                runner,
            },
            runner,
            runnerCalls: calls,
        };

        const result = await actions.publish(ctx as never);

        expect(result.published).toBe(false);
        expect(result.output).toContain("stage-rejected");
        expect(result.stageId).toBe("stage-xyz");
    });

    it("returns `stage-timeout` on the resume path when the wait deadline elapses", async () => {
        expect.hasAssertions();

        const actions = new NpmVersionActions();
        // Set up runner: stage view always pending → timeout
        const { calls, runner } = buildRunner(
            Array.from({ length: 20 }, () => { return { stdout: JSON.stringify({ id: "stage-xyz" }) }; }),
        );

        const ctx = {
            ...baseContext({ resumeStageId: "stage-xyz", stageEnabled: true }),
            pm: {
                detectVersion: async () => "10.0.0",
                pack: async () => { throw new Error("must not pack on resume"); },
                publish: async () => { throw new Error("must not publish on resume"); },
                runner,
            },
            runner,
            runnerCalls: calls,
            workspaceConfig: {
                publish: { stage: { pollIntervalMs: 1, timeoutMs: 20 } },
            },
        };

        const result = await actions.publish(ctx as never);

        expect(result.published).toBe(false);
        expect(result.output).toContain("stage-timeout");
    });
});
