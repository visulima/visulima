/**
 * Ajv-backed CycloneDX 1.7 validator — **test helper**.
 *
 * This module lives under `__tests__/` so that `ajv`, `ajv-formats`, and the
 * vendored schemas are only ever loaded during tests. It is not importable
 * from `src/` and will never appear in the published `dist/`.
 *
 * It compiles the vendored 1.7 schema (plus its three `$ref`'d sub-schemas:
 * SPDX, JSF, and cryptography-defs) and exposes two entry points:
 *
 * - `validateBom(unknown)` — returns a plain `{ valid, errors }` record.
 * - `assertValidBom(unknown)` — throws with a formatted error list on
 *   failure, returns the document typed as `CycloneDxBom` on success.
 */

import Ajv from "ajv";
import addFormats from "ajv-formats";

import type { CycloneDxBom } from "../../src/sbom/types";
import bomSchema from "./schemas/bom-1.7.schema.json" with { type: "json" };
import cryptographyDefsSchema from "./schemas/cryptography-defs.schema.json" with { type: "json" };
import jsfSchema from "./schemas/jsf-0.82.schema.json" with { type: "json" };
import spdxSchema from "./schemas/spdx.schema.json" with { type: "json" };

/** Schema IDs must match the relative `$ref` filenames used inside `bom-1.7.schema.json`. */
const SPDX_SCHEMA_ID = "spdx.schema.json";
const JSF_SCHEMA_ID = "jsf-0.82.schema.json";
const CRYPTOGRAPHY_DEFS_SCHEMA_ID = "cryptography-defs.schema.json";

/**
 * Result of validating a BOM document.
 */
export interface ValidationResult {
    errors: ValidationError[];
    valid: boolean;
}

/** Single error entry, mirroring the subset of ajv's `ErrorObject` we expose. */
export interface ValidationError {
    instancePath: string;
    message: string;
}

/** Shape of a compiled ajv validator for the BOM schema. Matches ajv 8's `ErrorObject` surface for the fields we read. */
type CompiledValidator = ((data: unknown) => boolean) & {
    errors?: { instancePath: string; message?: string }[] | null;
};

/**
 * Logger passed to ajv. Only `warn` is silenced — we suppress the benign
 * "unknown format" warnings for `iri-reference` / `idn-email` (ajv-formats
 * does not ship these formats). Real compilation errors still surface on
 * stderr.
 */
const ajvLogger = {
    // eslint-disable-next-line no-console -- ajv requires a `console`-shaped logger; this helper only loads in tests so stderr/stdout output is acceptable
    error: console.error.bind(console),
    // eslint-disable-next-line no-console -- ajv requires a `console`-shaped logger; this helper only loads in tests so stderr/stdout output is acceptable
    log: console.log.bind(console),
    warn: () => {
        /* silenced: ajv-formats does not implement iri-reference / idn-email */
    },
};

/** Cached compiled validator — the schema is large, compilation is not cheap. */
let compiled: CompiledValidator | undefined;

const compileBomValidator = (): CompiledValidator => {
    if (compiled) {
        return compiled;
    }

    // CycloneDX 1.7 schemas declare `$schema: draft-07`, which is the default
    // dialect for the base `Ajv` class. `strict: false` tolerates schema
    // features ajv is stricter about than the spec requires (e.g. extra
    // keywords alongside `$ref`).
    const ajv = new Ajv({
        allErrors: true,
        logger: ajvLogger,
        strict: false,
        validateFormats: true,
    });

    addFormats(ajv);

    ajv.addSchema(spdxSchema, SPDX_SCHEMA_ID);
    ajv.addSchema(jsfSchema, JSF_SCHEMA_ID);
    ajv.addSchema(cryptographyDefsSchema, CRYPTOGRAPHY_DEFS_SCHEMA_ID);

    compiled = ajv.compile(bomSchema) as CompiledValidator;

    return compiled;
};

/**
 * Validates a CycloneDX BOM document against the vendored 1.7 JSON schema.
 * @param bom The BOM document to validate. Typed as `unknown` so callers
 * can pass the raw output of their generator without first
 * upcasting — a failed validation is exactly what catches a type
 * drift bug.
 */
export const validateBom = (bom: unknown): ValidationResult => {
    const validator = compileBomValidator();
    const valid = validator(bom);

    return {
        errors: (validator.errors ?? []).map((error) => {
            return {
                instancePath: error.instancePath,
                message: error.message ?? "(no message)",
            };
        }),
        valid,
    };
};

/**
 * Validates and returns the document typed as {@link CycloneDxBom} on
 * success, or throws with a formatted error list.
 */
export const assertValidBom = (bom: unknown): CycloneDxBom => {
    const result = validateBom(bom);

    if (!result.valid) {
        const details = result.errors.map((error) => `  ${error.instancePath || "/"} — ${error.message}`).join("\n");

        throw new Error(`BOM failed CycloneDX 1.7 schema validation:\n${details}`);
    }

    return bom as CycloneDxBom;
};
