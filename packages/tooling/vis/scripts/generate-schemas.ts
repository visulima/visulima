#!/usr/bin/env node
/**
 * Regenerate the published JSON Schemas for `vis.config.ts` and
 * `project.json` from the canonical TypeScript types.
 *
 * Usage:
 *   pnpm --filter @visulima/vis run generate:schemas
 *
 * The script writes two files into `schemas/`:
 *
 *   - `vis-config.schema.json`          — from `VisConfig`        (src/config/types.ts)
 *   - `project.schema.json`             — from `ProjectJson`      (src/config/types.ts)
 *   - `vis-release-config.schema.json`  — from `VisReleaseConfig` (src/release/types.ts)
 *
 * Drift between the committed schemas and the TS types is caught by
 * `__tests__/schemas/schemas.test.ts`, which calls `buildSchema()`
 * directly and compares against the on-disk JSON.
 */

import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { Config, Schema } from "ts-json-schema-generator";
import { createGenerator } from "ts-json-schema-generator";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(__dirname, "..");
const SOURCE_FILE = resolve(PACKAGE_ROOT, "src/config/types.ts");
const RELEASE_SOURCE_FILE = resolve(PACKAGE_ROOT, "src/release/types.ts");
const TSCONFIG = resolve(PACKAGE_ROOT, "tsconfig.json");
const SCHEMAS_DIR = resolve(PACKAGE_ROOT, "schemas");

export interface SchemaSpec {
    /** When `true`, allow a top-level `$schema` string property so users can pin the schema URL in their JSON. */
    allowSchemaProperty?: boolean;
    description: string;
    file: string;
    id: string;
    /** Absolute path to the source file declaring `type`. Defaults to `src/config/types.ts`. */
    sourceFile?: string;
    title: string;
    type: string;
}

export const SCHEMAS: SchemaSpec[] = [
    {
        description:
            "Workspace configuration for @visulima/vis. Used by defineConfig() in vis.config.ts. This schema is for non-TypeScript editors; TypeScript users get autocomplete from defineConfig() types.",
        file: "vis-config.schema.json",
        id: "https://visulima.com/schemas/vis-config.schema.json",
        title: "vis.config.ts",
        type: "VisConfig",
    },
    {
        allowSchemaProperty: true,
        description: "Per-project configuration for @visulima/vis. Place a project.json in each workspace package root.",
        file: "project.schema.json",
        id: "https://visulima.com/schemas/project.schema.json",
        title: "vis project.json",
        type: "ProjectJson",
    },
    {
        description: "Schema for the `release` block inside vis.config.ts (RFC §8.1).",
        file: "vis-release-config.schema.json",
        id: "https://visulima.com/schemas/vis-release-config.schema.json",
        sourceFile: RELEASE_SOURCE_FILE,
        title: "VisReleaseConfig",
        type: "VisReleaseConfig",
    },
];

const baseConfig: Config = {
    additionalProperties: false,
    encodeRefs: false,
    expose: "export",
    extraTags: [],
    functions: "hide",
    jsDoc: "extended",
    markdownDescription: false,
    path: SOURCE_FILE,
    // Generation must succeed even when unrelated TS errors exist elsewhere
    // in the working tree; drift is enforced by the schemas.test.ts suite.
    skipTypeCheck: true,
    sortProps: true,
    strictTuples: false,
    topRef: true,
    tsconfig: TSCONFIG,
};

/**
 * Walks the schema graph and rewrites every `$ref: "#/definitions/X"` to
 * `$ref: "#/$defs/X"`. Mutates in place.
 */
const rewriteRefs = (node: unknown): void => {
    if (Array.isArray(node)) {
        for (const child of node) {
            rewriteRefs(child);
        }

        return;
    }

    if (node === null || typeof node !== "object") {
        return;
    }

    const record = node as Record<string, unknown>;

    if (typeof record.$ref === "string" && record.$ref.startsWith("#/definitions/")) {
        record.$ref = record.$ref.replace("#/definitions/", "#/$defs/");
    }

    for (const value of Object.values(record)) {
        rewriteRefs(value);
    }
};

/**
 * ts-json-schema-generator emits draft-07 tuple syntax — `items: [A, B]`
 * (+ optional `additionalItems`). That's invalid under draft 2020-12 (which
 * we declare via `$schema`), where `items` must be a single schema and tuple
 * prefixes live under `prefixItems`. Ajv2020 rejects the array form outright.
 * Rewrite every array-valued `items` to `prefixItems`, mapping any
 * `additionalItems` onto the 2020-12 `items` slot. Mutates in place.
 */
const rewriteTuples = (node: unknown): void => {
    if (Array.isArray(node)) {
        for (const child of node) {
            rewriteTuples(child);
        }

        return;
    }

    if (node === null || typeof node !== "object") {
        return;
    }

    const record = node as Record<string, unknown>;

    if (Array.isArray(record.items)) {
        record.prefixItems = record.items;

        if ("additionalItems" in record) {
            // draft-07 `additionalItems` → draft-2020-12 `items` (the schema
            // applied to elements past the tuple prefix).
            record.items = record.additionalItems;
            delete record.additionalItems;
        } else {
            delete record.items;
        }
    }

    for (const value of Object.values(record)) {
        rewriteTuples(value);
    }
};

/**
 * Take the wrapped `{ $ref: "#/definitions/Root", definitions: { ... } }`
 * shape and inline the root type's body at the top level — matching the
 * style of the previously hand-maintained schemas.
 */
const flattenRootType = (raw: Schema, rootType: string): Record<string, unknown> => {
    const definitions = (raw.definitions ?? {}) as Record<string, unknown>;
    const root = definitions[rootType];

    if (!root || typeof root !== "object") {
        throw new Error(`Generator did not produce a root definition for "${rootType}"`);
    }

    delete definitions[rootType];

    const flattened: Record<string, unknown> = { ...(root as Record<string, unknown>) };

    if (Object.keys(definitions).length > 0) {
        flattened.$defs = definitions;
    }

    return flattened;
};

/**
 * Build a single schema in memory. Returns the JSON-stringified schema
 * with a trailing newline, matching the on-disk shape.
 */
/**
 * Types whose members include functions (lifecycle hooks, etc.) can't be
 * modelled in JSON Schema — ts-json-schema-generator drops the function
 * properties and, with the global `additionalProperties: false`, the remaining
 * definition rejects otherwise-valid objects. Relax those defs to
 * `additionalProperties: true` so schema consumers accept programmatic plugins.
 */
const FUNCTION_BEARING_DEFS = new Set(["ReleasePlugin"]);

const relaxFunctionBearingDefs = (schema: Schema): void => {
    const container = schema as Record<string, unknown>;
    const defs = (container["$defs"] ?? container["definitions"]) as Record<string, unknown> | undefined;

    if (!defs) {
        return;
    }

    for (const [name, definition] of Object.entries(defs)) {
        if (FUNCTION_BEARING_DEFS.has(name) && definition && typeof definition === "object") {
            (definition as Record<string, unknown>).additionalProperties = true;
        }
    }
};

export const buildSchema = (spec: SchemaSpec): string => {
    const generator = createGenerator({ ...baseConfig, path: spec.sourceFile ?? SOURCE_FILE, type: spec.type });
    const raw = generator.createSchema(spec.type) as Schema;

    rewriteRefs(raw);
    rewriteTuples(raw);
    relaxFunctionBearingDefs(raw);

    const body = flattenRootType(raw, spec.type);

    // Drop the auto-generated title/description from the root TS interface
    // so the curated SchemaSpec metadata wins. If you want a JSDoc on the
    // root type to surface, update SchemaSpec.description instead.
    delete body.title;
    delete body.description;

    if (spec.allowSchemaProperty && body.properties && typeof body.properties === "object") {
        const props = body.properties as Record<string, unknown>;

        props.$schema = {
            type: "string",
            description: "JSON Schema reference for editor autocomplete.",
        };
    }

    const final: Record<string, unknown> = {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        $id: spec.id,
        title: spec.title,
        description: spec.description,
        ...body,
    };

    return `${JSON.stringify(final, null, 4)}\n`;
};

/** Resolved on-disk path for `spec.file`. */
export const schemaOutputPath = (spec: SchemaSpec): string => resolve(SCHEMAS_DIR, spec.file);

const main = (): void => {
    process.stdout.write(`Generating schemas from ${SOURCE_FILE}\n`);

    for (const spec of SCHEMAS) {
        const json = buildSchema(spec);

        writeFileSync(schemaOutputPath(spec), json);
        process.stdout.write(`  ✓ ${spec.file} (${spec.type})\n`);
    }

    process.stdout.write("Done.\n");
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main();
}
