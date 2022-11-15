import { getJSONSchemaProperty, transformDMMF } from "@visulima/prisma-dmmf-transformer";
import type { JSONSchema7 } from "json-schema";
import type { OpenAPIV3 } from "openapi-types";

import formatSchemaReference from "./utils/format-schema-ref";

const getJSONSchemaScalar = (fieldType: string | object) => {
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
            return "object";
        }
        case "Boolean": {
            return "boolean";
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
    schemaInputTypes: Map<string, any> = new Map<string, any>();

    constructor(private dmmf: any) {}

    public parseModels(): {
        [key: string]: JSONSchema7;
    } {
        const modelsDefinitions = transformDMMF(this.dmmf).definitions as {
            [key: string]: JSONSchema7;
        };

        Object.keys(modelsDefinitions || {})?.forEach((definition: string | number) => {
            // @TODO: added the correct type
            // @ts-ignore
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

    // eslint-disable-next-line radar/cognitive-complexity
    public parseInputTypes(models: string[]) {
        // eslint-disable-next-line radar/cognitive-complexity
        const definitions = models.reduce((accumulator: { [key: string]: any }, modelName) => {
            const methods = methodsNames.map((method) => {
                return {
                    name: `${method.methodStart}${modelName}`,
                    schemaName: `${method.schemaNameStart}${modelName}`,
                };
            });

            methods.forEach(({ name: method, schemaName }) => {
                // @ts-ignore
                const dataFields = this.dmmf.mutationType.fieldMap[method].args[0].inputTypes[0].type.fields;
                const requiredProperties: string[] = [];
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
                        // @ts-ignore
                        const { type: schemaType } = schema[1];

                        if (schemaType && Array.isArray(schemaType)) {
                            if (schemaType.includes("null")) {
                                // eslint-disable-next-line no-param-reassign
                                propertiesAccumulator[field.name] = {
                                    ...schemaType,
                                    type: schemaType.filter((type: string) => type !== "null"),
                                    nullable: true,
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

                    return propertiesAccumulator;
                }, {});

                accumulator[schemaName] = {
                    type: "object",
                    xml: {
                        name: schemaName,
                    },
                    properties,
                };

                if (requiredProperties.length > 0) {
                    accumulator[schemaName].required = requiredProperties;
                }
            });

            return accumulator;
        }, {});

        this.schemaInputTypes.forEach((value, key) => {
            definitions[key] = {
                type: "object",
                xml: {
                    name: key,
                },
                properties: value,
            };
        });

        return definitions;
    }

    // eslint-disable-next-line class-methods-use-this
    public formatInputTypeData(inputType: any) {
        if (inputType.kind === "object") {
            const reference = formatSchemaReference(inputType.type.name);

            if (inputType.isList) {
                return {
                    type: "array",
                    xml: {
                        name: inputType.type.name,
                        wrapped: true,
                    },
                    items: {
                        $ref: reference,
                    },
                };
            }

            return { $ref: reference };
        }

        const type = getJSONSchemaScalar(inputType.type);

        if (inputType.isList) {
            return {
                type: "array",
                xml: {
                    name: inputType.type.name,
                    wrapped: true,
                },
                items: {
                    type,
                },
            };
        }

        return { type };
    }

    // eslint-disable-next-line radar/cognitive-complexity
    public parseObjectInputType(fieldType: any) {
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

    // eslint-disable-next-line class-methods-use-this
    public getPaginationDataSchema() {
        return {
            [PAGINATION_SCHEMA_NAME]: {
                type: "object",
                xml: {
                    name: PAGINATION_SCHEMA_NAME,
                },
                properties: {
                    total: {
                        type: "integer",
                        minimum: 0,
                        description: "Holds the value for the total number of rows in the database",
                    },
                    perPage: {
                        type: "integer",
                        minimum: 0,
                        description: "Returns the value for the limit passed to the paginate method",
                    },
                    page: {
                        type: "integer",
                        minimum: 1,
                        description: "Current page number",
                    },
                    lastPage: {
                        type: "integer",
                        minimum: 0,
                        description: "Returns the value for the last page by taking the total of rows into account",
                    },
                    firstPage: {
                        type: "integer",
                        minimum: 0,
                        description: "Returns the number for the first page. It is always 1",
                    },
                    firstPageUrl: {
                        type: "string",
                        description: "The URL for the first page",
                    },
                    lastPageUrl: {
                        type: "string",
                        description: "The URL for the last page",
                    },
                    nextPageUrl: {
                        type: "string",
                        description: "The URL for the next page",
                    },
                    previousPageUrl: {
                        type: "string",
                        description: "The URL for the previous page",
                    },
                },
            },
        };
    }

    public getExampleModelsSchemas(
        modelNames: string[],
        schemas: {
            [key: string]: OpenAPIV3.SchemaObject;
        },
    ) {
        const referenceToSchema = (reference: string) => {
            const name = reference.replace("#/components/schemas/", "");
            const model = schemas[name] as OpenAPIV3.SchemaObject;

            const values: { [key: string]: string | object[] } = {};

            Object.entries((model?.properties as OpenAPIV3.SchemaObject) || {}).forEach(([key, v]) => {
                const type = (v as OpenAPIV3.SchemaObject).type as string;

                if (type === "array") {
                    // eslint-disable-next-line @typescript-eslint/no-use-before-define
                    values[key] = [arrayItemsToSchema(v.items)];
                } else {
                    values[key] = type;
                }
            });

            return values;
        };

        const objectPropertiesToSchema = (objectProperties: { [name: string]: OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject }) => {
            const values: { [key: string]: string | object | object[] } = {};

            Object.entries(objectProperties).forEach(([key, value]) => {
                if (typeof (value as OpenAPIV3.ReferenceObject).$ref !== "undefined") {
                    values[key] = referenceToSchema((value as OpenAPIV3.ReferenceObject).$ref);
                } else {
                    values[key] = (value as OpenAPIV3.SchemaObject).type as string;
                }
            });

            return values;
        };

        const arrayItemsToSchema = (items: OpenAPIV3.ArraySchemaObject) => {
            const values: { [key: string]: object | object[] } = {};

            Object.entries(items).forEach(([key, value]) => {
                if (typeof value.items.$ref !== "undefined") {
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

        return modelNames.reduce((accumulator, modelName) => {
            const value: { [key: string]: string | object | object[] } = {};
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

            const pagination = this.getPaginationDataSchema()[PAGINATION_SCHEMA_NAME];
            const meta: { [key: string]: string } = {};

            Object.entries(pagination.properties as OpenAPIV3.SchemaObject).forEach(([key, v]) => {
                meta[key] = (v as OpenAPIV3.SchemaObject).type as string;
            });

            return {
                ...accumulator,
                [`${modelName}`]: {
                    value,
                },
                [`${modelName}Page`]: {
                    value: {
                        data: [value],
                        meta,
                    },
                },
            };
        }, {});
    }

    // eslint-disable-next-line class-methods-use-this
    public getPaginatedModelsSchemas(modelNames: string[]) {
        return modelNames.reduce((accumulator, modelName) => {
            return {
                ...accumulator,
                [`${modelName}Page`]: {
                    type: "object",
                    xml: {
                        name: `${modelName}Page`,
                    },
                    properties: {
                        data: {
                            type: "array",
                            xml: {
                                name: "Data",
                                wrapped: true,
                            },
                            items: {
                                $ref: formatSchemaReference(modelName),
                            },
                        },
                        meta: {
                            $ref: formatSchemaReference(PAGINATION_SCHEMA_NAME),
                        },
                    },
                },
            };
        }, {});
    }
}

export default PrismaJsonSchemaParser;
