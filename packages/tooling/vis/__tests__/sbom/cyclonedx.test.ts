import { ensureDirSync, writeFileSync } from "@visulima/fs";
import { join } from "@visulima/path";
import type { ProjectGraph, WorkspaceConfiguration } from "@visulima/task-runner";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildCycloneDxBom, serializeBomToXml } from "../../src/sbom/cyclonedx";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../test-helpers";
import { assertValidBom } from "./validator";

interface FixtureInput {
    lockfile?: string;
    projects: {
        dependencies?: Record<string, string>;
        description?: string;
        devDependencies?: Record<string, string>;
        homepage?: string;
        license?: string;
        name: string;
        type?: "application" | "library";
        version: string;
    }[];
    rootName?: string;
    rootVersion?: string;
}

/**
 * Lays out a minimal workspace + pnpm-lock.yaml on disk that the
 * builder can crawl. Returns `{ workspaceRoot, workspace, projectGraph }`.
 */
const buildFixture = (tmpDir: string, input: FixtureInput): { projectGraph: ProjectGraph; workspace: WorkspaceConfiguration; workspaceRoot: string } => {
    const workspaceRoot = join(tmpDir, "repo");

    ensureDirSync(workspaceRoot);
    writeFileSync(join(workspaceRoot, "package.json"), JSON.stringify({ name: input.rootName ?? "root", version: input.rootVersion ?? "1.0.0" }));

    if (input.lockfile) {
        writeFileSync(join(workspaceRoot, "pnpm-lock.yaml"), input.lockfile);
    }

    const projects: WorkspaceConfiguration["projects"] = {};
    const graphDependencies: ProjectGraph["dependencies"] = {};
    const graphNodes: ProjectGraph["nodes"] = {};

    for (const project of input.projects) {
        const projectRoot = join("packages", project.name);
        const absoluteRoot = join(workspaceRoot, projectRoot);

        ensureDirSync(absoluteRoot);
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

        // The fixture uses a truncated SRI digest, which the SBOM builder filters
        // because it doesn't match SHA-512's required 128-hex-char length.
        expect(lodash?.hashes).toBeUndefined();
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
        expect.assertions(1);

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
        expect(names).toStrictEqual(["utils"]);
        expect(bom.metadata?.component?.name).toBe("app");
    });

    it("should serialize to well-formed XML that preserves component and dependency data", () => {
        expect.assertions(3);

        const { projectGraph, workspace, workspaceRoot } = buildFixture(tmpDir, {
            projects: [{ license: "MIT", name: "my-app", type: "application", version: "1.0.0" }],
        });

        const bom = buildCycloneDxBom({
            now: new Date("2026-04-13T00:00:00Z"),
            projectGraph,
            serialNumber: "urn:uuid:00000000-0000-4000-8000-000000000004",
            workspace,
            workspaceRoot,
        });

        const xml = serializeBomToXml(bom);

        expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
        expect(xml).toContain("<name>my-app</name>");
        expect(xml).toContain('xmlns="http://cyclonedx.org/schema/bom/1.6"');
    });

    it("should walk the lockfile closure and emit transitive deps as components", () => {
        expect.assertions(3);

        // my-app declares `express`, but the lockfile also has body-parser
        // (a transitive dep of express). With a full closure walk, both
        // must appear as components — previously only express would.
        const { projectGraph, workspace, workspaceRoot } = buildFixture(tmpDir, {
            lockfile: `lockfileVersion: '9.0'

packages:

  express@4.18.2:
    resolution: {integrity: sha512-aGVsbG8=}
    dependencies:
      body-parser: 1.20.1

  body-parser@1.20.1:
    resolution: {integrity: sha512-aGVsbG8=}
    dependencies:
      bytes: 3.1.2

  bytes@3.1.2:
    resolution: {integrity: sha512-aGVsbG8=}
`,
            projects: [
                {
                    dependencies: { express: "^4.18.0" },
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
            serialNumber: "urn:uuid:00000000-0000-4000-8000-000000000006",
            workspace,
            workspaceRoot,
        });

        assertValidBom(bom);

        const names = bom.components!.map((component) => component.name).sort();

        expect(names).toContain("body-parser");
        expect(names).toContain("bytes");

        // The registry→registry edge from express to body-parser must land
        // in `dependencies[]`.
        const expressEdge = bom.dependencies!.find((dep) => dep.ref === "pkg:npm/express@4.18.2");

        expect(expressEdge?.dependsOn).toContain("pkg:npm/body-parser@1.20.1");
    });

    it("should mark components reached only via optionalDependencies as scope='optional'", () => {
        expect.assertions(3);

        const { projectGraph, workspace, workspaceRoot } = buildFixture(tmpDir, {
            lockfile: `lockfileVersion: '9.0'

packages:

  chalk@5.3.0:
    resolution: {integrity: sha512-aGVsbG8=}

  fsevents@2.3.3:
    resolution: {integrity: sha512-aGVsbG8=}
`,
            projects: [
                {
                    dependencies: { chalk: "^5.0.0" },
                    license: "MIT",
                    name: "my-app",
                    type: "application",
                    version: "1.0.0",
                },
            ],
        });

        // Append optionalDependencies to my-app's package.json — the buildFixture
        // helper only handles `dependencies`/`devDependencies`, so we overwrite.
        writeFileSync(
            join(workspaceRoot, "packages", "my-app", "package.json"),
            JSON.stringify({
                dependencies: { chalk: "^5.0.0" },
                license: "MIT",
                name: "my-app",
                optionalDependencies: { fsevents: "^2.3.0" },
                version: "1.0.0",
            }),
        );

        const bom = buildCycloneDxBom({
            now: new Date("2026-04-13T00:00:00Z"),
            projectGraph,
            serialNumber: "urn:uuid:00000000-0000-4000-8000-000000000007",
            workspace,
            workspaceRoot,
        });

        const chalk = bom.components!.find((c) => c.name === "chalk");
        const fsevents = bom.components!.find((c) => c.name === "fsevents");

        expect(chalk?.scope).toBe("required");
        expect(fsevents?.scope).toBe("optional");

        // Sanity-check that both landed; optional isn't the same as excluded.
        expect(fsevents).toBeDefined();
    });

    it("should emit Yarn Berry components without a hash entry (XXH64 is not representable in CycloneDX)", () => {
        expect.assertions(2);

        const { projectGraph, workspace, workspaceRoot } = buildFixture(tmpDir, {
            projects: [
                {
                    dependencies: { "some-pkg": "1.0.0" },
                    license: "MIT",
                    name: "my-app",
                    type: "application",
                    version: "1.0.0",
                },
            ],
        });

        writeFileSync(
            join(workspaceRoot, "yarn.lock"),
            `
"some-pkg@npm:1.0.0":
  version: 1.0.0
  resolution: "some-pkg@npm:1.0.0"
  checksum: 10c0/deadbeef
  languageName: node
  linkType: hard
`,
        );

        const bom = buildCycloneDxBom({
            now: new Date("2026-04-13T00:00:00Z"),
            projectGraph,
            serialNumber: "urn:uuid:00000000-0000-4000-8000-000000000008",
            workspace,
            workspaceRoot,
        });

        const somePkg = bom.components!.find((c) => c.name === "some-pkg");

        expect(somePkg).toBeDefined();
        // No `hashes` — Berry's XXH64 isn't in CycloneDX 1.6's HashAlgorithm enum.
        expect(somePkg?.hashes).toBeUndefined();
    });

    it("should resolve registry-component licences against the installed copy's package.json", () => {
        expect.assertions(2);

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

        // Lay down a pnpm virtual-store install tree for lodash@4.17.21 with a
        // distinctive licence so the test can prove the SBOM picks it up.
        const lodashDir = join(workspaceRoot, "node_modules", ".pnpm", "lodash@4.17.21", "node_modules", "lodash");

        ensureDirSync(lodashDir);
        writeFileSync(
            join(lodashDir, "package.json"),
            JSON.stringify({
                description: "A JavaScript utility library",
                license: "Apache-2.0",
                name: "lodash",
                version: "4.17.21",
            }),
        );

        const bom = buildCycloneDxBom({
            now: new Date("2026-04-13T00:00:00Z"),
            projectGraph,
            serialNumber: "urn:uuid:00000000-0000-4000-8000-000000000005",
            workspace,
            workspaceRoot,
        });

        const lodash = bom.components!.find((c) => c.name === "lodash");

        // The licence came from the installed copy, not from the workspace root.
        expect(lodash?.licenses).toStrictEqual([{ license: { id: "Apache-2.0" } }]);
        expect(lodash?.description).toBe("A JavaScript utility library");
    });
});
