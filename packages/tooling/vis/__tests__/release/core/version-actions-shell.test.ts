import { describe, expect, it } from "vitest";

import type { CommandRunner } from "../../../src/release/core/package-managers/interface";
import type { PublishContext } from "../../../src/release/core/version-actions/interface";
import { ShellPublishActions } from "../../../src/release/core/version-actions/shell";

/**
 * Generic `versionActions: "shell"` plugin — runs a configured shell
 * command to publish, so vis can drive crates.io / PyPI / RubyGems /
 * Maven / containers without ecosystem-specific code.
 *
 * Key contract:
 *   1. Refuses to run without the trust gate (`allowCustomCommands`)
 *   2. Refuses without a `publishCommand`
 *   3. Short-circuits with `alreadyPublished: true` when `checkPublished`
 *      reports the new version is live
 *   4. Interpolates {{name}}/{{version}}/{{tag}}/{{registry}} with
 *      shell-quoted values (no injection)
 *   5. Runs an optional `buildCommand` before `publishCommand`
 *   6. Sequential array publishCommands; first non-zero exit aborts
 */

interface RunCall {
    args: ReadonlyArray<string>;
    command: string;
}

const buildRunner = (responses: { exitCode?: number; stderr?: string; stdout?: string }[]): { calls: RunCall[]; runner: CommandRunner } => {
    const calls: RunCall[] = [];
    let cursor = 0;

    const runner: CommandRunner = {
        run: async (command, args) => {
            calls.push({ args, command });

            const next = responses[cursor];

            cursor += 1;

            return next
                ? { exitCode: next.exitCode ?? 0, stderr: next.stderr ?? "", stdout: next.stdout ?? "" }
                : { exitCode: 1, stderr: "no more stub responses", stdout: "" };
        },
    };

    return { calls, runner };
};

const ctx = (overrides: {
    allowCustomCommands?: boolean | string[];
    buildCommand?: string;
    checkPublished?: string;
    dryRun?: boolean;
    publishCommand?: string | string[];
    registry?: string;
    runner?: CommandRunner;
    tag?: string;
    version?: string;
} = {}): PublishContext => ({
    catalogs: {} as never,
    dryRun: overrides.dryRun,
    perPackageConfig: {
        buildCommand: overrides.buildCommand,
        checkPublished: overrides.checkPublished,
        publishCommand: overrides.publishCommand,
    },
    pkg: {
        dir: "/cwd",
        manifest: { name: "@scope/pkg", version: "1.0.0" },
        manifestPath: "/cwd/package.json",
        name: "@scope/pkg",
        private: false,
        version: "1.0.0",
    } as never,
    pm: {
        id: "npm" as const,
        minVersion: "8.0.0",
        runner: overrides.runner ?? buildRunner([]).runner,
    } as never,
    registry: overrides.registry,
    release: {
        bumpLevel: "patch" as const,
        changeFiles: [],
        name: "@scope/pkg",
        newVersion: overrides.version ?? "1.0.1",
        oldVersion: "1.0.0",
    },
    tag: overrides.tag,
    versionedManifestByName: new Map(),
    workspaceConfig: {
        allowCustomCommands: overrides.allowCustomCommands,
    },
} as never);

describe("shellPublishActions: trust-gate refusal", () => {
    it("throws CONFIG_INVALID when allowCustomCommands is missing", async () => {
        const actions = new ShellPublishActions();

        await expect(actions.publish(ctx({
            publishCommand: "echo publish",
        }))).rejects.toMatchObject({ code: "CONFIG_INVALID" });
    });

    it("throws when package is not in the allow-list", async () => {
        const actions = new ShellPublishActions();

        await expect(actions.publish(ctx({
            allowCustomCommands: ["@other/pkg"],
            publishCommand: "echo publish",
        }))).rejects.toMatchObject({ code: "CONFIG_INVALID" });
    });

    it("throws when allowed but no publishCommand", async () => {
        const actions = new ShellPublishActions();

        await expect(actions.publish(ctx({
            allowCustomCommands: true,
        }))).rejects.toMatchObject({ code: "CONFIG_INVALID" });
    });
});

describe("shellPublishActions: dryRun", () => {
    it("returns published: true without invoking anything", async () => {
        const { calls, runner } = buildRunner([]);
        const actions = new ShellPublishActions();

        const result = await actions.publish(ctx({
            allowCustomCommands: true,
            dryRun: true,
            publishCommand: "cargo publish",
            runner,
        }));

        expect(result.published).toBe(true);
        expect(result.output).toContain("[dry-run / shell]");
        expect(calls).toHaveLength(0);
    });
});

describe("shellPublishActions: idempotency via checkPublished", () => {
    it("returns alreadyPublished: true when checkPublished reports the new version", async () => {
        // First runner call: checkPublished → stdout matches new version.
        const { calls, runner } = buildRunner([
            { exitCode: 0, stdout: "1.0.1\n" },
        ]);
        const actions = new ShellPublishActions();

        const result = await actions.publish(ctx({
            allowCustomCommands: true,
            checkPublished: "echo 1.0.1",
            publishCommand: "must-not-run",
            runner,
            version: "1.0.1",
        }));

        expect(result.alreadyPublished).toBe(true);
        expect(result.published).toBe(false);
        // Only checkPublished ran — not the publishCommand.
        expect(calls).toHaveLength(1);
    });

    it("proceeds with publishCommand when checkPublished reports an older version", async () => {
        const { calls, runner } = buildRunner([
            { exitCode: 0, stdout: "1.0.0\n" }, // check
            { exitCode: 0, stdout: "" }, // publishCommand
        ]);
        const actions = new ShellPublishActions();

        const result = await actions.publish(ctx({
            allowCustomCommands: true,
            checkPublished: "echo 1.0.0",
            publishCommand: "echo published",
            runner,
            version: "1.0.1",
        }));

        expect(result.published).toBe(true);
        expect(calls).toHaveLength(2);
    });

    it("ignores checkPublished failure (non-zero exit) and proceeds with publish", async () => {
        const { calls, runner } = buildRunner([
            { exitCode: 1, stderr: "registry unreachable" }, // check fails
            { exitCode: 0, stdout: "" }, // publishCommand
        ]);
        const actions = new ShellPublishActions();

        await actions.publish(ctx({
            allowCustomCommands: true,
            checkPublished: "false",
            publishCommand: "echo published",
            runner,
            version: "1.0.1",
        }));

        expect(calls).toHaveLength(2);
    });
});

describe("shellPublishActions: interpolation", () => {
    it("substitutes {{name}}/{{version}}/{{tag}}/{{registry}} in the publishCommand", async () => {
        const { calls, runner } = buildRunner([{ exitCode: 0, stdout: "" }]);
        const actions = new ShellPublishActions();

        await actions.publish(ctx({
            allowCustomCommands: true,
            publishCommand: "publish {{name}} {{version}} --tag {{tag}} --registry {{registry}}",
            registry: "https://crates.io",
            runner,
            tag: "latest",
            version: "1.2.3",
        }));

        const cmd = calls[0]!.args[calls[0]!.args.length - 1] as string;

        expect(cmd).toContain("1.2.3");
        expect(cmd).toContain("@scope/pkg");
        expect(cmd).toContain("latest");
        expect(cmd).toContain("crates.io");
    });

    it("shell-quotes the substituted values (no injection)", async () => {
        const { calls, runner } = buildRunner([{ exitCode: 0, stdout: "" }]);
        const actions = new ShellPublishActions();

        // The default fixture pkg name is "@scope/pkg" — already safe.
        // A more aggressive test would use a malicious package name,
        // but that would require constructing a separate fixture.
        // For now, verify the value is properly quoted via single quotes.
        await actions.publish(ctx({
            allowCustomCommands: true,
            publishCommand: "echo {{name}}",
            runner,
        }));

        const cmd = calls[0]!.args[calls[0]!.args.length - 1] as string;

        expect(cmd).toMatch(/'@scope\/pkg'/);
    });
});

describe("shellPublishActions: buildCommand + sequential publishCommand", () => {
    it("runs buildCommand before publishCommand and stops at first non-zero exit", async () => {
        const { calls, runner } = buildRunner([
            { exitCode: 0, stdout: "" }, // buildCommand
            { exitCode: 0, stdout: "" }, // publishCommand[0]
            { exitCode: 1, stderr: "boom" }, // publishCommand[1] — fails
        ]);
        const actions = new ShellPublishActions();

        await expect(actions.publish(ctx({
            allowCustomCommands: true,
            buildCommand: "cargo build",
            publishCommand: ["cargo publish step 1", "cargo publish step 2"],
            runner,
        }))).rejects.toMatchObject({ code: "PUBLISH_FAILED" });

        // 3 calls: build + first publishCommand + second publishCommand
        expect(calls).toHaveLength(3);
    });

    it("does NOT run publishCommand if buildCommand fails", async () => {
        const { calls, runner } = buildRunner([
            { exitCode: 1, stderr: "compile error" }, // buildCommand fails
        ]);
        const actions = new ShellPublishActions();

        await expect(actions.publish(ctx({
            allowCustomCommands: true,
            buildCommand: "cargo build",
            publishCommand: "cargo publish",
            runner,
        }))).rejects.toMatchObject({ code: "PUBLISH_FAILED" });

        expect(calls).toHaveLength(1);
    });
});
