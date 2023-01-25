import type { DMMF } from "@prisma/generator-helper";
import type { JSONSchema7Definition } from "json-schema";

export type PrismaPrimitive = "BigInt" | "Boolean" | "Bytes" | "DateTime" | "Decimal" | "Float" | "Int" | "Json" | "String";

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
    keepRelationScalarFields?: "false" | "true";
    schemaId?: string;
    includeRequiredFields?: "false" | "true";
    persistOriginalType?: "false" | "true";
}
