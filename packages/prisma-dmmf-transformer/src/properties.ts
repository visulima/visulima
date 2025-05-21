import assert from "node:assert";

import type { DMMF } from "@prisma/generator-helper";
import type { JSONSchema7, JSONSchema7TypeName } from "json-schema";

import type { ModelMetaData, PrismaPrimitive, PropertyMap, PropertyMetaData, TransformOptions } from "./types";

const isDefined = <T>(value: T | null | undefined): value is T => value !== undefined && value !== null;

const getJSONSchemaScalar = (fieldType: PrismaPrimitive): JSONSchema7TypeName | JSONSchema7TypeName[] => {
    switch (fieldType) {
        case "Int":
        case "BigInt": {
            return "integer";
        }
        case "DateTime":
        case "Bytes":
        case "String": {
            return "string";
        }
        case "Float":
        case "Decimal": {
            return "number";
        }
        case "Json": {
            return ["number", "string", "boolean", "object", "array", "null"];
        }
        case "Boolean": {
            return "boolean";
        }
        default: {
            throw new Error(`Unhandled discriminated union member: ${JSON.stringify(fieldType)}`);
        }
    }
};

const getJSONSchemaType = (field: DMMF.Field): JSONSchema7["type"] => {
    const { isList, isRequired, kind, type } = field;

    let scalarFieldType: JSONSchema7["type"] = "object";

    if (kind === "scalar" && !isList) {
        scalarFieldType = getJSONSchemaScalar(type as PrismaPrimitive);
    } else if (isList) {
        scalarFieldType = "array";
    } else if (kind === "enum") {
        scalarFieldType = "string";
    }

    if (isRequired || isList) {
        return scalarFieldType;
    }

    const isFieldUnion = Array.isArray(scalarFieldType);

    if (isFieldUnion) {
        return [...new Set([...scalarFieldType, "null"])] as JSONSchema7["type"];
    }

    return [scalarFieldType as JSONSchema7TypeName, "null"];
};

const getDefaultValue = (field: DMMF.Field): JSONSchema7["default"] => {
    const fieldDefault = field.default;

    if (!field.hasDefaultValue) {
        return null;
    }

    if (field.kind === "enum") {
        return typeof fieldDefault === "string" ? fieldDefault : null;
    }

    if (field.kind !== "scalar") {
        return null;
    }

    switch (field.type) {
        case "String":
        case "BigInt":
        case "DateTime": {
            return typeof fieldDefault === "string" ? fieldDefault : null;
        }
        case "Int":
        case "Float":
        case "Decimal": {
            return typeof fieldDefault === "number" ? fieldDefault : null;
        }
        case "Boolean": {
            return typeof fieldDefault === "boolean" ? fieldDefault : null;
        }
        case "Json":
        case "Bytes": {
            return null;
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

const getJSONSchemaForPropertyReference = (field: DMMF.Field, { persistOriginalType, schemaId }: TransformOptions): JSONSchema7 => {
    const notNullable = field.isRequired || field.isList;

    assert.equal(typeof field.type, "string");

    const typeReference = `#/definitions/${field.type}`;
    const reference = { $ref: schemaId ? `${schemaId}${typeReference}` : typeReference };

    return notNullable
        ? reference
        : {
              anyOf: [reference, { type: "null" }],
              ...(persistOriginalType && {
                  originalType: field.type,
              }),
          };
};

const getItemsByDMMFType = (field: DMMF.Field, transformOptions: TransformOptions): JSONSchema7["items"] => {
    if ((field.kind === "scalar" && !field.isList) || field.kind === "enum") {
        return undefined;
    }

    if (field.kind === "scalar" && field.isList) {
        return { type: getJSONSchemaScalar(field.type as PrismaPrimitive) };
    }

    return getJSONSchemaForPropertyReference(field, transformOptions);
};

const isSingleReference = (field: DMMF.Field) => field.kind !== "scalar" && !field.isList && field.kind !== "enum";

const getEnumListByDMMFType =
    (modelMetaData: ModelMetaData) =>
    (field: DMMF.Field): string[] | undefined => {
        const enumItem = modelMetaData.enums.find(({ name }: { name: string }) => name === field.type);

        if (!enumItem) {
            return undefined;
        }

        return enumItem.values.map((item: { name: string }) => item.name);
    };

const getDescription = (field: DMMF.Field) => field.documentation;

const getPropertyDefinition = (modelMetaData: ModelMetaData, transformOptions: TransformOptions, field: DMMF.Field) => {
    const type = getJSONSchemaType(field);
    const format = getFormatByDMMFType(field.type);
    const items = getItemsByDMMFType(field, transformOptions);
    const enumList = getEnumListByDMMFType(modelMetaData)(field);
    const defaultValue = getDefaultValue(field);
    const description = getDescription(field);

    return {
        type,
        ...(transformOptions.persistOriginalType && {
            originalType: field.type,
        }),
        ...(isDefined(defaultValue) && { default: defaultValue }),
        ...(isDefined(format) && { format }),
        ...(isDefined(items) && { items }),
        ...(isDefined(enumList) && { enum: enumList }),
        ...(isDefined(description) && { description }),
    };
};

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
