import { readFileSync } from "node:fs";

import Ajv2020 from "ajv/dist/2020";
import { describe, expect, it } from "vitest";

import { buildSchema, schemaOutputPath, SCHEMAS } from "../../scripts/generate-schemas";

const [VIS_CONFIG_SPEC, PROJECT_SPEC] = SCHEMAS;
const VIS_CONFIG_SCHEMA = JSON.parse(readFileSync(schemaOutputPath(VIS_CONFIG_SPEC), "utf8"));
const PROJECT_SCHEMA = JSON.parse(readFileSync(schemaOutputPath(PROJECT_SPEC), "utf8"));

const ajv = new Ajv2020({ allErrors: true, strict: false });

describe("published JSON schemas", () => {
    it("vis-config.schema.json is a valid JSON Schema", () => {
        expect(() => ajv.compile(VIS_CONFIG_SCHEMA)).not.toThrow();
    });

    it("project.schema.json is a valid JSON Schema", () => {
        expect(() => ajv.compile(PROJECT_SCHEMA)).not.toThrow();
    });

    it("vis-config schema accepts a fully-populated config", () => {
        const validate = ajv.compile(VIS_CONFIG_SCHEMA);
        const config = {
            ai: { cacheTtl: 3_600_000, provider: "claude" },
            branchScopedCache: true,
            extends: ["./shared.config.ts"],
            fileGroups: { sources: ["src/**/*.ts"] },
            inferTargets: { vite: false, vitest: true },
            install: { backend: "auto" },
            preflight: { lockfile: true },
            security: {
                minimumReleaseAge: 1440,
                socket: { enabled: true, minimumScore: 0.5 },
            },
            sharedWorktreeCache: false,
            sortPackageJson: { sortScripts: true },
            strictEnv: true,
            targetDefaults: { build: { cache: true } },
            taskDefaults: [{ scope: { tags: ["frontend"] }, targets: { build: { cache: true } } }],
            taskGroups: { lint: ["eslint", { group: "format" }] },
            taskRunnerOptions: { parallel: 4 },
            tui: { autoExit: 3 },
            update: { format: "table", target: "minor" },
            versionConstraint: ">=1.0.0",
        };

        expect(validate(config)).toBe(true);
        expect(validate.errors ?? []).toEqual([]);
    });

    it("project schema accepts a fully-populated project.json", () => {
        const validate = ajv.compile(PROJECT_SCHEMA);
        const project = {
            $schema: "https://unpkg.com/@visulima/vis/schemas/project.schema.json",
            implicitDependencies: ["shared"],
            language: "typescript",
            layer: "library",
            owners: [{ channel: "#core", owners: ["@visulima/core-team"], path: "src/**" }],
            project: { description: "Public API package", maintainers: ["@prisis"], title: "API" },
            projectType: "library",
            sourceRoot: "src",
            stack: "backend",
            tags: ["api"],
            targets: {
                build: { command: "tsc", options: { runFromWorkspaceRoot: false }, type: "build" },
            },
        };

        expect(validate(project)).toBe(true);
        expect(validate.errors ?? []).toEqual([]);
    });

    it("vis-config schema rejects unknown top-level keys", () => {
        const validate = ajv.compile(VIS_CONFIG_SCHEMA);

        expect(validate({ unknownField: 1 })).toBe(false);
    });

    it("project schema rejects unknown top-level keys", () => {
        const validate = ajv.compile(PROJECT_SCHEMA);

        expect(validate({ unknownField: 1 })).toBe(false);
    });

    describe("drift guard — committed schemas match the generator output", () => {
        for (const spec of SCHEMAS) {
            it(`${spec.file} is up to date with src/config/types.ts`, () => {
                const onDisk = readFileSync(schemaOutputPath(spec), "utf8");
                const expected = buildSchema(spec);

                expect(onDisk).toBe(expected);
            });
        }
    });
});
