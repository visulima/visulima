/**
 * AJV harness for round-tripping report emitters through the upstream
 * JSON schemas. SARIF + CycloneDX are draft-07; CSAF is draft 2020-12.
 *
 * Vendored copies of each schema live alongside this file so tests stay
 * fully offline. To refresh them, run `scripts/refresh-vendored-schemas.ts`.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { ValidateFunction } from "ajv";
import Ajv from "ajv";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";

const here = dirname(fileURLToPath(import.meta.url));

const readSchema = (name: string): Record<string, unknown> => JSON.parse(readFileSync(join(here, name), "utf8")) as Record<string, unknown>;

// Cache compiled validators across tests so the schema is parsed once.
let sarif: ValidateFunction | undefined;
let cyclonedx: ValidateFunction | undefined;
let csaf: ValidateFunction | undefined;

export const sarifValidator = (): ValidateFunction => {
    if (sarif === undefined) {
        const ajv = new Ajv({ allErrors: true, strict: false });

        addFormats(ajv);
        sarif = ajv.compile(readSchema("sarif-2.1.0.json"));
    }

    return sarif;
};

export const cyclonedxValidator = (): ValidateFunction => {
    if (cyclonedx === undefined) {
        const ajv = new Ajv({ allErrors: true, strict: false });

        addFormats(ajv);
        // CycloneDX 1.7 references the SPDX licence-id and JSF signature schemas
        // by relative URI — register them so AJV resolves `$ref` against the same
        // base URI the main schema declares.
        ajv.addSchema(readSchema("spdx.schema.json"), "spdx.schema.json");
        ajv.addSchema(readSchema("jsf-0.82.schema.json"), "jsf-0.82.schema.json");
        ajv.addSchema(readSchema("cryptography-defs.schema.json"), "cryptography-defs.schema.json");
        cyclonedx = ajv.compile(readSchema("cyclonedx-1.7.json"));
    }

    return cyclonedx;
};

// CVSS schemas (FIRST.org) are JSON Schema draft-04 — they use the legacy
// `id` keyword instead of `$id` and declare a draft-04 `$schema`. Ajv2020
// only knows about 2020-12. Rewrite recursively so the structural validation
// (which is what we actually want — `type`, `enum`, `properties`, `required`)
// passes under 2020-12 semantics.
const upgradeDraft04 = (value: unknown): unknown => {
    if (Array.isArray(value)) {
        return value.map((item) => upgradeDraft04(item));
    }

    if (value !== null && typeof value === "object") {
        const out: Record<string, unknown> = {};

        for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
            if (key === "$schema") {
                continue;
            }

            const rewrittenKey = key === "id" ? "$id" : key;

            out[rewrittenKey] = upgradeDraft04(raw);
        }

        return out;
    }

    return value;
};

export const csafValidator = (): ValidateFunction => {
    if (csaf === undefined) {
        const ajv = new Ajv2020({ allErrors: true, strict: false });

        addFormats(ajv);
        // CSAF references FIRST.org's CVSS JSON schemas by absolute URL —
        // register them under those IDs so `$ref` resolves locally.
        ajv.addSchema(upgradeDraft04(readSchema("cvss-v2.0.json")) as object, "https://www.first.org/cvss/cvss-v2.0.json");
        ajv.addSchema(upgradeDraft04(readSchema("cvss-v3.0.json")) as object, "https://www.first.org/cvss/cvss-v3.0.json");
        ajv.addSchema(upgradeDraft04(readSchema("cvss-v3.1.json")) as object, "https://www.first.org/cvss/cvss-v3.1.json");
        csaf = ajv.compile(readSchema("csaf-2.0.json"));
    }

    return csaf;
};

export const formatErrors = (validate: ValidateFunction): string =>
    (validate.errors ?? []).map((e) => `${e.instancePath || "/"} ${e.message ?? ""}`).join("\n");
