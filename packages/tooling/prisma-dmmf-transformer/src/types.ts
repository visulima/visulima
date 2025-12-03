import type { DMMF } from "@prisma/generator-helper";
import type { JSONSchema7Definition } from "json-schema";
import type { ReadonlyDeep } from "type-fest";

export type PrismaPrimitive = "BigInt" | "Boolean" | "Bytes" | "DateTime" | "Decimal" | "Float" | "Int" | "Json" | "String";

export interface PropertyMetaData {
    hasDefaultValue: boolean;
    isScalar: boolean;
    required: boolean;
}

export interface ModelMetaData {
    enums: ReadonlyDeep<DMMF.DatamodelEnum[]>;
}

export type DefinitionMap = [name: string, definition: JSONSchema7Definition];
export type PropertyMap = [...DefinitionMap, PropertyMetaData];

export interface TransformOptions {
    includeRequiredFields?: "false" | "true";
    keepRelationScalarFields?: "false" | "true";
    persistOriginalType?: "false" | "true";
    schemaId?: string;
}
