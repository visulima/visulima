import type { DMMF } from "@prisma/generator-helper";
import type { JSONSchema7Definition } from "json-schema";
import type { ReadonlyDeep } from "type-fest";

export type PrismaPrimitive = "BigInt" | "Boolean" | "Bytes" | "DateTime" | "Decimal" | "Float" | "Int" | "Json" | "String";

/**
 * A boolean-like option value.
 *
 * Prisma generator configuration only ever delivers option values as strings ("true" / "false"),
 * so the historic API accepted those literal strings. Programmatic callers naturally reach for real
 * booleans, so both forms are accepted and normalized internally.
 */
export type BooleanLike = "false" | "true" | boolean;

/**
 * How nullability should be expressed in the generated schema.
 *
 * "json-schema" (default) uses JSON Schema draft-07 semantics: optional scalars become a type union
 * (["string", "null"]) and optional relations become { anyOf: [..., { type: "null" }] }. "openapi"
 * uses OpenAPI 3.0 semantics: a single type plus nullable: true (OpenAPI 3.0 rejects type arrays and
 * { type: "null" }).
 */
export type NullableMode = "json-schema" | "openapi";

export interface PropertyMetaData {
    hasDefaultValue: boolean;
    isScalar: boolean;
    required: boolean;
}

export interface ModelMetaData {
    /**
     * Pre-built lookup of enum name to its member names.
     *
     * Optional and internal: the document transformer populates this once per document so per-field
     * enum resolution is O(1) instead of an O(enums) linear scan. When absent (e.g. when the
     * per-field helper is used standalone) the transformer falls back to scanning `enums`.
     */
    enumNameToValues?: ReadonlyMap<string, string[]>;

    enums: ReadonlyDeep<DMMF.DatamodelEnum[]>;
}

export type DefinitionMap = [name: string, definition: JSONSchema7Definition];
export type PropertyMap = [...DefinitionMap, PropertyMetaData];

export interface TransformOptions {
    /**
     * Map Prisma `BigInt` fields to a JSON Schema type.
     *
     * Prisma's DMMF delivers `BigInt` defaults as strings, so the default "integer" mapping can emit
     * a string default under an integer type which fails self-validation. Set to "string" to emit
     * `type: "string"` for BigInt fields, the common JSON practice for values larger than 2^53.
     * @default "integer"
     */
    bigIntType?: "integer" | "string";

    /**
     * Enrich scalar properties from Prisma native-type and default attributes.
     *
     * When enabled: `@db.VarChar(255)` / `@db.Char(n)` add `maxLength`, `@default(uuid())` adds
     * `format: "uuid"`, `@default(cuid())` adds a `pattern`, and `Bytes` fields add
     * `contentEncoding: "base64"`.
     * @default false
     */
    enrichNativeTypes?: BooleanLike;

    /**
     * If truthy, all required scalar Prisma fields without a default value are added to the
     * `required` array of their schema definition.
     * @default false
     */
    includeRequiredFields?: BooleanLike;

    /**
     * If truthy, foreign-key scalar fields for related records are kept in the output (they are
     * stripped by default).
     * @default false
     */
    keepRelationScalarFields?: BooleanLike;

    /**
     * Controls how nullability is expressed. See `NullableMode`.
     * @default "json-schema"
     */
    nullableMode?: NullableMode;

    /**
     * If truthy, the original Prisma type is emitted under the `originalType` property key.
     * @default false
     */
    persistOriginalType?: BooleanLike;

    /**
     * Adds an `$id` to the generated schema. All `$ref`s are prefixed with it.
     */
    schemaId?: string;
}
