import { mkdirSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import runExecute from "../../../src/commands/run/handler";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../../test-helpers";

describe("vis run reports target properties written under options", () => {
    let workspaceRoot: string;

    const seed = (target: Record<string, unknown>): void => {
        writeFileSync(join(workspaceRoot, "packages", "app", "project.json"), JSON.stringify({ targets: { build: { command: "echo a && echo b", outputs: [], ...target } } }));
    };

    // `--dry-run` prints the plan: one line per task, so a split target lists build#1 and build#2.
    const plan = async (): Promise<{ infos: string[]; warnings: string[] }> => {
        const infos: string[] = [];
        const warnings: string[] = [];

        await runExecute({
            argument: ["build"],
            logger: {
                debug: () => undefined,
                error: () => undefined,
                info: (...args: unknown[]) => infos.push(args.join(" ")),
                warn: (...args: unknown[]) => warnings.push(args.join(" ")),
            },
            options: { cache: false, dryRun: true, parallel: 1, preflight: false, skipToolchain: true },
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        return { infos, warnings };
    };

    beforeEach(() => {
        workspaceRoot = createTemporaryDirectory("vis-run-misplaced-");
        writeFileSync(join(workspaceRoot, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
        writeFileSync(join(workspaceRoot, "package.json"), JSON.stringify({ name: "root" }));
        mkdirSync(join(workspaceRoot, "packages", "app"), { recursive: true });
        writeFileSync(join(workspaceRoot, "packages", "app", "package.json"), JSON.stringify({ name: "@my/app" }));
    });

    afterEach(() => {
        cleanupTemporaryDirectory(workspaceRoot);
    });

    it("warns that splitCompound under options is ignored, and does not split", async () => {
        expect.assertions(3);

        seed({ options: { splitCompound: true } });

        const { infos, warnings } = await plan();

        expect(warnings.join("\n")).toContain("\"splitCompound\" is a target property, not an option");
        expect(warnings.join("\n")).toContain("@my/app:build");
        expect(infos.join("\n")).not.toContain("build#1");
    });

    it("splits and stays quiet when splitCompound is on the target", async () => {
        expect.assertions(2);

        seed({ splitCompound: true });

        const { infos, warnings } = await plan();

        expect(warnings).toStrictEqual([]);
        expect(infos.join("\n")).toContain("build#1");
    });
});
