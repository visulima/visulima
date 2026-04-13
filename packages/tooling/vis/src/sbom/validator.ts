/**
 * Ajv-backed CycloneDX 1.6 validator — **test-only**.
 *
 * This module is imported exclusively from files under `__tests__/` so that
 * `ajv` and the vendored schemas never end up in the published `dist/`. It
 * wires the three vendored schemas together (bom + spdx + jsf) and returns
 * a validator function for the root BOM document.
 *
 * Do not import this module from runtime code. `ajv` is a `devDependency`.
 */

// eslint-disable-next-line import/no-extraneous-dependencies -- test-only helper; ajv is a devDependency
import Ajv from "ajv";
// eslint-disable-next-line import/no-extraneous-dependencies -- test-only helper; ajv-formats is a devDependency
import addFormats from "ajv-formats";

import bomSchema from "./schemas/bom-1.6.schema.json" with { type: "json" };
import jsfSchema from "./schemas/jsf-0.82.schema.json" with { type: "json" };
import spdxSchema from "./schemas/spdx.schema.json" with { type: "json" };

import type { CycloneDxBom } from "./types";

/** Silent logger — suppresses benign `unknown format` warnings for `iri-reference` / `idn-email`, which ajv-formats does not implement. */
const silentLogger = {
    error: () => { /* no-op */ },
    log: () => { /* no-op */ },
    warn: () => { /* no-op */ },
};

/**
 * Result of validating a BOM document.
 */
export interface ValidationResult {
    errors: { instancePath: string; message: string }[];
    valid: boolean;
}

/** Cached compiled validator — the schema is large, compilation is not cheap. */
let compiled: ((data: unknown) => boolean) & { errors?: { instancePath: string; message?: string }[] | null } | undefined;

const compileBomValidator = (): typeof compiled => {
    if (compiled) {
        return compiled;
    }

    // CycloneDX 1.6 schemas declare `$schema: draft-07`, which is the default
    // dialect for the `Ajv` class. `strict: false` tolerates schema features
    // ajv is stricter about than the spec requires (e.g. extra keywords
    // alongside `$ref`). A silent logger suppresses the harmless "unknown
    // format" warnings for `iri-reference` / `idn-email`, which `ajv-formats`
    // doesn't implement but the schema references.
    const ajv = new Ajv({
        allErrors: true,
        logger: silentLogger,
        strict: false,
        validateFormats: true,
    });

    addFormats.default(ajv);

    // Register the two $ref'd sub-schemas against the filenames the main
    // schema uses (relative refs: "spdx.schema.json", "jsf-0.82.schema.json").
    ajv.addSchema(spdxSchema, "spdx.schema.json");
    ajv.addSchema(jsfSchema, "jsf-0.82.schema.json");

    compiled = ajv.compile(bomSchema);

    return compiled;
};

/**
 * Validates a CycloneDX BOM document against the vendored 1.6 JSON schema.
 *
 * @param bom - The BOM document to validate. Typed as `unknown` so callers can
 *              pass the raw output of their generator without first
 *              upcasting — a failed validation is exactly what catches a type
 *              drift bug.
 */
export const validateBom = (bom: unknown): ValidationResult => {
    const validator = compileBomValidator()!;
    const valid = validator(bom);

    return {
        errors: (validator.errors ?? []).map((error) => ({
            instancePath: error.instancePath ?? "",
            message: error.message ?? "(no message)",
        })),
        valid,
    };
};

/**
 * Type-narrowing alias: validates and returns the document typed as
 * {@link CycloneDxBom} on success, or throws with a formatted error list.
 */
export const assertValidBom = (bom: unknown): CycloneDxBom => {
    const result = validateBom(bom);

    if (!result.valid) {
        const details = result.errors.map((error) => `  ${error.instancePath || "/"} — ${error.message}`).join("\n");

        throw new Error(`BOM failed CycloneDX 1.6 schema validation:\n${details}`);
    }

    return bom as CycloneDxBom;
};
