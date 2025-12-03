import { createPaginationMetaSchemaObject } from "@visulima/pagination";
import { getJSONSchemaProperty, transformDMMF } from "@visulima/prisma-dmmf-transformer";
import type { JSONSchema7 } from "json-schema";
import type { OpenAPIV3 } from "openapi-types";

import formatSchemaReference from "./utils/format-schema-ref";

const getJSONSchemaScalar = (fieldType: object | string) => {
    switch (fieldType) {
        case "BigInt":
        case "Int": {
            return "integer";
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
        case "Json": {
            return "object";
        }
        case "Null": {
            return "null";
        }
        default: {
            return "";
        }
    }
};

const PAGINATION_SCHEMA_NAME = "PaginationData";

const methodsNames = [
    { methodStart: "createOne", schemaNameStart: "Create" },
    { methodStart: "updateOne", schemaNameStart: "Update" },
];

class PrismaJsonSchemaParser {
    private readonly schemaInputTypes: Map<string, any> = new Map<string, any>();

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public constructor(private readonly dmmf: any) {}

    // eslint-disable-next-line class-methods-use-this,@typescript-eslint/explicit-module-boundary-types
    public formatInputTypeData(inputType: any) {
        if (inputType.kind === "object") {
            const reference = formatSchemaReference(inputType.type.name);

            if (inputType.isList) {
                return {
                    items: {
                        $ref: reference,
                    },
                    type: "array",
                    xml: {
                        name: inputType.type.name,
                        wrapped: true,
                    },
                };
            }

            return { $ref: reference };
        }

        const type = getJSONSchemaScalar(inputType.type);

        if (inputType.isList) {
            return {
                items: {
                    type,
                },
                type: "array",
                xml: {
                    name: inputType.type.name,
                    wrapped: true,
                },
            };
        }

        return { type };
    }

    public getExampleModelsSchemas(
        modelNames: string[],
        schemas: Record<string, OpenAPIV3.SchemaObject>,
    ): Record<string, OpenAPIV3.ExampleObject | OpenAPIV3.ReferenceObject> {
        const referenceToSchema = (reference: string) => {
            const name = reference.replace("#/components/schemas/", "");
            const model = schemas[name] as OpenAPIV3.SchemaObject;

            const values: Record<string, object[] | string> = {};

            Object.entries((model.properties as OpenAPIV3.SchemaObject | undefined) ?? {}).forEach(([key, v]) => {
                const type = (v as OpenAPIV3.SchemaObject).type as string;

                // eslint-disable-next-line @typescript-eslint/no-use-before-define
                values[key] = type === "array" ? [arrayItemsToSchema(v.items)] : type;
            });

            return values;
        };

        const objectPropertiesToSchema = (objectProperties: Record<string, OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject>) => {
            const values: Record<string, object[] | object | string> = {};

            Object.entries(objectProperties).forEach(([key, value]) => {
                values[key]
                    = (value as { $ref?: string }).$ref === undefined
                        ? ((value as OpenAPIV3.SchemaObject).type as string)
                        : referenceToSchema((value as OpenAPIV3.ReferenceObject).$ref);
            });

            return values;
        };

        const arrayItemsToSchema = (items: OpenAPIV3.ArraySchemaObject) => {
            const values: Record<string, object[] | object> = {};

            Object.entries(items).forEach(([key, value]) => {
                if (value.items.$ref !== undefined) {
                    values[key] = [referenceToSchema(value.items.$ref)];
                } else if (value.type === "array") {
                    values[key] = [arrayItemsToSchema(value.items)];
                } else if (value.type === "object") {
                    values[key] = objectPropertiesToSchema(value.properties);
                } else {
                    values[key] = value.type;
                }
            });

            return values;
        };

        // eslint-disable-next-line unicorn/no-array-reduce
        return modelNames.reduce((accumulator, modelName) => {
            const value: Record<string, object[] | object | string> = {};
            const model = schemas[modelName] as OpenAPIV3.SchemaObject;

            Object.entries(model.properties as OpenAPIV3.SchemaObject).forEach(([key, v]) => {
                const type = (v as OpenAPIV3.SchemaObject).type as string;

                if (type === "array") {
                    value[key] = [referenceToSchema(v.items.$ref)];
                } else if (type === "object") {
                    value[key] = objectPropertiesToSchema(v.properties);
                } else {
                    value[key] = type;
                }
            });

            const pagination = this.getPaginationDataSchema()[PAGINATION_SCHEMA_NAME] as OpenAPIV3.SchemaObject;
            const meta: Record<string, string> = {};

            Object.entries(pagination.properties as OpenAPIV3.SchemaObject).forEach(([key, v]) => {
                meta[key] = (v as OpenAPIV3.SchemaObject).type as string;
            });

            return {
                ...accumulator,
                [`${modelName}Page`]: {
                    value: {
                        data: [value],
                        meta,
                    },
                },
                [`${modelName}s`]: {
                    value: [value],
                },
                [modelName]: {
                    value,
                },
            };
        }, {});
    }

    // eslint-disable-next-line class-methods-use-this
    public getPaginatedModelsSchemas(modelNames: string[]): Record<string, OpenAPIV3.SchemaObject> {
        // eslint-disable-next-line unicorn/no-array-reduce
        return modelNames.reduce((accumulator, modelName) => {
            return {
                ...accumulator,
                [`${modelName}Page`]: {
                    properties: {
                        data: {
                            items: {
                                $ref: formatSchemaReference(modelName),
                            },
                            type: "array",
                            xml: {
                                name: "data",
                                wrapped: true,
                            },
                        },
                        meta: {
                            $ref: formatSchemaReference(PAGINATION_SCHEMA_NAME),
                        },
                    },
                    type: "object",
                    xml: {
                        name: `${modelName}Page`,
                    },
                },
            };
        }, {});
    }

    // eslint-disable-next-line class-methods-use-this
    public getPaginationDataSchema(): Record<string, OpenAPIV3.SchemaObject> {
        return createPaginationMetaSchemaObject(PAGINATION_SCHEMA_NAME);
    }

    public parseInputTypes(models: string[]): Record<string, JSONSchema7> {
        // eslint-disable-next-line unicorn/no-array-reduce
        const definitions = models.reduce((accumulator: Record<string, any>, modelName) => {
            const methods = methodsNames.map((method) => {
                return {
                    name: `${method.methodStart}${modelName}`,
                    schemaName: `${method.schemaNameStart}${modelName}`,
                };
            });

            methods.forEach(({ name: method, schemaName }) => {
                const dataFields = this.dmmf.mutationType.fieldMap[method].args[0].inputTypes[0].type.fields;
                const requiredProperties: string[] = [];
                // eslint-disable-next-line unicorn/no-array-reduce
                const properties = dataFields.reduce((propertiesAccumulator: any, field: any) => {
                    if (field.inputTypes[0].kind === "scalar") {
                        const schema = getJSONSchemaProperty(
                            this.dmmf.datamodel,
                            {},
                        )({
                            name: field.name,
                            ...field.inputTypes[0],
                        });

                        // @TODO: added the correct type
                        // @ts-expect-error
                        const { type: schemaType } = schema[1];

                        if (schemaType && Array.isArray(schemaType)) {
                            if (schemaType.includes("null")) {
                                // eslint-disable-next-line no-param-reassign
                                propertiesAccumulator[field.name] = {
                                    ...schemaType,
                                    nullable: true,
                                    type: schemaType.filter((type: string) => type !== "null"),
                                };

                                if (propertiesAccumulator[field.name].type.length === 1) {
                                    // eslint-disable-next-line no-param-reassign
                                    propertiesAccumulator[field.name] = {
                                        ...propertiesAccumulator[field.name],
                                        type: propertiesAccumulator[field.name].type[0],
                                    };
                                }
                            }
                        } else {
                            // eslint-disable-next-line no-param-reassign,prefer-destructuring
                            propertiesAccumulator[field.name] = schema[1];
                        }
                    } else {
                        const typeName = this.parseObjectInputType(field.inputTypes[0]);

                        // eslint-disable-next-line no-param-reassign
                        propertiesAccumulator[field.name] = {
                            ...typeName,
                            nullable: field.isNullable,
                        };
                    }

                    if (field.isRequired) {
                        requiredProperties.push(field.name);
                    }

                    // TODO: find the correct type

                    return propertiesAccumulator;
                }, {});

                accumulator[schemaName] = {
                    properties,
                    type: "object",
                    xml: {
                        name: schemaName,
                    },
                };

                if (requiredProperties.length > 0) {
                    accumulator[schemaName].required = requiredProperties;
                }
            });

            return accumulator;
        }, {});

        this.schemaInputTypes.forEach((value, key) => {
            definitions[key] = {
                properties: value,
                type: "object",
                xml: {
                    name: key,
                },
            };
        });

        return definitions;
    }

    public parseModels(): Record<string, JSONSchema7> {
        const modelsDefinitions = transformDMMF(this.dmmf).definitions as Record<string, JSONSchema7>;

        Object.keys(modelsDefinitions).forEach((definition: number | string) => {
            // @TODO: added the correct type
            // @ts-expect-error
            const { properties } = modelsDefinitions[definition];

            Object.keys(properties).forEach((property: string) => {
                if (Array.isArray(properties[property].type) && properties[property].type.includes("null")) {
                    properties[property].type = properties[property].type.filter((type: string) => type !== "null");

                    if (properties[property].type.length === 1) {
                        // eslint-disable-next-line prefer-destructuring
                        properties[property].type = properties[property].type[0];
                    }

                    properties[property].nullable = true;
                }
            });
        });

        return modelsDefinitions;
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public parseObjectInputType(fieldType: any): { $ref?: string; type?: string } {
        if (fieldType.kind === "object") {
            if (!this.schemaInputTypes.has(fieldType.type.name)) {
                this.schemaInputTypes.set(fieldType.type.name, {});

                fieldType.type.fields.forEach((field: any) => {
                    let fieldData: Record<string, any> = {};

                    if (field.inputTypes.length > 1) {
                        let nullable = false;

                        const anyOf = field.inputTypes
                            .map((inputType: any) => {
                                const inputTypeData = this.formatInputTypeData(inputType);

                                if (inputTypeData.type === "null") {
                                    nullable = true;

                                    return;
                                }

                                // eslint-disable-next-line consistent-return
                                return inputTypeData;
                            })
                            .filter(Boolean);

                        if (anyOf.length === 1) {
                            // eslint-disable-next-line prefer-destructuring
                            fieldData = anyOf[0];
                        } else {
                            fieldData.anyOf = anyOf;
                        }

                        if (nullable) {
                            fieldData.nullable = true;
                        }
                    } else {
                        const inputType = field.inputTypes[0];

                        fieldData = this.formatInputTypeData(inputType);
                    }

                    this.schemaInputTypes.set(fieldType.type.name, {
                        ...this.schemaInputTypes.get(fieldType.type.name),
                        [field.name]: fieldData,
                    });

                    field.inputTypes.forEach((inputType: any) => {
                        if (inputType.kind === "object") {
                            this.parseObjectInputType(inputType);
                        }
                    });
                });
            }

            return { $ref: formatSchemaReference(fieldType.type.name) };
        }

        return { type: getJSONSchemaScalar(fieldType.type) };
    }
}

export default PrismaJsonSchemaParser;
