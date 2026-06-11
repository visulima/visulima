import type { DMMF } from "@prisma/generator-helper";
import type { JSONSchema7, JSONSchema7TypeName } from "json-schema";

import type { ModelMetaData, PrismaPrimitive, PropertyMap, PropertyMetaData, TransformOptions } from "./types";
import isOptionEnabled from "./utils/is-option-enabled";

const isDefined = <T>(value: T | null | undefined): value is T => value !== undefined && value !== null;

// eslint-disable-next-line sonarjs/function-return-type
const getJSONSchemaScalar = (fieldType: PrismaPrimitive, transformOptions: TransformOptions): JSONSchema7TypeName | JSONSchema7TypeName[] => {
    switch (fieldType) {
        case "BigInt": {
            return transformOptions.bigIntType === "string" ? "string" : "integer";
        }
        case "Boolean": {
            return "boolean";
        }
        case "Bytes":
        case "DateTime":
        case "String": {
            return "string";
        }
        case "Decimal":
        case "Float": {
            return "number";
        }
        case "Int": {
            return "integer";
        }
        case "Json": {
            return ["number", "string", "boolean", "object", "array", "null"];
        }
        default: {
            throw new Error(`Unhandled discriminated union member: ${JSON.stringify(fieldType)}`);
        }
    }
};

// eslint-disable-next-line sonarjs/function-return-type
const getScalarTypeName = (field: DMMF.Field, transformOptions: TransformOptions): JSONSchema7["type"] => {
    const { isList, kind, type } = field;

    if (kind === "scalar" && !isList) {
        return getJSONSchemaScalar(type as PrismaPrimitive, transformOptions);
    }

    if (isList) {
        return "array";
    }

    if (kind === "enum") {
        return "string";
    }

    return "object";
};

// eslint-disable-next-line sonarjs/function-return-type
const getJSONSchemaType = (field: DMMF.Field, transformOptions: TransformOptions): JSONSchema7["type"] => {
    const { isList, isRequired } = field;
    const scalarFieldType = getScalarTypeName(field, transformOptions);

    // OpenAPI 3.0 does not allow type arrays; nullability is expressed via the
    // separate `nullable: true` keyword (added in getPropertyDefinition).
    if (isRequired || isList || transformOptions.nullableMode === "openapi") {
        return scalarFieldType;
    }

    const isFieldUnion = Array.isArray(scalarFieldType);

    if (isFieldUnion) {
        return [...new Set(["null", ...scalarFieldType])] as JSONSchema7["type"];
    }

    return [scalarFieldType as JSONSchema7TypeName, "null"];
};

// eslint-disable-next-line sonarjs/function-return-type
const getDefaultValue = (field: DMMF.Field): JSONSchema7["default"] => {
    const fieldDefault = field.default;

    if (!field.hasDefaultValue) {
        return undefined;
    }

    if (field.kind === "enum") {
        return typeof fieldDefault === "string" ? fieldDefault : undefined;
    }

    if (field.kind !== "scalar") {
        return undefined;
    }

    switch (field.type) {
        case "BigInt":
        case "DateTime":
        case "String": {
            return typeof fieldDefault === "string" ? fieldDefault : undefined;
        }
        case "Boolean": {
            return typeof fieldDefault === "boolean" ? fieldDefault : undefined;
        }
        case "Bytes":
        case "Json": {
            return undefined;
        }
        case "Decimal":
        case "Float":
        case "Int": {
            return typeof fieldDefault === "number" ? fieldDefault : undefined;
        }
        default: {
            throw new Error(`Unhandled discriminated union member: ${JSON.stringify(field.type)}`);
        }
    }
};

const getFormatByDMMFType = (fieldType: DMMF.Field["type"]): string | undefined => {
    if (fieldType === "DateTime") {
        return "date-time";
    }

    return undefined;
};

const getJSONSchemaForPropertyReference = (field: DMMF.Field, transformOptions: TransformOptions): JSONSchema7 => {
    const { persistOriginalType, schemaId } = transformOptions;
    const notNullable = field.isRequired || field.isList;

    const typeReference = `#/definitions/${field.type}`;
    const reference = { $ref: schemaId ? `${schemaId}${typeReference}` : typeReference };

    if (notNullable) {
        return reference;
    }

    // OpenAPI 3.0 cannot express `{ type: "null" }`; use `nullable: true` next to the $ref instead.
    if (transformOptions.nullableMode === "openapi") {
        return {
            ...reference,
            nullable: true,
            ...(isOptionEnabled(persistOriginalType) && {
                originalType: field.type,
            }),
        } as JSONSchema7;
    }

    return {
        anyOf: [reference, { type: "null" }],
        ...(isOptionEnabled(persistOriginalType) && {
            originalType: field.type,
        }),
    };
};

const getItemsByDMMFType = (field: DMMF.Field, transformOptions: TransformOptions, enumList: string[] | undefined): JSONSchema7["items"] => {
    if (field.kind === "scalar" && !field.isList) {
        return undefined;
    }

    if (field.kind === "enum") {
        // A non-list enum carries its members at the property level (see getPropertyDefinition);
        // a list enum (e.g. `Role[]`) must carry them on the array `items` instead, otherwise the
        // `enum` keyword would (incorrectly) require the whole array to equal a single member.
        if (field.isList && enumList) {
            return { enum: enumList, type: "string" };
        }

        return undefined;
    }

    if (field.kind === "scalar" && field.isList) {
        return { type: getJSONSchemaScalar(field.type as PrismaPrimitive, transformOptions) };
    }

    return getJSONSchemaForPropertyReference(field, transformOptions);
};

const isSingleReference = (field: DMMF.Field) => field.kind !== "scalar" && !field.isList && field.kind !== "enum";

const resolveEnumValues = (modelMetaData: ModelMetaData, field: DMMF.Field): string[] | undefined => {
    if (modelMetaData.enumNameToValues) {
        return modelMetaData.enumNameToValues.get(field.type);
    }

    const enumItem = modelMetaData.enums.find(({ name }: { name: string }) => name === field.type);

    if (!enumItem) {
        return undefined;
    }

    return enumItem.values.map((item: { name: string }) => item.name);
};

const getDescription = (field: DMMF.Field) => field.documentation;

/**
 * Derive native-type / default-driven JSON Schema enrichments for a scalar field.
 *
 * Behaviour-preserving unless `enrichNativeTypes` is enabled.
 */
const getNativeEnrichment = (field: DMMF.Field): JSONSchema7 => {
    const enrichment: JSONSchema7 = {};

    if (field.kind !== "scalar") {
        return enrichment;
    }

    if (field.type === "Bytes") {
        // base64 is how Prisma serializes Bytes over the wire / in JSON.
        enrichment.contentEncoding = "base64";
    }

    const nativeType = field.nativeType as [string, string[]] | null | undefined;

    if (nativeType) {
        const [name, nativeArguments] = nativeType;

        if ((name === "VarChar" || name === "Char") && nativeArguments.length > 0) {
            const length = Number.parseInt(nativeArguments[0] as string, 10);

            if (Number.isFinite(length)) {
                enrichment.maxLength = length;
            }
        }
    }

    const fieldDefault = field.default;

    if (field.type === "String" && typeof fieldDefault === "object" && "name" in fieldDefault) {
        const functionName = (fieldDefault as { name: string }).name;

        if (functionName === "uuid") {
            enrichment.format = "uuid";
        } else if (functionName === "cuid") {
            // cuid v1 shape: starts with `c`, followed by base36 chars.
            enrichment.pattern = "^c[a-z0-9]{24,}$";
        }
    }

    return enrichment;
};

const getPropertyDefinition = (modelMetaData: ModelMetaData, transformOptions: TransformOptions, field: DMMF.Field) => {
    const type = getJSONSchemaType(field, transformOptions);
    const format = getFormatByDMMFType(field.type);
    const resolvedEnum = resolveEnumValues(modelMetaData, field);
    const items = getItemsByDMMFType(field, transformOptions, resolvedEnum);
    const defaultValue = getDefaultValue(field);
    const description = getDescription(field);

    // Enum members only belong at the property level for non-list enums; list enums attach them to `items`.
    let enumList: (string | null)[] | undefined = field.kind === "enum" && !field.isList ? resolvedEnum : undefined;

    // An optional (nullable) enum must allow `null` to satisfy the `enum` keyword,
    // otherwise valid `null` data fails despite the type permitting it. `null` is a
    // legitimate JSON Schema enum value here, hence the unicorn/no-null exception.
    if (enumList && !field.isRequired && !field.isList && transformOptions.nullableMode !== "openapi") {
        // eslint-disable-next-line unicorn/no-null
        enumList = [...enumList, null];
    }

    const enrichment = isOptionEnabled(transformOptions.enrichNativeTypes) ? getNativeEnrichment(field) : {};

    return {
        type,
        ...(isOptionEnabled(transformOptions.persistOriginalType) && {
            originalType: field.type,
        }),
        ...(isDefined(defaultValue) && { default: defaultValue }),
        ...(isDefined(format) && { format }),
        ...(isDefined(items) && { items }),
        ...(isDefined(enumList) && { enum: enumList }),
        // OpenAPI 3.0 nullability: a non-required, non-list field that is not a top-level
        // reference is marked nullable instead of using a `["...", "null"]` type union.
        ...(transformOptions.nullableMode === "openapi" && !field.isRequired && !field.isList && { nullable: true }),
        ...enrichment,
        ...(isDefined(description) && { description }),
    };
};

/**
 * Build a JSON Schema property for a single Prisma DMMF field.
 *
 * Curried: `getJSONSchemaProperty(modelMetaData, transformOptions)(field)` returns a
 * `[name, definition, metadata]` tuple where `definition` is the JSON Schema fragment for the
 * field and `metadata` carries `required` / `isScalar` / `hasDefaultValue` flags used by the
 * model-level transformer to assemble `required` arrays.
 * @example
 * ```ts
 * import { getJSONSchemaProperty } from "@visulima/prisma-dmmf-transformer";
 *
 * const [name, definition] = getJSONSchemaProperty({ enums: [] }, {})(field);
 * ```
 */
const getJSONSchemaProperty =
    (modelMetaData: ModelMetaData, transformOptions: TransformOptions) =>
    (field: DMMF.Field): PropertyMap => {
        const propertyMetaData: PropertyMetaData = {
            hasDefaultValue: field.hasDefaultValue,
            isScalar: field.kind === "scalar" || field.kind === "enum",
            required: field.isRequired,
        };

        const property = isSingleReference(field)
            ? getJSONSchemaForPropertyReference(field, transformOptions)
            : getPropertyDefinition(modelMetaData, transformOptions, field);

        return [field.name, property, propertyMetaData];
    };

export default getJSONSchemaProperty;
