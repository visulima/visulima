import { mkdirSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import runExecute from "../../../src/commands/run/handler";
import { VisUserError } from "../../../src/errors/vis-user-error";
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

    const runTarget = async (target: string, ifPresent: boolean, captured = capture()): Promise<ReturnType<typeof capture>> => {
        await runExecute({
            argument: [target],
            logger: captured.logger,
            options: { cache: false, dryRun: true, ifPresent, parallel: 1, skipToolchain: true },
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        return captured;
    };

    const run = async (ifPresent: boolean, captured = capture()): Promise<ReturnType<typeof capture>> => runTarget("lint", ifPresent, captured);

    it("fails with a non-zero exit by default so a mistyped target cannot pass CI", async () => {
        expect.assertions(3);

        const captured = capture();
        const failure = await run(false, captured).catch((error: unknown) => error);

        expect(failure).toBeInstanceOf(VisUserError);
        expect((failure as Error).message).toContain("No projects have the \"lint\" target.");
        // The old behaviour printed the report and returned, which the CLI turned into exit 0.
        expect(captured.infos.join("\n")).not.toContain("--if-present):");
    });

    it("suggests a close target and the escape hatch", async () => {
        expect.assertions(2);

        const failure = await runTarget("buidl", false).catch((error: unknown) => error);

        expect((failure as Error).message).toContain("Did you mean \"build\"?");
        expect((failure as Error).message).toContain("--if-present");
    });

    it("skips with a notice and succeeds when the flag is set", async () => {
        expect.assertions(2);

        const { errors, infos } = await run(true);

        expect(errors).toStrictEqual([]);
        expect(infos.join("\n")).toContain("No projects have the \"lint\" target; skipping (--if-present).");
    });
});

describe("vis run selections that match no project", () => {
    let workspaceRoot: string;

    beforeEach(() => {
        workspaceRoot = createTemporaryDirectory("vis-run-empty-selection-");
        writeFileSync(join(workspaceRoot, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
        writeFileSync(join(workspaceRoot, "package.json"), JSON.stringify({ name: "root" }));
        mkdirSync(join(workspaceRoot, "packages", "app"), { recursive: true });
        writeFileSync(join(workspaceRoot, "packages", "app", "package.json"), JSON.stringify({ name: "@my/app" }));
        writeFileSync(join(workspaceRoot, "packages", "app", "project.json"), JSON.stringify({ targets: { build: { command: "echo hi", outputs: [] } } }));
    });

    afterEach(() => {
        cleanupTemporaryDirectory(workspaceRoot);
    });

    const runSelection = async (selection: Record<string, unknown>, captured = capture()): Promise<ReturnType<typeof capture>> => {
        await runExecute({
            argument: ["build"],
            logger: captured.logger,
            options: { cache: false, dryRun: true, parallel: 1, skipToolchain: true, ...selection },
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        return captured;
    };

    it.each([
        ["--filter", { filter: ["nope"] }, "Filter \"nope\" matched no projects"],
        ["--query", { query: "language=cobol" }, "Query \"language=cobol\" matched no projects"],
        ["--tag", { tag: ["nope"] }, "Tag filter \"nope\" matched no projects"],
    ])("%s throws a VisUserError by default so CI cannot pass without running anything", async (_flag, selection, message) => {
        expect.assertions(3);

        const captured = capture();
        const failure = await runSelection(selection, captured).catch((error: unknown) => error);

        expect(failure).toBeInstanceOf(VisUserError);
        expect((failure as Error).message).toContain(`${message}.`);
        expect((failure as Error).message).toContain("--if-present");
    });

    it.each([
        ["--filter", { filter: ["nope"] }, "Filter \"nope\" matched no projects"],
        ["--query", { query: "language=cobol" }, "Query \"language=cobol\" matched no projects"],
        ["--tag", { tag: ["nope"] }, "Tag filter \"nope\" matched no projects"],
    ])("%s with --if-present returns quietly and logs a one-line notice", async (_flag, selection, message) => {
        expect.assertions(2);

        const { errors, infos } = await runSelection({ ...selection, ifPresent: true });

        expect(errors).toStrictEqual([]);
        expect(infos.join("\n")).toContain(`${message}; skipping (--if-present).`);
    });
});
