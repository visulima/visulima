import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import execute from "../../../src/commands/lint/handler";
import type { AdapterJob } from "../../../src/lint-fmt/runner";
import { runAdaptersParallel } from "../../../src/lint-fmt/runner";

vi.mock(import("../../../src/lint-fmt/runner"), () => {
    return {
        runAdaptersParallel: vi.fn(async (jobs: ReadonlyArray<unknown>) => jobs.map(() => { return { durationMs: 1, exitCode: 0, stderr: "", stdout: "" }; })),
    };
});

vi.mock(import("../../../src/lint-fmt/diff"), async (importOriginal) => {
    return { ...(await importOriginal()), stagedFiles: vi.fn(() => ["src/a.ts"]) };
});

const makeLogger = (): { logger: Console; warnings: string[] } => {
    const warnings: string[] = [];

    return {
        logger: { debug: () => undefined, error: () => undefined, info: () => undefined, warn: (...args: unknown[]) => warnings.push(args.join(" ")) } as unknown as Console,
        warnings,
    };
};

describe("vis lint typecheck adapter", () => {
    let root: string;

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), "vis-lint-typecheck-"));
        writeFileSync(join(root, "package.json"), JSON.stringify({ devDependencies: { typescript: "^5.0.0" }, name: "x" }));
        writeFileSync(join(root, "tsconfig.json"), "{}");
        vi.mocked(runAdaptersParallel).mockClear();
    });

    afterEach(() => {
        rmSync(root, { force: true, recursive: true });
    });

    const lint = async (options: Record<string, unknown>, typecheck?: { enabled?: boolean }): Promise<{ jobs: ReadonlyArray<AdapterJob>; warnings: string[] }> => {
        const { logger, warnings } = makeLogger();

        await execute({
            logger,
            options: { format: "json", output: join(root, "out.json"), ...options },
            visConfig: typecheck ? { lint: { adapters: { typecheck } } } : undefined,
            workspaceRoot: root,
        } as never);

        return { jobs: (vi.mocked(runAdaptersParallel).mock.calls[0]?.[0] ?? []), warnings };
    };

    it("does not run just because TypeScript is installed", async () => {
        expect.assertions(2);

        const { jobs, warnings } = await lint({});

        expect(jobs).toHaveLength(0);
        expect(warnings.join("\n")).toContain("typecheck runs only when enabled");
    });

    it("runs when enabled, checking the whole project", async () => {
        expect.assertions(2);

        const { jobs } = await lint({}, { enabled: true });

        expect(jobs.map((job) => job.adapter.id)).toStrictEqual(["typecheck"]);
        expect(jobs[0]?.files).toStrictEqual(["."]);
    });

    it("stays off when explicitly disabled", async () => {
        expect.assertions(1);

        const { jobs } = await lint({}, { enabled: false });

        expect(jobs).toHaveLength(0);
    });

    it("gets the whole project, uncached, even for a --staged run", async () => {
        expect.assertions(2);

        const { jobs } = await lint({ staged: true }, { enabled: true });

        expect(jobs).toHaveLength(1);
        // "." keeps the job out of the per-file lint cache, which would replay stale results.
        expect(jobs[0]?.files).toStrictEqual(["."]);
    });

    it("skips the type check when the requested files include nothing it owns", async () => {
        expect.assertions(1);

        const { jobs } = await lint({ _: ["README.md"] }, { enabled: true });

        expect(jobs).toHaveLength(0);
    });

    it("runs it when the requested files include a TypeScript file", async () => {
        expect.assertions(2);

        const { jobs } = await lint({ _: ["README.md", "src/a.ts"] }, { enabled: true });

        expect(jobs).toHaveLength(1);
        expect(jobs[0]?.files).toStrictEqual(["."]);
    });

    it("warns instead of silently skipping when enabled without a tsconfig", async () => {
        expect.assertions(2);

        rmSync(join(root, "tsconfig.json"));

        const { jobs, warnings } = await lint({}, { enabled: true });

        expect(jobs).toHaveLength(0);
        expect(warnings.join("\n")).toContain("adapters.typecheck.enabled is set, but typecheck was not detected");
    });
});
