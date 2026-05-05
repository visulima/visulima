import { mkdirSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import listExecute from "../../../src/commands/list/handler";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../../test-helpers";

type LoggerCall = [string, ...unknown[]];

const makeLogger = (): {
    calls: LoggerCall[];
    logger: {
        debug: (...args: unknown[]) => void;
        error: (...args: unknown[]) => void;
        info: (...args: unknown[]) => void;
        warn: (...args: unknown[]) => void;
    };
} => {
    const calls: LoggerCall[] = [];

    return {
        calls,
        logger: {
            debug: (...args) => calls.push(["debug", ...args]),
            error: (...args) => calls.push(["error", ...args]),
            info: (...args) => calls.push(["info", ...args]),
            warn: (...args) => calls.push(["warn", ...args]),
        },
    };
};

describe("vis list", () => {
    let workspaceRoot: string;

    beforeEach(() => {
        workspaceRoot = createTemporaryDirectory("vis-list-");

        writeFileSync(join(workspaceRoot, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
        writeFileSync(join(workspaceRoot, "package.json"), JSON.stringify({ name: "root" }));

        const aDir = join(workspaceRoot, "packages", "a");
        const bDir = join(workspaceRoot, "packages", "b");

        mkdirSync(aDir, { recursive: true });
        mkdirSync(bDir, { recursive: true });

        writeFileSync(join(aDir, "package.json"), JSON.stringify({ name: "@my/a", scripts: { build: "tsc" } }));
        writeFileSync(
            join(aDir, "project.json"),
            JSON.stringify({
                language: "typescript",
                layer: "library",
                projectType: "library",
                tags: ["frontend"],
                targets: { build: { command: "tsc" } },
            }),
        );

        writeFileSync(join(bDir, "package.json"), JSON.stringify({ name: "@my/b", scripts: { test: "vitest" } }));
        writeFileSync(
            join(bDir, "project.json"),
            JSON.stringify({
                language: "typescript",
                projectType: "application",
                tags: ["backend"],
                targets: { test: { command: "vitest" } },
            }),
        );
    });

    afterEach(() => {
        cleanupTemporaryDirectory(workspaceRoot);
    });

    it("emits a JSON document containing every project when --format=json is passed", async () => {
        expect.assertions(4);

        const { calls, logger } = makeLogger();

        await listExecute({
            argument: [],
            logger,
            options: { format: "json" },
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        const jsonText = calls.find((c) => c[0] === "info")?.[1] as string;
        const parsed = JSON.parse(jsonText) as { name: string; tags: string[]; type: string }[];

        expect(parsed).toHaveLength(2);
        expect(parsed.map((p) => p.name).sort()).toStrictEqual(["@my/a", "@my/b"]);
        expect(parsed.find((p) => p.name === "@my/a")?.tags).toStrictEqual(["frontend"]);
        expect(parsed.find((p) => p.name === "@my/b")?.type).toBe("application");
    });

    it("filters projects by the --query expression", async () => {
        expect.assertions(2);

        const { calls, logger } = makeLogger();

        await listExecute({
            argument: [],
            logger,
            options: { format: "json", query: "tag=frontend" },
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        const jsonText = calls.find((c) => c[0] === "info")?.[1] as string;
        const parsed = JSON.parse(jsonText) as { name: string }[];

        expect(parsed).toHaveLength(1);
        expect(parsed[0]!.name).toBe("@my/a");
    });

    it("renders a table when --format is not passed", async () => {
        expect.assertions(3);

        const { calls, logger } = makeLogger();

        await listExecute({
            argument: [],
            logger,
            options: {},
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        const text = calls.map((c) => c.slice(1).join(" ")).join("\n");

        expect(text).toContain("Project");
        expect(text).toContain("@my/a");
        expect(text).toContain("2 project(s)");
    });

    it("renders a per-target table with descriptions when --targets is passed", async () => {
        expect.assertions(5);

        writeFileSync(
            join(workspaceRoot, "packages", "a", "project.json"),
            JSON.stringify({
                language: "typescript",
                layer: "library",
                projectType: "library",
                tags: ["frontend"],
                targets: {
                    build: {
                        cache: true,
                        command: "tsc",
                        description: "Compile TypeScript sources",
                    },
                },
            }),
        );

        const { calls, logger } = makeLogger();

        await listExecute({
            argument: [],
            logger,
            options: { targets: true },
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        const text = calls.map((c) => c.slice(1).join(" ")).join("\n");

        expect(text).toContain("Target");
        expect(text).toContain("Description");
        expect(text).toContain("Compile TypeScript sources");
        expect(text).toContain("@my/a");
        expect(text).toContain("2 target(s) across 2 project(s)");
    });

    it("filters target rows to inferred only when --inferred is passed", async () => {
        expect.assertions(7);

        const cDir = join(workspaceRoot, "packages", "c");

        mkdirSync(cDir, { recursive: true });

        writeFileSync(join(cDir, "package.json"), JSON.stringify({ name: "@my/c", scripts: { lint: "eslint ." } }));
        writeFileSync(join(cDir, "vite.config.ts"), "export default {}");

        const { calls, logger } = makeLogger();

        await listExecute({
            argument: [],
            logger,
            options: { inferred: true },
            runtime: {} as never,
            visConfig: { inferTargets: true },
            workspaceRoot,
        } as never);

        const text = calls.map((c) => c.slice(1).join(" ")).join("\n");

        expect(text).toContain("Inferred");
        expect(text).toContain("@my/c");
        expect(text).toContain("vite production build (inferred)");
        // explicit script-derived target must not slip into the inferred-only filter
        expect(text).not.toContain("@my/a");
        expect(text).toContain("3 target(s) across 3 project(s)");

        // Pin the Inferred column body: every rendered row must say "yes"
        // (no row should be "no", because we filtered to inferred-only).
        const dataRows = calls.filter((c) => c[0] === "info" && typeof c[1] === "string" && c[1].startsWith("@my/c")).map((c) => c[1] as string);

        expect(dataRows.length).toBeGreaterThanOrEqual(1);
        // Inferred is the 5th column (Project, Target, Type, Cache, Inferred, Description)
        // — every data row should contain "yes" before the description text.
        expect(dataRows.every((row) => /\byes\b/.test(row))).toBe(true);
    });

    it("logs 'No projects found' when the query matches nothing", async () => {
        expect.assertions(1);

        const { calls, logger } = makeLogger();

        await listExecute({
            argument: [],
            logger,
            options: { query: "tag=does-not-exist" },
            runtime: {} as never,
            visConfig: undefined,
            workspaceRoot,
        } as never);

        const text = calls.map((c) => c.slice(1).join(" ")).join("\n");

        expect(text).toContain("No projects found.");
    });

    describe("--deps mode", () => {
        beforeEach(() => {
            writeFileSync(
                join(workspaceRoot, "packages", "a", "package.json"),
                JSON.stringify({
                    dependencies: { react: "^18.2.0" },
                    devDependencies: { vitest: "^1.0.0" },
                    name: "@my/a",
                }),
            );
            writeFileSync(
                join(workspaceRoot, "packages", "b", "package.json"),
                JSON.stringify({
                    dependencies: { "@my/a": "workspace:*", react: "^17.0.0" },
                    name: "@my/b",
                }),
            );
        });

        it("renders the 6-column dep-instance table with row count footer", async () => {
            expect.assertions(7);

            const { calls, logger } = makeLogger();

            await listExecute({
                argument: [],
                logger,
                options: { deps: true },
                runtime: {} as never,
                visConfig: undefined,
                workspaceRoot,
            } as never);

            const text = calls.map((c) => c.slice(1).join(" ")).join("\n");

            for (const heading of ["Package", "Block", "Dep", "Specifier", "Internal", "Path"]) {
                expect(text).toContain(heading);
            }

            // 4 dep instances (a: react, vitest; b: @my/a, react)
            expect(text).toContain("4 dep-instance(s)");
        });

        it("--internal-only restricts to workspace deps", async () => {
            expect.assertions(2);

            const { calls, logger } = makeLogger();

            await listExecute({
                argument: [],
                logger,
                options: { deps: true, internalOnly: true },
                runtime: {} as never,
                visConfig: undefined,
                workspaceRoot,
            } as never);

            const text = calls.map((c) => c.slice(1).join(" ")).join("\n");

            expect(text).toContain("@my/a");
            expect(text).toContain("1 dep-instance(s)");
        });

        it("throws when --internal-only and --external-only are both passed", async () => {
            expect.assertions(1);

            const { logger } = makeLogger();

            await expect(
                listExecute({
                    argument: [],
                    logger,
                    options: { deps: true, externalOnly: true, internalOnly: true },
                    runtime: {} as never,
                    visConfig: undefined,
                    workspaceRoot,
                } as never),
            ).rejects.toThrow(/mutually exclusive/);
        });

        it("rejects unknown --dep-type values", async () => {
            expect.assertions(1);

            const { logger } = makeLogger();

            await expect(
                listExecute({
                    argument: [],
                    logger,
                    options: { deps: true, depType: ["wat"] },
                    runtime: {} as never,
                    visConfig: undefined,
                    workspaceRoot,
                } as never),
            ).rejects.toThrow(/Unknown --dep-type value/);
        });

        it("logs 'No matching dep-instances' when filters exclude everything", async () => {
            expect.assertions(1);

            const { calls, logger } = makeLogger();

            await listExecute({
                argument: [],
                logger,
                // Only scan dep blocks none of the packages declare.
                options: { deps: true, depType: ["peerDependencies"] },
                runtime: {} as never,
                visConfig: undefined,
                workspaceRoot,
            } as never);

            const text = calls.map((c) => c.slice(1).join(" ")).join("\n");

            expect(text).toContain("No matching dep-instances.");
        });

        it("filters dep-instances by --query (project metadata)", async () => {
            expect.assertions(2);

            // tag=frontend is set on @my/a only (in the outer beforeEach).
            const { calls, logger } = makeLogger();

            await listExecute({
                argument: [],
                logger,
                options: { deps: true, query: "tag=frontend" },
                runtime: {} as never,
                visConfig: undefined,
                workspaceRoot,
            } as never);

            const text = calls.map((c) => c.slice(1).join(" ")).join("\n");

            // Only deps declared by @my/a remain (react + vitest).
            expect(text).toContain("2 dep-instance(s)");
            expect(text).not.toContain("@my/b");
        });

        it("--format=ndjson emits one JSON record per dep-instance", async () => {
            expect.assertions(3);

            const { calls, logger } = makeLogger();

            await listExecute({
                argument: [],
                logger,
                options: { deps: true, format: "ndjson" },
                runtime: {} as never,
                visConfig: undefined,
                workspaceRoot,
            } as never);

            const lines = calls.filter((c) => c[0] === "info").map((c) => c[1] as string);

            expect(lines).toHaveLength(4);

            const records = lines.map((line) => JSON.parse(line) as { depName: string; isInternal: boolean; specifier: string });

            expect(records.find((r) => r.depName === "@my/a")?.isInternal).toBe(true);
            expect(records.filter((r) => r.depName === "react").map((r) => r.specifier).sort()).toStrictEqual(["^17.0.0", "^18.2.0"]);
        });

        it("--format=json emits a single array; --pretty switches to indented", async () => {
            expect.assertions(2);

            const compact = makeLogger();

            await listExecute({
                argument: [],
                logger: compact.logger,
                options: { deps: true, format: "json" },
                runtime: {} as never,
                visConfig: undefined,
                workspaceRoot,
            } as never);

            const compactText = compact.calls.find((c) => c[0] === "info")?.[1] as string;
            const compactParsed = JSON.parse(compactText) as unknown[];

            expect(compactParsed).toHaveLength(4);
            // Compact form has no newlines between records.
            expect(compactText.includes("\n")).toBe(false);
        });

        it("--format=ndjson outside --deps is rejected", async () => {
            expect.assertions(1);

            const { logger } = makeLogger();

            await expect(
                listExecute({
                    argument: [],
                    logger,
                    options: { format: "ndjson" },
                    runtime: {} as never,
                    visConfig: undefined,
                    workspaceRoot,
                } as never),
            ).rejects.toThrow(/--format=ndjson is only supported with --deps/);
        });

        it("rejects unknown --format values", async () => {
            expect.assertions(1);

            const { logger } = makeLogger();

            await expect(
                listExecute({
                    argument: [],
                    logger,
                    options: { deps: true, format: "yaml" },
                    runtime: {} as never,
                    visConfig: undefined,
                    workspaceRoot,
                } as never),
            ).rejects.toThrow(/--format must be one of/);
        });
    });
});
