import { mkdirSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import runExecute from "../../../src/commands/run/handler";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../../test-helpers";

const capture = (): { errors: string[]; infos: string[]; logger: Record<"debug" | "error" | "info" | "warn", (...args: unknown[]) => void> } => {
    const errors: string[] = [];
    const infos: string[] = [];

    return {
        errors,
        infos,
        logger: {
            debug: () => undefined,
            error: (...args) => errors.push(args.join(" ")),
            info: (...args) => infos.push(args.join(" ")),
            warn: () => undefined,
        },
    };
};

describe("vis run --if-present", () => {
    let workspaceRoot: string;

    beforeEach(() => {
        workspaceRoot = createTemporaryDirectory("vis-run-if-present-");
        writeFileSync(join(workspaceRoot, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
        writeFileSync(join(workspaceRoot, "package.json"), JSON.stringify({ name: "root" }));
        mkdirSync(join(workspaceRoot, "packages", "app"), { recursive: true });
        writeFileSync(join(workspaceRoot, "packages", "app", "package.json"), JSON.stringify({ name: "@my/app" }));
        writeFileSync(join(workspaceRoot, "packages", "app", "project.json"), JSON.stringify({ targets: { build: { command: "echo hi", outputs: [] } } }));
    });

    afterEach(() => {
        cleanupTemporaryDirectory(workspaceRoot);
    });

    const run = async (ifPresent: boolean): Promise<ReturnType<typeof capture>> => {
        const captured = capture();

        await runExecute({
            argument: ["lint"],
            logger: captured.logger,
            options: { cache: false, dryRun: true, ifPresent, parallel: 1, skipToolchain: true },
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        return captured;
    };

    it("reports the missing target as an error by default", async () => {
        expect.assertions(2);

        const { errors, infos } = await run(false);

        expect(errors).toContain("No projects have the \"lint\" target.");
        expect(infos.join("\n")).not.toContain("--if-present");
    });

    it("skips with a notice and no error when the flag is set", async () => {
        expect.assertions(2);

        const { errors, infos } = await run(true);

        expect(errors).toStrictEqual([]);
        expect(infos.join("\n")).toContain("No projects have the \"lint\" target; skipping (--if-present).");
    });
});
