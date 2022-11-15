import type { DMMF } from "@prisma/generator-helper";
import type { JSONSchema7Definition } from "json-schema";

export type PrismaPrimitive = "String" | "BigInt" | "Bytes" | "Decimal" | "Boolean" | "Int" | "Float" | "Json" | "DateTime";

export interface PropertyMetaData {
    required: boolean;
    hasDefaultValue: boolean;
    isScalar: boolean;
}

export interface ModelMetaData {
    enums: DMMF.DatamodelEnum[];
}

export type DefinitionMap = [name: string, definition: JSONSchema7Definition];
export type PropertyMap = [...DefinitionMap, PropertyMetaData];

export interface TransformOptions {
    keepRelationScalarFields?: "true" | "false";
    schemaId?: string;
    includeRequiredFields?: "true" | "false";
    persistOriginalType?: "true" | "false";
}
