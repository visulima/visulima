import { readFileSync } from "node:fs";
import Ajv04 from "ajv-draft-04";
import addFormats from "ajv-formats";
import Ajv2020 from "ajv/dist/2020";
import type Ajv from "ajv";
import type { ErrorObject, Options, ValidateFunction } from "ajv";
import type { OpenAPIV2, OpenAPIV3, OpenAPIV3_1 } from "openapi-types";

import getOpenApiVersion from "./util/get-openapi-version";

const ajvVersions: Record<string, typeof Ajv> = {
    "http://json-schema.org/draft-04/schema#": Ajv04,
    "https://json-schema.org/draft/2020-12/schema": Ajv2020,
};

// eslint-disable-next-line security/detect-non-literal-fs-filename
const importJSON = (file: string): any => JSON.parse(readFileSync(file, "utf8"));

interface CacheValue {
    schema: Record<string, unknown>;
    validate: ValidateFunction;
}

const ajvCache: Record<string, CacheValue | undefined> = {};

const getAjvValidator = (version: string, ajvOptions: Options = {}): CacheValue => {
    if (ajvCache[version] === undefined) {
        const schema = importJSON(`${__dirname}/../schemas/v${version}/schema.json`);

        const AjvClass = ajvVersions[schema.$schema] as typeof Ajv;
        const ajv = new AjvClass({
            allErrors: true,
            coerceTypes: "array",
            discriminator: true,
            strictTypes: false,
            ...ajvOptions,
        });

        addFormats(ajv);

        ajv.addFormat("media-range", true); // used in 3.1

        ajvCache[version] = {
            schema,
            validate: ajv.compile(schema),
        };
    }

    return ajvCache[version] as CacheValue;
};

/**
 * Because of the way that Ajv works, if a validation error occurs deep within a schema there's a chance that errors
 * will also be thrown for its immediate parents, leading to a case where we'll eventually show the error indecipherable
 * errors like "$ref is missing here!" instance of what's _actually_ going on where they may have mistyped `enum` as
 * `enumm`.
 *
 * To alleviate this confusing noise, we're compressing Ajv errors down to only surface the deepest point for each
 * lineage, so that if a user typos `enum` as `enumm` we'll surface just that error for them (because really that's
 * **the** error).
 */
const reduceAjvErrors = (errors: ErrorObject[]): ErrorObject[] => {
    const flattened = new Map();

    errors.forEach((error) => {
        // These two errors appear when a child schema of them has a problem and instead of polluting the user with
        // indecipherable noise we should instead relay the more specific error to them. If this is all that's present in
        // the stack then as a safety net before we wrap up we'll just return the original `errors` stack.
        if (["must have required property '$ref'", "must match exactly one schema in oneOf"].includes(error.message ?? "")) {
            return;
        }

        // If this is our first run through let's initialize our dataset and move along.
        if (flattened.size === 0) {
            flattened.set(error.instancePath, error);

            return;
        }

        if (flattened.has(error.instancePath)) {
            // If we already have an error recorded for this `instancePath` we can ignore it because we (likely) already have
            // recorded the more specific error.
            return;
        }

        // If this error hasn't already been recorded, maybe it's an error against the same `instancePath` stack, in which
        // case we should ignore it because the more specific error has already been recorded.
        let shouldRecordError = true;

        flattened.forEach((flat) => {
            if (flat.instancePath.includes(error.instancePath)) {
                shouldRecordError = false;
            }
        });

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (shouldRecordError) {
            flattened.set(error.instancePath, error);
        }
    });

    // If we weren't able to fold errors down for whatever reason just return the original stack.
    if (flattened.size === 0) {
        return errors;
    }

    return [...flattened.values()] as ErrorObject[];
};

interface ReturnValue {
    errors?: (Error | ErrorObject)[];
    specification: {
        version: string | undefined;
    };
    valid: boolean;
}

/**
 * Validates the given Swagger API against the Swagger 2.0 or OpenAPI 3.0 and 3.1 schemas.
 */
export const validate = async (data: OpenAPIV2.Document | OpenAPIV3_1.Document | OpenAPIV3.Document | object): Promise<ReturnValue> => {
    const { specificationVersion, version } = getOpenApiVersion(data);

    if (!version) {
        return {
            errors: [new Error("Cannot find supported swagger/openapi version in specification, version must be a string.")],
            specification: {
                version: undefined,
            },
            valid: false,
        };
    }

    const { validate: ajvValidate } = getAjvValidator(version);

    const result: ReturnValue = {
        specification: {
            version: specificationVersion,
        },
        valid: ajvValidate(data),
    };

    if (ajvValidate.errors) {
        result.errors = reduceAjvErrors(ajvValidate.errors);
    }

    return result;
};

export const supportedOpenApiVersions = openApiVersions;
