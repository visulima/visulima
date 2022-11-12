// @ts-ignore
import { getJSONSchemaProperty } from "prisma-json-schema-generator/dist/generator/properties";
// @ts-ignore
import { transformDMMF } from "prisma-json-schema-generator/dist/generator/transformDMMF";
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

    public parseModels() {
        // @ts-ignore
        const modelsDefinitions = transformDMMF(this.dmmf).definitions;

        for (const definition in modelsDefinitions) {
            const { properties } = modelsDefinitions[definition];

            for (const property in properties) {
                if (Array.isArray(properties[property].type) && properties[property].type.includes("null")) {
                    properties[property].type = properties[property].type.filter((type: string) => type !== "null");

                    if (properties[property].type.length === 1) {
                        properties[property].type = properties[property].type[0];
                    }
                    properties[property].nullable = true;
                }
            }
        }

        return modelsDefinitions;
    }

    public parseInputTypes(models: string[]) {
        const definitions = models.reduce((accumulator: { [key: string]: any }, modelName) => {
            const methods = methodsNames.map((method) => {
                return {
                    name: `${method.methodStart}${modelName}`,
                    schemaName: `${method.schemaNameStart}${modelName}`,
                };
            });

            methods.forEach(({ name: method, schemaName }) => {
                const dataFields =
                    // @ts-ignore
                    this.dmmf.mutationType.fieldMap[method].args[0].inputTypes[0].type.fields;
                const requiredProperties: string[] = [];
                const properties = dataFields.reduce((propertiesAccumulator: any, field: any) => {
                    if (field.inputTypes[0].kind === "scalar") {
                        const schema = getJSONSchemaProperty(
                            // @ts-ignore
                            this.dmmf.datamodel,
                            {},
                        )({
                            name: field.name,
                            ...field.inputTypes[0],
                        });

                        if (schema[1].type && Array.isArray(schema[1].type)) {
                            if (schema[1].type.includes("null")) {
                                propertiesAccumulator[field.name] = {
                                    ...schema[1],
                                    type: schema[1].type.filter((type: string) => type !== "null"),
                                    nullable: true,
                                };
                                if (propertiesAccumulator[field.name].type.length === 1) {
                                    propertiesAccumulator[field.name] = {
                                        ...propertiesAccumulator[field.name],
                                        type: propertiesAccumulator[field.name].type[0],
                                    };
                                }
                            }
                        } else {
                            propertiesAccumulator[field.name] = schema[1];
                        }
                    } else {
                        const typeName = this.parseObjectInputType(field.inputTypes[0]);
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
                    properties,
                };

                if (requiredProperties.length > 0) {
                    accumulator[schemaName].required = requiredProperties;
                }
            });

            return accumulator;
        }, {});

        for (const [key, value] of this.schemaInputTypes.entries()) {
            definitions[key] = {
                type: "object",
                properties: value,
            };
        }

        return definitions;
    }

    public formatInputTypeData(inputType: any) {
        if (inputType.kind === "object") {
            const reference = formatSchemaReference(inputType.type.name);

            if (inputType.isList) {
                return {
                    type: "array",
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
                items: {
                    type,
                },
            };
        }
        return { type };
    }

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

                                return inputTypeData;
                            })
                            .filter(Boolean);

                        if (anyOf.length === 1) {
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

    public getPaginationDataSchema() {
        return {
            [PAGINATION_SCHEMA_NAME]: {
                type: "object",
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
        const objectPropertiesToSchema = (objectProperties: { [name: string]: OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject }) => {
            const values: { [key: string]: string | object | object[] } = {};

            Object.entries(objectProperties).forEach(([key, value]) => {
                if (typeof (value as OpenAPIV3.ReferenceObject)["$ref"] !== "undefined") {
                    values[key] = refToSchema((value as OpenAPIV3.ReferenceObject).$ref);
                } else {
                    values[key] = (value as OpenAPIV3.SchemaObject).type as string;
                }
            });

            return values;
        };

        const arrayItemsToSchema = (items: OpenAPIV3.ArraySchemaObject) => {
            const values: { [key: string]: object | object[] } = {};

            Object.entries(items).forEach(([key, value]) => {
                if (typeof value.items["$ref"] !== "undefined") {
                    values[key] = [refToSchema(value.items["$ref"])];
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

        const refToSchema = (ref: string) => {
            const name = ref.replace("#/components/schemas/", "");
            const model = schemas[name] as OpenAPIV3.SchemaObject;

            const values: { [key: string]: string | object[] } = {};

            Object.entries((model?.properties as OpenAPIV3.SchemaObject) || {}).forEach(([key, v]) => {
                const type = (v as OpenAPIV3.SchemaObject).type as string;

                if (type === "array") {
                    values[key] = [arrayItemsToSchema(v.items)];
                } else {
                    values[key] = type;
                }
            });

            return values;
        };

        return modelNames.reduce((accumulator, modelName) => {
            const value: { [key: string]: string | { [key: string]: string }[] } = {};
            const model = schemas[modelName] as OpenAPIV3.SchemaObject;

            Object.entries(model.properties as OpenAPIV3.SchemaObject).forEach(([key, v]) => {
                const type = (v as OpenAPIV3.SchemaObject).type as string;

                if (type === "array") {
                    // @ts-ignore
                    value[key] = [refToSchema(v.items["$ref"])];
                } else if (type === "object") {
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

    public getPaginatedModelsSchemas(modelNames: string[]) {
        return modelNames.reduce((accumulator, modelName) => {
            return {
                ...accumulator,
                [`${modelName}Page`]: {
                    type: "object",
                    properties: {
                        data: {
                            type: "array",
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
