import { mkdirSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import type { ProjectGraph, WorkspaceConfiguration } from "@visulima/task-runner";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildCycloneDxBom, serializeBomToXml } from "../../src/sbom/cyclonedx";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../test-helpers";
import { assertValidBom } from "./validator";

interface FixtureInput {
    rootName?: string;
    rootVersion?: string;
    projects: {
        name: string;
        version: string;
        type?: "application" | "library";
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
        license?: string;
        description?: string;
        homepage?: string;
    }[];
    lockfile?: string;
}

/**
 * Lays out a minimal workspace + pnpm-lock.yaml on disk that the
 * builder can crawl. Returns `{ workspaceRoot, workspace, projectGraph }`.
 */
const buildFixture = (
    tmpDir: string,
    input: FixtureInput,
): { projectGraph: ProjectGraph; workspace: WorkspaceConfiguration; workspaceRoot: string } => {
    const workspaceRoot = join(tmpDir, "repo");

    mkdirSync(workspaceRoot, { recursive: true });
    writeFileSync(
        join(workspaceRoot, "package.json"),
        JSON.stringify({ name: input.rootName ?? "root", version: input.rootVersion ?? "1.0.0" }),
    );

    if (input.lockfile) {
        writeFileSync(join(workspaceRoot, "pnpm-lock.yaml"), input.lockfile);
    }

    const projects: WorkspaceConfiguration["projects"] = {};
    const graphDependencies: ProjectGraph["dependencies"] = {};
    const graphNodes: ProjectGraph["nodes"] = {};

    for (const project of input.projects) {
        const projectRoot = join("packages", project.name);
        const absoluteRoot = join(workspaceRoot, projectRoot);

        mkdirSync(absoluteRoot, { recursive: true });
        writeFileSync(
            join(absoluteRoot, "package.json"),
            JSON.stringify({
                name: project.name,
                version: project.version,
                ...(project.description ? { description: project.description } : {}),
                ...(project.license ? { license: project.license } : {}),
                ...(project.homepage ? { homepage: project.homepage } : {}),
                ...(project.dependencies ? { dependencies: project.dependencies } : {}),
                ...(project.devDependencies ? { devDependencies: project.devDependencies } : {}),
            }),
        );

        projects[project.name] = {
            projectType: project.type ?? "library",
            root: projectRoot,
            sourceRoot: `${projectRoot}/src`,
            targets: {},
        };

        graphNodes[project.name] = {
            data: projects[project.name]!,
            name: project.name,
            type: project.type ?? "library",
        };

        graphDependencies[project.name] = [];
    }

    // Wire up project-to-project graph edges based on declared dependencies.
    for (const project of input.projects) {
        for (const depName of Object.keys(project.dependencies ?? {})) {
            if (graphNodes[depName]) {
                graphDependencies[project.name]!.push({ source: project.name, target: depName, type: "static" });
            }
        }
    }

    return {
        projectGraph: { dependencies: graphDependencies, nodes: graphNodes },
        workspace: { projects },
        workspaceRoot,
    };
};

describe(buildCycloneDxBom, () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = createTemporaryDirectory("vis-sbom-");
    });

    afterEach(() => {
        cleanupTemporaryDirectory(tmpDir);
    });

    it("should emit a schema-valid BOM for a single-project workspace with one registry dep", () => {
        expect.assertions(3);

        const { projectGraph, workspace, workspaceRoot } = buildFixture(tmpDir, {
            lockfile: `lockfileVersion: '9.0'

packages:

  lodash@4.17.21:
    resolution: {integrity: sha512-aGVsbG8=}
`,
            projects: [
                {
                    dependencies: { lodash: "^4.17.21" },
                    license: "MIT",
                    name: "my-app",
                    type: "application",
                    version: "1.0.0",
                },
            ],
        });

        const bom = buildCycloneDxBom({
            now: new Date("2026-04-13T00:00:00Z"),
            projectGraph,
            serialNumber: "urn:uuid:3e671687-395b-41f5-a30f-a58921a69b79",
            workspace,
            workspaceRoot,
        });

        // Route through the real ajv validator — the builder is correct only
        // if the vendored 1.6 schema accepts every document it produces.
        assertValidBom(bom);

        // Components: 1 workspace project + 1 registry library.
        expect(bom.components).toHaveLength(2);

        const lodash = bom.components!.find((c) => c.name === "lodash");

        expect(lodash?.hashes?.[0]).toEqual({ alg: "SHA-512", content: "68656c6c6f" });
        expect(lodash?.purl).toBe("pkg:npm/lodash@4.17.21");
    });

    it("should exclude devDependencies by default and include them with --include-dev", () => {
        expect.assertions(2);

        const fixture = {
            lockfile: `lockfileVersion: '9.0'

packages:

  vitest@2.0.0:
    resolution: {integrity: sha512-aGVsbG8=}
`,
            projects: [
                {
                    devDependencies: { vitest: "^2.0.0" },
                    license: "MIT",
                    name: "my-app",
                    type: "library" as const,
                    version: "1.0.0",
                },
            ],
        };

        const prod = buildFixture(tmpDir, fixture);
        const prodBom = buildCycloneDxBom({
            now: new Date("2026-04-13T00:00:00Z"),
            projectGraph: prod.projectGraph,
            serialNumber: "urn:uuid:00000000-0000-4000-8000-000000000000",
            workspace: prod.workspace,
            workspaceRoot: prod.workspaceRoot,
        });

        expect(prodBom.components?.some((c) => c.name === "vitest")).toBe(false);

        cleanupTemporaryDirectory(tmpDir);
        tmpDir = createTemporaryDirectory("vis-sbom-");

        const dev = buildFixture(tmpDir, fixture);
        const devBom = buildCycloneDxBom({
            includeDev: true,
            now: new Date("2026-04-13T00:00:00Z"),
            projectGraph: dev.projectGraph,
            serialNumber: "urn:uuid:00000000-0000-4000-8000-000000000001",
            workspace: dev.workspace,
            workspaceRoot: dev.workspaceRoot,
        });

        expect(devBom.components?.some((c) => c.name === "vitest")).toBe(true);
    });

    it("should wire workspace project-to-project edges through dependencies[]", () => {
        expect.assertions(2);

        const { projectGraph, workspace, workspaceRoot } = buildFixture(tmpDir, {
            projects: [
                {
                    dependencies: { utils: "workspace:^" },
                    license: "MIT",
                    name: "app",
                    type: "application",
                    version: "1.0.0",
                },
                { license: "MIT", name: "utils", version: "1.0.0" },
            ],
        });

        const bom = buildCycloneDxBom({
            now: new Date("2026-04-13T00:00:00Z"),
            projectGraph,
            serialNumber: "urn:uuid:00000000-0000-4000-8000-000000000002",
            workspace,
            workspaceRoot,
        });

        assertValidBom(bom);

        const appEdge = bom.dependencies?.find((d) => d.ref === "pkg:npm/app@1.0.0");

        expect(appEdge?.dependsOn).toContain("pkg:npm/utils@1.0.0");
    });

    it("should scope the BOM to a single project's closure when --focus is set", () => {
        expect.assertions(2);

        const { projectGraph, workspace, workspaceRoot } = buildFixture(tmpDir, {
            projects: [
                { dependencies: { utils: "workspace:^" }, license: "MIT", name: "app", version: "1.0.0" },
                { license: "MIT", name: "utils", version: "1.0.0" },
                { license: "MIT", name: "unrelated", version: "1.0.0" },
            ],
        });

        const bom = buildCycloneDxBom({
            focus: ["app"],
            now: new Date("2026-04-13T00:00:00Z"),
            projectGraph,
            serialNumber: "urn:uuid:00000000-0000-4000-8000-000000000003",
            workspace,
            workspaceRoot,
        });

        assertValidBom(bom);

        const names = bom.components?.map((c) => c.name).sort();

        // `app` is the focused project — it lives in metadata.component
        // only, so it must not duplicate into components[].
        expect(names).toEqual(["utils"]);
        expect(bom.metadata?.component?.name).toBe("app");
    });

    it("should serialize to well-formed XML that preserves component and dependency data", () => {
        expect.assertions(3);

        const { projectGraph, workspace, workspaceRoot } = buildFixture(tmpDir, {
            projects: [
                { license: "MIT", name: "my-app", type: "application", version: "1.0.0" },
            ],
        });

        const bom = buildCycloneDxBom({
            now: new Date("2026-04-13T00:00:00Z"),
            projectGraph,
            serialNumber: "urn:uuid:00000000-0000-4000-8000-000000000004",
            workspace,
            workspaceRoot,
        });

        const xml = serializeBomToXml(bom);

        expect(xml.startsWith("<?xml version=\"1.0\" encoding=\"UTF-8\"?>")).toBe(true);
        expect(xml).toContain("<name>my-app</name>");
        expect(xml).toContain("xmlns=\"http://cyclonedx.org/schema/bom/1.6\"");
    });
});
