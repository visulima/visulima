import type { OpenAPIV3 } from "openapi-types";

/**
 * Which OpenAPI version to target. `"3.0"` (default) emits `nullable: true` on
 * nullable URL fields; `"3.1"` emits the JSON-Schema `type: ["string", "null"]`
 * form instead.
 */
type OpenApiVersion = "3.0" | "3.1";

interface CreatePaginationMetaSchemaOptions {
    /**
     * Target OpenAPI version. Controls how nullable URL fields are encoded.
     * Defaults to `"3.0"`.
     */
    openApiVersion?: OpenApiVersion;
}

interface CreatePaginationSchemaOptions {
    /**
     * The `$ref` pointing to the meta schema component.
     * Defaults to `"#/components/schemas/PaginationData"`.
     */
    metaReference?: string;
}

/**
 * The meta fields that are always present in a paginator's `meta` object.
 */
const REQUIRED_META_FIELDS = ["firstPage", "firstPageUrl", "lastPage", "lastPageUrl", "nextPageUrl", "page", "perPage", "previousPageUrl", "total"] as const;

const nullableStringSchema = (description: string, openApiVersion: OpenApiVersion): OpenAPIV3.SchemaObject => {
    if (openApiVersion === "3.1") {
        return { description, type: ["string", "null"] } as unknown as OpenAPIV3.SchemaObject;
    }

    return { description, nullable: true, type: "string" };
};

/**
 * Builds an OpenAPI schema object describing the `meta` block returned by
 * `Paginator.getMeta()`.
 *
 * `nextPageUrl` and `previousPageUrl` are nullable at runtime (the paginator
 * returns `null` on the first/last page), so they are emitted as nullable.
 * `firstPageUrl`/`lastPageUrl` are always strings. A `required` array is emitted
 * so generated clients treat every field as present. Pass
 * `{ openApiVersion: "3.1" }` to emit JSON-Schema-style nullability.
 * @param name The schema/component name. Defaults to `"PaginationData"`.
 * @param options Schema-building options.
 */
const createPaginationMetaSchemaObject = (name = "PaginationData", options: CreatePaginationMetaSchemaOptions = {}): Record<string, OpenAPIV3.SchemaObject> => {
    const { openApiVersion = "3.0" } = options;

    return {
        [name]: {
            properties: {
                firstPage: {
                    description: "Returns the number for the first page. It is always 1",
                    minimum: 0,
                    type: "integer",
                },
                firstPageUrl: {
                    description: "The URL for the first page",
                    type: "string",
                },
                lastPage: {
                    description: "Returns the value for the last page by taking the total of rows into account",
                    minimum: 0,
                    type: "integer",
                },
                lastPageUrl: {
                    description: "The URL for the last page",
                    type: "string",
                },
                nextPageUrl: nullableStringSchema("The URL for the next page, or null when on the last page", openApiVersion),
                page: {
                    description: "Current page number",
                    minimum: 1,
                    type: "integer",
                },
                perPage: {
                    description: "Returns the value for the limit passed to the paginate method",
                    minimum: 0,
                    type: "integer",
                },
                previousPageUrl: nullableStringSchema("The URL for the previous page, or null when on the first page", openApiVersion),
                total: {
                    description: "Holds the value for the total number of rows in the database",
                    minimum: 0,
                    type: "integer",
                },
            },
            required: [...REQUIRED_META_FIELDS],
            type: "object",
            xml: {
                name,
            },
        },
    };
};

/**
 * Builds an OpenAPI schema object describing a full paginated response
 * (`{ data: Item[], meta: PaginationData }`). Both `data` and `meta` are emitted
 * as `required`.
 * @param name The schema/component name.
 * @param items The schema (or `$ref`) for a single item in `data`.
 * @param metaReferenceOrOptions Either the meta `$ref` string (legacy) or an options object.
 */
const createPaginationSchemaObject = (
    name: string,
    items: OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject,
    metaReferenceOrOptions: string | CreatePaginationSchemaOptions = "#/components/schemas/PaginationData",
): Record<string, OpenAPIV3.SchemaObject> => {
    const metaReference
        = typeof metaReferenceOrOptions === "string" ? metaReferenceOrOptions : metaReferenceOrOptions.metaReference ?? "#/components/schemas/PaginationData";

    return {
        [name]: {
            properties: {
                data: {
                    items,
                    type: "array",
                    xml: {
                        name: "data",
                        wrapped: true,
                    },
                },
                meta: {
                    $ref: metaReference,
                },
            },
            required: ["data", "meta"],
            type: "object",
            xml: {
                name,
            },
        },
    };
};

export type { CreatePaginationMetaSchemaOptions, CreatePaginationSchemaOptions, OpenApiVersion };
export { createPaginationMetaSchemaObject, createPaginationSchemaObject };
